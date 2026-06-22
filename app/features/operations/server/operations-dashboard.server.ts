import { asc, desc, inArray } from "drizzle-orm";

import { database } from "../../../../database/context";
import { taskEvents, tasks, type AllowedRole } from "../../../../database/schema";
import { requireAnyRole } from "../../auth/server/authz.server";
import {
  getCurrentUserRoles,
  requireUserSession,
  type AuthenticatedSession,
} from "../../auth/server/session.server";
import {
  type TaskListItem,
  type TaskPagination,
} from "../../tasks/server/task-query.server";
import { getTaskStatusPresentation } from "../../tasks/server/task-status.server";

const operationsRetentionTaskLimit = 200;
const operationsPageSize = 10;

type OperationsContext = {
  requestId: string;
  releaseStage: string;
  serviceName: string;
};

type TaskStatusValue =
  | "created"
  | "resolving_source"
  | "matching_preset"
  | "awaiting_preset_decision"
  | "queued"
  | "processing"
  | "awaiting_human_review"
  | "completed"
  | "failed"
  | "cancelled";

type OperationTaskRecord = {
  id: string;
  intakeMethod: "youtube_link" | "video_upload";
  sourceIdentifier: string;
  sourceSnapshot: Record<string, unknown> | null;
  processingBaselineSnapshot: Record<string, unknown> | null;
  presetSnapshot: Record<string, unknown> | null;
  status: TaskStatusValue;
  createdAt: Date;
  updatedAt: Date;
};

type OperationTaskEventRecord = {
  id: string;
  taskId: string;
  eventType: string;
  fromStatus: TaskStatusValue;
  toStatus: TaskStatusValue;
  reasonCode: string | null;
  requestId: string;
  payload: Record<string, unknown> | null;
  createdAt: Date;
};

type OperationPresetPath =
  | "matched"
  | "manual_create"
  | "manual_reuse"
  | "continue_without_preset"
  | "unresolved";

type OperationsMetricScope =
  | "matched_existing_preset"
  | "reused_existing_preset"
  | "timing_samples"
  | "human_intervention"
  | "failed_or_interrupted";

type DrilldownFilterKey = "all" | "preset_path" | "metric_scope";

type DrilldownTaskFilter = {
  kind: DrilldownFilterKey;
  value: OperationPresetPath | OperationsMetricScope | null;
};

type SourceSnapshot = {
  title?: string;
};

type PresetSnapshot = {
  status?: string;
  summary?: string;
};

type OperationsTaskSample = {
  task: OperationTaskRecord;
  events: OperationTaskEventRecord[];
  presetPath: OperationPresetPath;
  startEvent: OperationTaskEventRecord | null;
  completedEvent: OperationTaskEventRecord | null;
  sourceRecognitionComplete: boolean;
  humanIntervention: boolean;
  failedOrInterrupted: boolean;
};

export type OperationsMetricCard = {
  id:
    | "preset-hit-rate"
    | "preset-reuse-rate"
    | "time-to-start"
    | "human-intervention-rate"
    | "failure-rate";
  eyebrow: string;
  title: string;
  value: string;
  supportingText: string;
  explanation: string;
  tone: "neutral" | "good" | "warning";
  drilldownHref: string;
  empty: boolean;
};

export type OperationsPathBreakdownItem = {
  path: OperationPresetPath;
  label: string;
  count: number;
  supportingText: string;
  drilldownHref: string;
};

export type OperationsTaskListItem = TaskListItem & {
  presetOutcomeLabel: string;
  enteredProcessingAt: string | null;
  completedAt: string | null;
  operationsSignal: string;
};

export type OperationsDashboardViewModel = {
  requestId: string;
  runtime: string;
  serviceName: string;
  user: {
    id: number;
    displayName: string;
    email: string;
  };
  roles: AllowedRole[];
  pageTitle: string;
  navigation: Array<{
    label: string;
    href: string;
    state: "active" | "idle";
  }>;
  summary: {
    title: string;
    lede: string;
    scopeNote: string;
  };
  metricCards: OperationsMetricCard[];
  pathBreakdown: OperationsPathBreakdownItem[];
  drilldown: {
    activeLabel: string;
    helperText: string;
    emptyTitle: string;
    emptyBody: string;
    resetHref: string;
    taskList: {
      data: OperationsTaskListItem[];
      meta: {
        pagination: TaskPagination;
      };
    };
  };
};

