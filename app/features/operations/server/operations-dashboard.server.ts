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

type DrilldownFilterKey =
  | "all"
  | "preset_path"
  | "preset_group"
  | "source"
  | "abnormal_type";

type DrilldownTaskFilter = {
  kind: DrilldownFilterKey;
  value: string | null;
};

type OperationsPresetGroup = "resolved" | "missed";

type OperationsAbnormalType =
  | "preset_decision"
  | "human_review"
  | "failed"
  | "retry";

type SourceSnapshot = {
  title?: string;
};

type PresetSnapshot = {
  status?: string;
  summary?: string;
};

export type OperationsMetricCard = {
  id: "preset-coverage" | "repeat-misses" | "time-to-start" | "time-to-complete" | "friction";
  eyebrow: string;
  title: string;
  value: string;
  supportingText: string;
  explanation: string;
  tone: "neutral" | "good" | "warning";
  drilldownHref: string;
  empty: boolean;
};

export type OperationsTopMissSource = {
  sourceIdentifier: string;
  sourceTitle: string;
  missCount: number;
  latestSeenAt: string;
  latestPathLabel: string;
  drilldownHref: string;
};

export type OperationsTaskListItem = TaskListItem & {
  presetPathLabel: string;
  operationsInsight: string;
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
  topMissSources: OperationsTopMissSource[];
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

function normalizeFriction(value: string | null) {
  switch (value) {
    case "preset_decision":
    case "human_review":
    case "failed":
    case "retry":
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

  if (filter === "source") {
    return {
      kind: "source",
      value: url.searchParams.get("source")?.trim() || null,
    };
  }

  if (filter === "preset_group") {
    const group = url.searchParams.get("presetGroup");

    return {
      kind: "preset_group",
      value: group === "resolved" || group === "missed" ? group : null,
    };
  }

  if (filter === "abnormal_type" || filter === "friction") {
    return {
      kind: "abnormal_type",
      value: normalizeFriction(
        url.searchParams.get("abnormalType") ?? url.searchParams.get("friction"),
      ),
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
      return "未命中或未沉淀为预设";
    case "unresolved":
      return "仍待预设决策";
  }
}

function formatDurationMinutes(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "暂无足够数据";
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

function average(numbers: number[]) {
  if (numbers.length === 0) {
    return null;
  }

  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function buildOperationsInsight(task: OperationTaskRecord, events: OperationTaskEventRecord[]) {
  const presetPath = getPresetPath(task);
  const failedEvent = events.find((event) => event.eventType === "task.failed");
  const reviewEvent = events.find((event) =>
    event.eventType === "task.review_required" ||
    event.eventType === "task.human_review_requested",
  );
  const retryEvent = events.find((event) => event.eventType === "task.retry_requested");
  const presetDecisionEvent = events.find(
    (event) => event.eventType === "task.preset_decision_requested",
  );

  if (failedEvent) {
    return `主要摩擦点：处理失败${failedEvent.reasonCode ? `（${failedEvent.reasonCode}）` : ""}`;
  }

  if (reviewEvent) {
    return "主要摩擦点：进入人工确认队列";
  }

  if (retryEvent) {
    return "主要摩擦点：触发了恢复重试";
  }

  if (presetDecisionEvent) {
    return "主要摩擦点：等待预设决策";
  }

  return `当前路径：${getPresetPathLabel(presetPath)}`;
}

function buildTaskListItem(task: OperationTaskRecord, events: OperationTaskEventRecord[]): OperationsTaskListItem {
  const latestEvent = events.at(-1) ?? null;
  const statusPresentation = getTaskStatusPresentation(task.status);
  const presetPath = getPresetPath(task);
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
      }[latestEvent.eventType] ?? statusPresentation.label
    : statusPresentation.label;

  return {
    id: task.id,
    status: task.status,
    statusLabel: statusPresentation.label,
    statusTone: statusPresentation.tone,
    intakeMethod: task.intakeMethod,
    sourceIdentifier: task.sourceIdentifier,
    sourceTitle: getSourceTitle(task),
    latestEventType: latestEvent?.eventType ?? null,
    latestEventAt: latestEvent?.createdAt.toISOString() ?? null,
    latestProgressLabel,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    presetPathLabel: getPresetPathLabel(presetPath),
    operationsInsight: buildOperationsInsight(task, events),
  };
}

function isMissPath(path: OperationPresetPath) {
  return path === "continue_without_preset" || path === "unresolved";
}

function isResolvedPath(path: OperationPresetPath) {
  return path === "matched" || path === "manual_create" || path === "manual_reuse";
}

function matchesAbnormalType(
  task: OperationTaskRecord,
  events: OperationTaskEventRecord[],
  filter: string,
) {
  switch (filter) {
    case "preset_decision":
      return events.some((event) => event.eventType === "task.preset_decision_requested");
    case "human_review":
      return events.some(
        (event) =>
          event.eventType === "task.review_required" ||
          event.eventType === "task.human_review_requested",
      );
    case "failed":
      return events.some((event) => event.eventType === "task.failed");
    case "retry":
      return events.some((event) => event.eventType === "task.retry_requested");
    default:
      return false;
  }
}

function buildDrilldownHref(filter: DrilldownTaskFilter, page = 1) {
  const search = new URLSearchParams();

  if (page > 1) {
    search.set("page", String(page));
  }

  if (filter.kind === "preset_path" && filter.value) {
    search.set("filter", "preset_path");
    search.set("presetPath", filter.value);
  }

  if (filter.kind === "source" && filter.value) {
    search.set("filter", "source");
    search.set("source", filter.value);
  }

  if (filter.kind === "preset_group" && filter.value) {
    search.set("filter", "preset_group");
    search.set("presetGroup", filter.value);
  }

  if (filter.kind === "abnormal_type" && filter.value) {
    search.set("filter", "abnormal_type");
    search.set("abnormalType", filter.value);
  }

  const suffix = search.toString();

  return suffix ? `/operations?${suffix}` : "/operations";
}

function buildNavigation() {
  return [
    { label: "运营判断台", href: "/operations", state: "active" as const },
    { label: "创作者工作台", href: "/workspace", state: "idle" as const },
  ];
}

async function listOperationTasks(limit = operationsRetentionTaskLimit): Promise<OperationTaskRecord[]> {
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

async function listOperationTaskEvents(taskIds: string[]): Promise<OperationTaskEventRecord[]> {
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

function getAbnormalTypeLabel(type: OperationsAbnormalType) {
  switch (type) {
    case "preset_decision":
      return "等待预设决策";
    case "human_review":
      return "人工确认";
    case "failed":
      return "处理失败";
    case "retry":
      return "恢复重试";
  }
}

function buildMetrics(tasksWithEvents: Array<{ task: OperationTaskRecord; events: OperationTaskEventRecord[] }>) {
  const presetCounts = {
    matched: 0,
    manual_create: 0,
    manual_reuse: 0,
    continue_without_preset: 0,
    unresolved: 0,
  };
  const startDurations: number[] = [];
  const completionDurations: number[] = [];
  const frictionCounts = {
    preset_decision: 0,
    human_review: 0,
    failed: 0,
    retry: 0,
  };
  const missSourceMap = new Map<
    string,
    {
      sourceTitle: string;
      missCount: number;
      latestSeenAt: Date;
      latestPathLabel: string;
    }
  >();

  for (const { task, events } of tasksWithEvents) {
    const presetPath = getPresetPath(task);
    presetCounts[presetPath] += 1;

    if (isMissPath(presetPath)) {
      const current = missSourceMap.get(task.sourceIdentifier);
      const latestPathLabel = getPresetPathLabel(presetPath);

      if (!current) {
        missSourceMap.set(task.sourceIdentifier, {
          sourceTitle: getSourceTitle(task),
          missCount: 1,
          latestSeenAt: task.updatedAt,
          latestPathLabel,
        });
      } else {
        current.missCount += 1;
        if (task.updatedAt > current.latestSeenAt) {
          current.latestSeenAt = task.updatedAt;
          current.latestPathLabel = latestPathLabel;
        }
      }
    }

    const firstProcessingEvent = events.find(
      (event) => event.eventType === "task.queued" || event.eventType === "task.processing",
    );
    const completedEvent = events.find((event) => event.eventType === "task.completed");

    if (firstProcessingEvent) {
      startDurations.push(
        (firstProcessingEvent.createdAt.getTime() - task.createdAt.getTime()) / 60000,
      );
    }

    if (completedEvent) {
      completionDurations.push(
        (completedEvent.createdAt.getTime() - task.createdAt.getTime()) / 60000,
      );
    }

    if (events.some((event) => event.eventType === "task.preset_decision_requested")) {
      frictionCounts.preset_decision += 1;
    }

    if (
      events.some(
        (event) =>
          event.eventType === "task.review_required" ||
          event.eventType === "task.human_review_requested",
      )
    ) {
      frictionCounts.human_review += 1;
    }

    if (events.some((event) => event.eventType === "task.failed")) {
      frictionCounts.failed += 1;
    }

    if (events.some((event) => event.eventType === "task.retry_requested")) {
      frictionCounts.retry += 1;
    }
  }

  const total = tasksWithEvents.length;
  const resolvedCount =
    presetCounts.matched + presetCounts.manual_create + presetCounts.manual_reuse;
  const topFrictionEntry =
    Object.entries(frictionCounts).sort((a, b) => b[1] - a[1])[0] ?? null;

  return {
    cards: [
      {
        id: "preset-coverage",
        eyebrow: "核心价值",
        title: "自动命中与复用占比",
        value:
          total > 0
            ? `${Math.round((resolvedCount / total) * 100)}%`
            : "暂无足够数据",
        supportingText:
          total > 0
            ? `共 ${total} 条任务中，${resolvedCount} 条直接体现了预设资产复用。`
            : "当前保留窗口内还没有可用于判断预设价值的任务样本。",
        explanation:
          total > 0
            ? `自动命中 ${presetCounts.matched} 条，手动复用 ${presetCounts.manual_reuse} 条，新建最小预设后继续 ${presetCounts.manual_create} 条。`
            : "暂无足够数据",
        tone: total > 0 && resolvedCount / total >= 0.6 ? "good" : "warning",
        drilldownHref: buildDrilldownHref({
          kind: "preset_group",
          value: "resolved",
        }),
        empty: total === 0,
      },
      {
        id: "repeat-misses",
        eyebrow: "覆盖缺口",
        title: "反复未命中来源",
        value:
          missSourceMap.size > 0
            ? `${[...missSourceMap.values()].filter((item) => item.missCount >= 2).length} 个来源`
            : "暂无足够数据",
        supportingText:
          missSourceMap.size > 0
            ? "帮助判断是来源识别问题、预设覆盖不足，还是流程没有沉淀为资产。"
            : "当前没有发现明确的反复未命中来源。",
        explanation:
          missSourceMap.size > 0
            ? "只统计未命中或未沉淀为预设的样本。"
            : "暂无足够数据",
        tone: missSourceMap.size > 0 ? "warning" : "neutral",
        drilldownHref: buildDrilldownHref({
          kind: "preset_group",
          value: "missed",
        }),
        empty: missSourceMap.size === 0,
      },
      {
        id: "time-to-start",
        eyebrow: "速度表现",
        title: "进入处理耗时",
        value: formatDurationMinutes(average(startDurations) ?? Number.NaN),
        supportingText:
          startDurations.length > 0
            ? `基于 ${startDurations.length} 条具备 queued/processing 事件链的任务计算。`
            : "缺少 queued 或 processing 事件，暂时无法给出可靠耗时。",
        explanation: "口径：任务创建到首个 queued/processing 事件。",
        tone: startDurations.length > 0 ? "neutral" : "warning",
        drilldownHref: buildDrilldownHref({ kind: "all", value: null }),
        empty: startDurations.length === 0,
      },
      {
        id: "time-to-complete",
        eyebrow: "交付表现",
        title: "完成耗时",
        value: formatDurationMinutes(average(completionDurations) ?? Number.NaN),
        supportingText:
          completionDurations.length > 0
            ? `基于 ${completionDurations.length} 条具备 completed 事件的任务计算。`
            : "当前没有足够的 completed 事件链样本。",
        explanation: "口径：任务创建到 completed 事件。",
        tone: completionDurations.length > 0 ? "neutral" : "warning",
        drilldownHref: buildDrilldownHref({ kind: "all", value: null }),
        empty: completionDurations.length === 0,
      },
      {
        id: "friction",
        eyebrow: "流程摩擦",
        title: "最常见摩擦点",
        value:
          topFrictionEntry && topFrictionEntry[1] > 0
            ? getAbnormalTypeLabel(topFrictionEntry[0] as OperationsAbnormalType)
            : "暂无足够数据",
        supportingText:
          topFrictionEntry && topFrictionEntry[1] > 0
            ? `共有 ${topFrictionEntry[1]} 条任务命中这一类摩擦事件。`
            : "当前没有记录到明确的失败、人工确认、重试或预设决策摩擦。",
        explanation: "来自事件账本中的失败、人工确认、retry 与预设决策请求事件。",
        tone: topFrictionEntry && topFrictionEntry[1] > 0 ? "warning" : "neutral",
        drilldownHref:
          topFrictionEntry && topFrictionEntry[1] > 0
            ? buildDrilldownHref({
                kind: "abnormal_type",
                value: topFrictionEntry[0],
              })
            : buildDrilldownHref({ kind: "all", value: null }),
        empty: !topFrictionEntry || topFrictionEntry[1] === 0,
      },
    ] satisfies OperationsMetricCard[],
    topMissSources: [...missSourceMap.entries()]
      .map(([sourceIdentifier, value]) => ({
        sourceIdentifier,
        sourceTitle: value.sourceTitle,
        missCount: value.missCount,
        latestSeenAt: value.latestSeenAt.toISOString(),
        latestPathLabel: value.latestPathLabel,
        drilldownHref: buildDrilldownHref({
          kind: "source",
          value: sourceIdentifier,
        }),
      }))
      .sort((a, b) => b.missCount - a.missCount || b.latestSeenAt.localeCompare(a.latestSeenAt))
      .slice(0, 5),
  };
}

function filterTasks(
  tasksWithEvents: Array<{ task: OperationTaskRecord; events: OperationTaskEventRecord[] }>,
  drilldown: DrilldownTaskFilter,
) {
  switch (drilldown.kind) {
    case "preset_path":
      return drilldown.value
        ? tasksWithEvents.filter(({ task }) => getPresetPath(task) === drilldown.value)
        : tasksWithEvents;
    case "preset_group":
      return drilldown.value === "resolved"
        ? tasksWithEvents.filter(({ task }) => isResolvedPath(getPresetPath(task)))
        : drilldown.value === "missed"
          ? tasksWithEvents.filter(({ task }) => isMissPath(getPresetPath(task)))
          : tasksWithEvents;
    case "source":
      return drilldown.value
        ? tasksWithEvents.filter(({ task }) => task.sourceIdentifier === drilldown.value)
        : tasksWithEvents;
    case "abnormal_type":
      return drilldown.value
        ? tasksWithEvents.filter(({ task, events }) =>
            matchesAbnormalType(task, events, drilldown.value ?? ""),
          )
        : tasksWithEvents;
    case "all":
    default:
      return tasksWithEvents;
  }
}

function buildDrilldownMeta(drilldown: DrilldownTaskFilter) {
  switch (drilldown.kind) {
    case "preset_path":
      return {
        activeLabel: drilldown.value
          ? `当前按预设路径筛选：${getPresetPathLabel(drilldown.value as OperationPresetPath)}`
          : "当前查看全部任务",
        helperText: "用于回看这一类预设路径下的最近任务和摩擦表现。",
      };
    case "source":
      return {
        activeLabel: drilldown.value
          ? `当前按来源频道筛选：${drilldown.value}`
          : "当前查看全部任务",
        helperText: "用于确认某个来源频道为何反复没有沉淀成可复用预设。",
      };
    case "preset_group":
      return {
        activeLabel:
          drilldown.value === "resolved"
            ? "当前按预设结果筛选：自动命中与复用样本"
            : drilldown.value === "missed"
              ? "当前按预设结果筛选：反复未命中样本"
              : "当前查看全部任务",
        helperText: "用于回看这一组指标背后的任务样本，而不是只看单一路径。",
      };
    case "abnormal_type":
      return {
        activeLabel:
          drilldown.value === "preset_decision"
            ? "当前按异常类型筛选：等待预设决策"
            : drilldown.value === "human_review"
              ? "当前按异常类型筛选：人工确认"
              : drilldown.value === "failed"
                ? "当前按异常类型筛选：处理失败"
                : drilldown.value === "retry"
                  ? "当前按异常类型筛选：恢复重试"
                  : "当前查看全部任务",
        helperText: "用于快速看到这一类异常最常出现在哪些任务上。",
      };
    case "all":
    default:
      return {
        activeLabel: "当前查看全部任务",
        helperText: "从指标卡或来源列表进入筛选后，会在这里看到对应任务范围。",
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
  const tasks = await operationsDashboardTestHooks.listOperationTasksImpl(
    operationsRetentionTaskLimit,
  );
  const events = await operationsDashboardTestHooks.listOperationTaskEventsImpl(
    tasks.map((task) => task.id),
  );
  const groupedEvents = groupEventsByTask(events);
  const tasksWithEvents = tasks.map((task) => ({
    task,
    events: groupedEvents.get(task.id) ?? [],
  }));
  const { cards, topMissSources } = buildMetrics(tasksWithEvents);
  const filtered = filterTasks(tasksWithEvents, drilldown);
  const pageSize = 10;
  const total = filtered.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const currentPage =
    totalPages === 0 ? 1 : Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
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
        "这一页只保留第一版最关键的 3 到 5 组判断信号，帮助运营快速看清预设复用、反复未命中来源、关键耗时与流程摩擦点。",
      scopeNote:
        "统计口径：仅基于当前可见任务与已落库事件计算；缺少事件链的指标会明确标记“暂无足够数据”。",
    },
    metricCards: cards,
    topMissSources,
    drilldown: {
      activeLabel: drilldownMeta.activeLabel,
      helperText: drilldownMeta.helperText,
      emptyTitle: "暂无匹配任务",
      emptyBody: "当前筛选范围内还没有足够样本，请切换回全部任务或从其他指标继续下钻。",
      resetHref: "/operations",
      taskList: {
        data: paginated.map(({ task, events }) => buildTaskListItem(task, events)),
        meta: {
          pagination: {
            page: currentPage,
            pageSize,
            total,
            totalPages,
            hasNextPage: total > currentPage * pageSize,
            hasPreviousPage: currentPage > 1,
          },
        },
      },
    },
  };
}