export const operationsDashboardTestHooks = {
  requireUserSessionImpl: requireUserSession,
  getCurrentUserRolesImpl: getCurrentUserRoles,
  requireAnyRoleImpl: requireAnyRole,
  listOperationTasksImpl: listOperationTasks,
  listOperationTaskEventsImpl: listOperationTaskEvents,
};

export function setOperationsDashboardTestHooks(
  hooks: Partial<typeof operationsDashboardTestHooks>,
) {
  operationsDashboardTestHooks.requireUserSessionImpl =
    hooks.requireUserSessionImpl ?? requireUserSession;
  operationsDashboardTestHooks.getCurrentUserRolesImpl =
    hooks.getCurrentUserRolesImpl ?? getCurrentUserRoles;
  operationsDashboardTestHooks.requireAnyRoleImpl =
    hooks.requireAnyRoleImpl ?? requireAnyRole;
  operationsDashboardTestHooks.listOperationTasksImpl =
    hooks.listOperationTasksImpl ?? listOperationTasks;
  operationsDashboardTestHooks.listOperationTaskEventsImpl =
    hooks.listOperationTaskEventsImpl ?? listOperationTaskEvents;
}

function normalizePage(value: string | null) {
  const page = Number(value ?? "1");

  if (Number.isNaN(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

function normalizePresetPath(value: string | null): OperationPresetPath | null {
  switch (value) {
    case "matched":
    case "manual_create":
    case "manual_reuse":
    case "continue_without_preset":
    case "unresolved":
      return value;
    default:
      return null;
  }
}

function normalizeMetricScope(
  value: string | null,
): OperationsMetricScope | null {
  switch (value) {
    case "matched_existing_preset":
    case "reused_existing_preset":
    case "timing_samples":
    case "human_intervention":
    case "failed_or_interrupted":
      return value;
    default:
      return null;
  }
}

function parseDrilldown(url: URL): DrilldownTaskFilter {
  const filter = url.searchParams.get("filter");

  if (filter === "preset_path") {
    return {
      kind: "preset_path",
      value: normalizePresetPath(url.searchParams.get("presetPath")),
    };
  }

  if (filter === "metric_scope") {
    return {
      kind: "metric_scope",
      value: normalizeMetricScope(url.searchParams.get("metricScope")),
    };
  }

  return {
    kind: "all",
    value: null,
  };
}

function getSourceTitle(task: OperationTaskRecord) {
  const snapshot = task.sourceSnapshot as SourceSnapshot | null;

  return snapshot?.title ?? task.sourceIdentifier;
}

function getPresetPath(task: OperationTaskRecord): OperationPresetPath {
  const snapshot = task.presetSnapshot as PresetSnapshot | null;

  switch (snapshot?.status) {
    case "matched":
      return "matched";
    case "manual_create":
      return "manual_create";
    case "manual_reuse":
      return "manual_reuse";
    case "continue_without_preset":
    case "none":
      return "continue_without_preset";
    case "unresolved":
    default:
      return "unresolved";
  }
}

function getPresetPathLabel(path: OperationPresetPath) {
  switch (path) {
    case "matched":
      return "自动命中已有预设";
    case "manual_create":
      return "新建最小预设后继续";
    case "manual_reuse":
      return "手动复用已有预设";
    case "continue_without_preset":
      return "未使用预设继续";
    case "unresolved":
      return "仍待预设决策";
  }
}

function getPresetPathSupportingText(path: OperationPresetPath) {
  switch (path) {
    case "matched":
      return "直接命中已有预设，是产品预设资产最直接的价值兑现样本。";
    case "manual_create":
      return "说明当前需要人工补建最小预设，属于沉淀资产但尚未形成复用。";
    case "manual_reuse":
      return "说明已有资产可复用，但还没有做到自动命中。";
    case "continue_without_preset":
      return "说明任务继续推进了，但没有落到预设资产复用路径。";
    case "unresolved":
      return "说明流程仍卡在预设决策环节，尚未完成去向判断。";
  }
}

function formatDurationMinutes(value: number | null) {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return "暂无足够数据";
  }

  if (value < 1) {
    return "少于 1 分钟";
  }

  if (value < 60) {
    return `${Math.round(value)} 分钟`;
  }

  const hours = value / 60;

  if (hours < 24) {
    return `${hours.toFixed(1)} 小时`;
  }

  return `${(hours / 24).toFixed(1)} 天`;
}

function median(numbers: number[]) {
  if (numbers.length === 0) {
    return null;
  }

  const sorted = [...numbers].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle] ?? null;
}

function percentile(numbers: number[], ratio: number) {
  if (numbers.length === 0) {
    return null;
  }

  const sorted = [...numbers].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );

  return sorted[index] ?? null;
}

function formatRate(value: number, total: number) {
  if (total === 0) {
    return "暂无足够数据";
  }

  return `${Math.round((value / total) * 100)}%`;
}

function findStartEvent(events: OperationTaskEventRecord[]) {
  return (
    events.find(
      (event) =>
        event.eventType === "task.queued" || event.eventType === "task.processing",
    ) ?? null
  );
}

function findCompletedEvent(events: OperationTaskEventRecord[]) {
  return events.find((event) => event.eventType === "task.completed") ?? null;
}

function isSourceRecognitionComplete(
  task: OperationTaskRecord,
  events: OperationTaskEventRecord[],
) {
  if (!task.sourceIdentifier.trim()) {
    return false;
  }

  if (task.status !== "created" && task.status !== "resolving_source") {
    return true;
  }

  return events.some(
    (event) =>
      event.eventType !== "task.created" &&
      event.eventType !== "task.resolving_source",
  );
}

function hasHumanIntervention(
  task: OperationTaskRecord,
  events: OperationTaskEventRecord[],
) {
  if (
    task.status === "awaiting_preset_decision" ||
    task.status === "awaiting_human_review"
  ) {
    return true;
  }

  return events.some(
    (event) =>
      event.eventType === "task.preset_decision_requested" ||
      event.eventType === "task.review_required" ||
      event.eventType === "task.human_review_requested" ||
      event.toStatus === "awaiting_preset_decision" ||
      event.toStatus === "awaiting_human_review",
  );
}

function hasFailureOrInterrupted(
  task: OperationTaskRecord,
  events: OperationTaskEventRecord[],
) {
  if (task.status === "failed" || task.status === "cancelled") {
    return true;
  }

  return events.some(
    (event) =>
      event.eventType === "task.failed" ||
      event.eventType === "task.cancelled" ||
      event.toStatus === "failed" ||
      event.toStatus === "cancelled",
  );
}

function getOperationsSignal(sample: OperationsTaskSample) {
  if (sample.failedOrInterrupted) {
    return "失败或中断样本";
  }

  if (sample.humanIntervention) {
    return "存在人工介入";
  }

  if (sample.completedEvent) {
    return "已具备完成事件";
  }

  if (sample.startEvent) {
    return "已进入处理阶段";
  }

  return "等待更多阶段事件";
}

function buildTaskListItem(sample: OperationsTaskSample): OperationsTaskListItem {
  const latestEvent = sample.events.at(-1) ?? null;
  const statusPresentation = getTaskStatusPresentation(sample.task.status);
  const latestProgressLabel = latestEvent
    ? {
        "task.preset_decision_requested": "等待预设决策",
        "task.queued": "已进入处理队列",
        "task.processing": "正在处理内容",
        "task.review_required": "低置信度片段待确认",
        "task.human_review_requested": "已进入人工复核队列",
        "task.failed": "处理失败",
        "task.retry_requested": "请求创建恢复 attempt",
        "task.completed": "处理完成",
        "task.cancelled": "任务已取消",
      }[latestEvent.eventType] ?? statusPresentation.label
    : statusPresentation.label;

  return {
    id: sample.task.id,
    status: sample.task.status,
    statusLabel: statusPresentation.label,
    statusTone: statusPresentation.tone,
    intakeMethod: sample.task.intakeMethod,
    sourceIdentifier: sample.task.sourceIdentifier,
    sourceTitle: getSourceTitle(sample.task),
    latestEventType: latestEvent?.eventType ?? null,
    latestEventAt: latestEvent?.createdAt.toISOString() ?? null,
    latestProgressLabel,
    createdAt: sample.task.createdAt.toISOString(),
    updatedAt: sample.task.updatedAt.toISOString(),
    presetOutcomeLabel: getPresetPathLabel(sample.presetPath),
    enteredProcessingAt: sample.startEvent?.createdAt.toISOString() ?? null,
    completedAt: sample.completedEvent?.createdAt.toISOString() ?? null,
    operationsSignal: getOperationsSignal(sample),
  };
}

function buildDrilldownHref(filter: DrilldownTaskFilter, page = 1) {
  const search = new URLSearchParams();

  if (page > 1) {
    search.set("page", String(page));
  }

  if (filter.kind === "preset_path" && filter.value) {
    search.set("filter", "preset_path");
    search.set("presetPath", String(filter.value));
  }

  if (filter.kind === "metric_scope" && filter.value) {
    search.set("filter", "metric_scope");
    search.set("metricScope", String(filter.value));
  }

  const suffix = search.toString();

  return suffix ? `/operations?${suffix}` : "/operations";
}

function buildNavigation() {
  return [
    { label: "核心指标总览", href: "/operations", state: "active" as const },
    {
      label: "反复未命中频道",
      href: "/operations/non-match-sources",
      state: "idle" as const,
    },
    { label: "创作者工作台", href: "/workspace", state: "idle" as const },
  ];
}

async function listOperationTasks(
  limit = operationsRetentionTaskLimit,
): Promise<OperationTaskRecord[]> {
  const db = database();
  const records = await db
    .select({
      id: tasks.id,
      intakeMethod: tasks.intakeMethod,
      sourceIdentifier: tasks.sourceIdentifier,
      sourceSnapshot: tasks.sourceSnapshot,
      processingBaselineSnapshot: tasks.processingBaselineSnapshot,
      presetSnapshot: tasks.presetSnapshot,
      status: tasks.status,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .orderBy(desc(tasks.updatedAt))
    .limit(limit);

  return records as OperationTaskRecord[];
}

async function listOperationTaskEvents(
  taskIds: string[],
): Promise<OperationTaskEventRecord[]> {
  if (taskIds.length === 0) {
    return [];
  }

  const db = database();
  const records = await db
    .select({
      id: taskEvents.id,
      taskId: taskEvents.taskId,
      eventType: taskEvents.eventType,
      fromStatus: taskEvents.fromStatus,
      toStatus: taskEvents.toStatus,
      reasonCode: taskEvents.reasonCode,
      requestId: taskEvents.requestId,
      payload: taskEvents.payload,
      createdAt: taskEvents.createdAt,
    })
    .from(taskEvents)
    .where(inArray(taskEvents.taskId, taskIds))
    .orderBy(asc(taskEvents.createdAt));

  return records.map((record) => ({
    ...(record as Omit<OperationTaskEventRecord, "payload">),
    payload: (record.payload as Record<string, unknown> | null) ?? {},
  }));
}

function groupEventsByTask(events: OperationTaskEventRecord[]) {
  const grouped = new Map<string, OperationTaskEventRecord[]>();

  for (const event of events) {
    const bucket = grouped.get(event.taskId) ?? [];
    bucket.push(event);
    grouped.set(event.taskId, bucket);
  }

  return grouped;
}

function buildTaskSamples(
  tasks: OperationTaskRecord[],
  groupedEvents: Map<string, OperationTaskEventRecord[]>,
) {
  return tasks.map((task) => {
    const events = groupedEvents.get(task.id) ?? [];

    return {
      task,
      events,
      presetPath: getPresetPath(task),
      startEvent: findStartEvent(events),
      completedEvent: findCompletedEvent(events),
      sourceRecognitionComplete: isSourceRecognitionComplete(task, events),
      humanIntervention: hasHumanIntervention(task, events),
      failedOrInterrupted: hasFailureOrInterrupted(task, events),
    } satisfies OperationsTaskSample;
  });
}

function buildMetrics(samples: OperationsTaskSample[]) {
  const pathCounts: Record<OperationPresetPath, number> = {
    matched: 0,
    manual_create: 0,
    manual_reuse: 0,
    continue_without_preset: 0,
    unresolved: 0,
  };
  const recognizedSamples = samples.filter(
    (sample) => sample.sourceRecognitionComplete,
  );
  const startDurations = samples
    .filter((sample) => sample.startEvent)
    .map(
      (sample) =>
        (sample.startEvent!.createdAt.getTime() - sample.task.createdAt.getTime()) /
        60000,
    );
  const completionDurations = samples
    .filter((sample) => sample.completedEvent)
    .map(
      (sample) =>
        (sample.completedEvent!.createdAt.getTime() -
          sample.task.createdAt.getTime()) /
        60000,
    );

  for (const sample of samples) {
    pathCounts[sample.presetPath] += 1;
  }

  const matchedCount = recognizedSamples.filter(
    (sample) => sample.presetPath === "matched",
  ).length;
  const reuseCount = recognizedSamples.filter(
    (sample) =>
      sample.presetPath === "matched" || sample.presetPath === "manual_reuse",
  ).length;
  const humanInterventionCount = samples.filter(
    (sample) => sample.humanIntervention,
  ).length;
  const failedOrInterruptedCount = samples.filter(
    (sample) => sample.failedOrInterrupted,
  ).length;
  const startMedian = median(startDurations);
  const startP95 = percentile(startDurations, 0.95);
  const completionMedian = median(completionDurations);
  const completionP95 = percentile(completionDurations, 0.95);

  return {
    cards: [
      {
        id: "preset-hit-rate",
        eyebrow: "核心价值",
        title: "预设命中率",
        value: formatRate(matchedCount, recognizedSamples.length),
        supportingText:
          recognizedSamples.length > 0
            ? `已完成来源识别的 ${recognizedSamples.length} 条任务中，有 ${matchedCount} 条直接自动命中已有预设。`
            : "当前保留窗口内还没有足够的来源识别完成样本。",
        explanation:
          "口径：matched_existing_preset / 已完成来源识别任务；不把手动复用或新建预设计入命中率。",
        tone:
          recognizedSamples.length > 0 && matchedCount / recognizedSamples.length >= 0.5
            ? "good"
            : recognizedSamples.length > 0
              ? "warning"
              : "neutral",
        drilldownHref: buildDrilldownHref({
          kind: "metric_scope",
          value: "matched_existing_preset",
        }),
        empty: recognizedSamples.length === 0,
      },
      {
        id: "preset-reuse-rate",
        eyebrow: "资产复用",
        title: "预设复用率",
        value: formatRate(reuseCount, recognizedSamples.length),
        supportingText:
          recognizedSamples.length > 0
            ? `自动命中 ${matchedCount} 条，手动复用 ${pathCounts.manual_reuse} 条；新建最小预设 ${pathCounts.manual_create} 条单独保留观察。`
            : "当前保留窗口内还没有足够的来源识别完成样本。",
        explanation:
          "口径：matched_existing_preset + manually_selected_existing_preset；不把“新建预设后继续”或“未使用预设继续”计入复用率。",
        tone:
          recognizedSamples.length > 0 && reuseCount / recognizedSamples.length >= 0.65
            ? "good"
            : recognizedSamples.length > 0
              ? "warning"
              : "neutral",
        drilldownHref: buildDrilldownHref({
          kind: "metric_scope",
          value: "reused_existing_preset",
        }),
        empty: recognizedSamples.length === 0,
      },
      {
        id: "time-to-start",
        eyebrow: "速度表现",
        title: "导入到进入处理耗时",
        value:
          startDurations.length > 0
            ? `中位 ${formatDurationMinutes(startMedian)} / P95 ${formatDurationMinutes(startP95)}`
            : "暂无足够数据",
        supportingText:
          completionDurations.length > 0
            ? `同时可见完成耗时：中位 ${formatDurationMinutes(completionMedian)} / P95 ${formatDurationMinutes(completionP95)}。`
            : "完成耗时仍缺少足够的 completed 事件样本，已在下钻列表中保留任务级时间戳。",
        explanation:
          "口径：任务创建到首个 queued/processing 事件；页面下钻同时展示创建、进入处理与完成时间。",
        tone: startDurations.length > 0 ? "neutral" : "warning",
        drilldownHref: buildDrilldownHref({
          kind: "metric_scope",
          value: "timing_samples",
        }),
        empty: startDurations.length === 0,
      },
      {
        id: "human-intervention-rate",
        eyebrow: "流程摩擦",
        title: "人工介入任务占比",
        value: formatRate(humanInterventionCount, samples.length),
        supportingText:
          samples.length > 0
            ? `共有 ${humanInterventionCount} 条任务进入过等待预设决策或人工确认环节。`
            : "当前保留窗口内还没有任务样本。",
        explanation:
          "口径：进入 awaiting_preset_decision 或 awaiting_human_review 的任务 / 创建任务总数。",
        tone:
          samples.length > 0 && humanInterventionCount / samples.length > 0.25
            ? "warning"
            : "neutral",
        drilldownHref: buildDrilldownHref({
          kind: "metric_scope",
          value: "human_intervention",
        }),
        empty: samples.length === 0,
      },
      {
        id: "failure-rate",
        eyebrow: "交付风险",
        title: "失败或中断任务占比",
        value: formatRate(failedOrInterruptedCount, samples.length),
        supportingText:
          samples.length > 0
            ? `共有 ${failedOrInterruptedCount} 条任务进入 failed 或 cancelled 等中断终态。`
            : "当前保留窗口内还没有任务样本。",
        explanation:
          "口径：进入 failed 或 cancelled 的任务 / 创建任务总数；用于判断交付链路的终态风险。",
        tone:
          samples.length > 0 && failedOrInterruptedCount / samples.length > 0.1
            ? "warning"
            : "neutral",
        drilldownHref: buildDrilldownHref({
          kind: "metric_scope",
          value: "failed_or_interrupted",
        }),
        empty: samples.length === 0,
      },
    ] satisfies OperationsMetricCard[],
    pathBreakdown: (
      [
        "matched",
        "manual_reuse",
        "manual_create",
        "continue_without_preset",
        "unresolved",
      ] satisfies OperationPresetPath[]
    ).map((path) => ({
      path,
      label: getPresetPathLabel(path),
      count: pathCounts[path],
      supportingText: getPresetPathSupportingText(path),
      drilldownHref: buildDrilldownHref({
        kind: "preset_path",
        value: path,
      }),
    })),
  };
}

function matchesMetricScope(
  sample: OperationsTaskSample,
  scope: OperationsMetricScope,
) {
  switch (scope) {
    case "matched_existing_preset":
      return sample.sourceRecognitionComplete && sample.presetPath === "matched";
    case "reused_existing_preset":
      return (
        sample.sourceRecognitionComplete &&
        (sample.presetPath === "matched" || sample.presetPath === "manual_reuse")
      );
    case "timing_samples":
      return Boolean(sample.startEvent || sample.completedEvent);
    case "human_intervention":
      return sample.humanIntervention;
    case "failed_or_interrupted":
      return sample.failedOrInterrupted;
  }
}

function filterSamples(
  samples: OperationsTaskSample[],
  drilldown: DrilldownTaskFilter,
) {
  switch (drilldown.kind) {
    case "preset_path":
      return drilldown.value
        ? samples.filter(
            (sample) => sample.presetPath === drilldown.value,
          )
        : samples;
    case "metric_scope":
      return drilldown.value
        ? samples.filter((sample) =>
            matchesMetricScope(
              sample,
              drilldown.value as OperationsMetricScope,
            ),
          )
        : samples;
    case "all":
    default:
      return samples;
  }
}

function buildDrilldownMeta(drilldown: DrilldownTaskFilter) {
  switch (drilldown.kind) {
    case "preset_path":
      return {
        activeLabel: drilldown.value
          ? `当前按预设结果筛选：${getPresetPathLabel(
              drilldown.value as OperationPresetPath,
            )}`
          : "当前查看全部任务",
        helperText: "用于回看这一类预设结果背后的任务明细与关键阶段时间戳。",
      };
    case "metric_scope":
      return {
        activeLabel:
          drilldown.value === "matched_existing_preset"
            ? "当前按指标样本筛选：预设命中率"
            : drilldown.value === "reused_existing_preset"
              ? "当前按指标样本筛选：预设复用率"
              : drilldown.value === "timing_samples"
                ? "当前按指标样本筛选：关键耗时样本"
                : drilldown.value === "human_intervention"
                  ? "当前按指标样本筛选：人工介入任务"
                  : drilldown.value === "failed_or_interrupted"
                    ? "当前按指标样本筛选：失败或中断任务"
                    : "当前查看全部任务",
        helperText:
          "下钻列表会保留 task id、来源标识、预设结果、当前状态以及关键阶段时间戳，便于快速回看判断依据。",
      };
    case "all":
    default:
      return {
        activeLabel: "当前查看全部任务",
        helperText:
          "从核心指标卡或预设路径分布进入筛选后，会在这里看到对应任务范围。",
      };
  }
}

export async function loadOperationsDashboardViewModel(args: {
  request: Request;
  context: OperationsContext;
}): Promise<OperationsDashboardViewModel> {
  const authenticated = (await operationsDashboardTestHooks.requireUserSessionImpl(
    args.request,
  )) as AuthenticatedSession;
  const roles = await operationsDashboardTestHooks.getCurrentUserRolesImpl(
    authenticated.user.id,
  );

  await operationsDashboardTestHooks.requireAnyRoleImpl(
    authenticated,
    ["ops", "admin"],
    {
      type: "operations-dashboard",
      id: "ops-home",
    },
  );

  const url = new URL(args.request.url);
  const page = normalizePage(url.searchParams.get("page"));
  const drilldown = parseDrilldown(url);
  const taskRows = await operationsDashboardTestHooks.listOperationTasksImpl(
    operationsRetentionTaskLimit,
  );
  const eventRows = await operationsDashboardTestHooks.listOperationTaskEventsImpl(
    taskRows.map((task) => task.id),
  );
  const groupedEvents = groupEventsByTask(eventRows);
  const samples = buildTaskSamples(taskRows, groupedEvents);
  const { cards, pathBreakdown } = buildMetrics(samples);
  const filteredSamples = filterSamples(samples, drilldown);
  const total = filteredSamples.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / operationsPageSize);
  const currentPage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * operationsPageSize;
  const paginatedSamples = filteredSamples.slice(
    pageStart,
    pageStart + operationsPageSize,
  );
  const drilldownMeta = buildDrilldownMeta(drilldown);

  return {
    requestId: args.context.requestId,
    runtime: args.context.releaseStage,
    serviceName: args.context.serviceName,
    user: {
      id: authenticated.user.id,
      displayName: authenticated.user.displayName,
      email: authenticated.user.email,
    },
    roles,
    pageTitle: "Yakimoji Operations",
    navigation: buildNavigation(),
    summary: {
      title: "运营可见性判断台",
      lede:
        "这一页只保留第一版最关键的 5 组运营信号，用来判断预设是否真的命中、是否形成复用，以及流程在哪些任务上发生了人工介入或中断。",
      scopeNote: `统计口径：默认只基于当前保留窗口内最近 ${operationsRetentionTaskLimit} 条任务与已落库事件；缺少事件链的指标会明确标记“暂无足够数据”。`,
    },
    metricCards: cards,
    pathBreakdown,
    drilldown: {
      activeLabel: drilldownMeta.activeLabel,
      helperText: drilldownMeta.helperText,
      emptyTitle: "暂无匹配任务",
      emptyBody:
        "当前筛选范围内还没有足够样本，请切换回全部任务或从其他指标继续下钻。",
      resetHref: "/operations",
      taskList: {
        data: paginatedSamples.map((sample) => buildTaskListItem(sample)),
        meta: {
          pagination: {
            page: currentPage,
            pageSize: operationsPageSize,
            total,
            totalPages,
            hasNextPage: currentPage < totalPages,
            hasPreviousPage: currentPage > 1,
          },
        },
      },
    },
  };
}
