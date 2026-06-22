import { asc, desc, inArray } from "drizzle-orm";

import { database } from "../../../../database/context";
import { taskEvents, tasks, type AllowedRole } from "../../../../database/schema";
import { requireAnyRole } from "../../auth/server/authz.server";
import {
  getCurrentUserRoles,
  requireUserSession,
  type AuthenticatedSession,
} from "../../auth/server/session.server";
import type { OperationsTaskListItem } from "./operations-dashboard.server";
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

type SourceSnapshot = {
  title?: string;
};

type PresetSnapshot = {
  status?: string;
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

type SourceOutcomeCounts = {
  manualReuse: number;
  manualCreate: number;
  continueWithoutPreset: number;
  unresolved: number;
};

export type NonMatchSourceBreakdownItem = {
  sourceIdentifier: string;
  sourceTitle: string;
  nonMatchCount: number;
  lastSeenAt: string;
  dominantReason: string;
  outcomeSummary: string;
  counts: SourceOutcomeCounts;
  drilldownHref: string;
};

export type OperationsNonMatchAnalysisViewModel = {
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
  activeSourceIdentifier: string | null;
  channels: NonMatchSourceBreakdownItem[];
  drilldown: {
    activeLabel: string;
    helperText: string;
    emptyTitle: string;
    emptyBody: string;
    resetHref: string;
    taskList: {
      data: OperationsTaskListItem[];
      meta: {
        pagination: {
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
          hasNextPage: boolean;
          hasPreviousPage: boolean;
        };
      };
    };
  };
};

export const operationsNonMatchAnalysisTestHooks = {
  requireUserSessionImpl: requireUserSession,
  getCurrentUserRolesImpl: getCurrentUserRoles,
  requireAnyRoleImpl: requireAnyRole,
  listOperationTasksImpl: listOperationTasks,
  listOperationTaskEventsImpl: listOperationTaskEvents,
};

export function setOperationsNonMatchAnalysisTestHooks(
  hooks: Partial<typeof operationsNonMatchAnalysisTestHooks>,
) {
  operationsNonMatchAnalysisTestHooks.requireUserSessionImpl =
    hooks.requireUserSessionImpl ?? requireUserSession;
  operationsNonMatchAnalysisTestHooks.getCurrentUserRolesImpl =
    hooks.getCurrentUserRolesImpl ?? getCurrentUserRoles;
  operationsNonMatchAnalysisTestHooks.requireAnyRoleImpl =
    hooks.requireAnyRoleImpl ?? requireAnyRole;
  operationsNonMatchAnalysisTestHooks.listOperationTasksImpl =
    hooks.listOperationTasksImpl ?? listOperationTasks;
  operationsNonMatchAnalysisTestHooks.listOperationTaskEventsImpl =
    hooks.listOperationTaskEventsImpl ?? listOperationTaskEvents;
}

function normalizePage(value: string | null) {
  const page = Number(value ?? "1");

  if (Number.isNaN(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

function normalizeSourceIdentifier(value: string | null) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
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

function buildNavigation() {
  return [
    { label: "核心指标总览", href: "/operations", state: "idle" as const },
    {
      label: "反复未命中频道",
      href: "/operations/non-match-sources",
      state: "active" as const,
    },
    { label: "创作者工作台", href: "/workspace", state: "idle" as const },
  ];
}

function buildDrilldownHref(sourceIdentifier: string | null, page = 1) {
  const search = new URLSearchParams();

  if (page > 1) {
    search.set("page", String(page));
  }

  if (sourceIdentifier) {
    search.set("source", sourceIdentifier);
  }

  const suffix = search.toString();

  return suffix
    ? `/operations/non-match-sources?${suffix}`
    : "/operations/non-match-sources";
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
  taskRows: OperationTaskRecord[],
  groupedEvents: Map<string, OperationTaskEventRecord[]>,
) {
  return taskRows.map((task) => {
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

function buildEmptyOutcomeCounts(): SourceOutcomeCounts {
  return {
    manualReuse: 0,
    manualCreate: 0,
    continueWithoutPreset: 0,
    unresolved: 0,
  };
}

function describeDominantReason(counts: SourceOutcomeCounts) {
  const coverageGapScore = counts.manualCreate + counts.continueWithoutPreset;

  if (counts.unresolved >= counts.manualReuse && counts.unresolved >= coverageGapScore) {
    return "当前仍有任务停留在预设决策，尚未形成稳定去向。";
  }

  if (counts.manualReuse >= coverageGapScore && counts.manualReuse > 0) {
    return "已有预设可复用，但自动命中仍不稳定，优先检查识别与匹配策略。";
  }

  if (coverageGapScore > 0) {
    return "预设覆盖不足或流程沉淀仍不充分，任务仍依赖人工补建或跳过。";
  }

  return "需要更多样本才能判断主要未命中原因。";
}

function formatOutcomeSummary(counts: SourceOutcomeCounts) {
  return `手动复用 ${counts.manualReuse} / 新建预设 ${counts.manualCreate} / 未保存继续 ${counts.continueWithoutPreset} / 待决策 ${counts.unresolved}`;
}

function buildSourceBreakdown(samples: OperationsTaskSample[]) {
  const grouped = new Map<
    string,
    {
      title: string;
      lastSeenAt: Date;
      counts: SourceOutcomeCounts;
    }
  >();

  for (const sample of samples) {
    if (!sample.task.sourceIdentifier.trim()) {
      continue;
    }

    const existing = grouped.get(sample.task.sourceIdentifier) ?? {
      title: getSourceTitle(sample.task),
      lastSeenAt: sample.task.updatedAt,
      counts: buildEmptyOutcomeCounts(),
    };

    if (sample.task.updatedAt > existing.lastSeenAt) {
      existing.lastSeenAt = sample.task.updatedAt;
      existing.title = getSourceTitle(sample.task);
    }

    switch (sample.presetPath) {
      case "manual_reuse":
        existing.counts.manualReuse += 1;
        break;
      case "manual_create":
        existing.counts.manualCreate += 1;
        break;
      case "continue_without_preset":
        existing.counts.continueWithoutPreset += 1;
        break;
      case "unresolved":
        existing.counts.unresolved += 1;
        break;
      case "matched":
        break;
    }

    grouped.set(sample.task.sourceIdentifier, existing);
  }

  return [...grouped.entries()]
    .map(([sourceIdentifier, group]) => {
      const nonMatchCount =
        group.counts.manualReuse +
        group.counts.manualCreate +
        group.counts.continueWithoutPreset +
        group.counts.unresolved;

      return {
        sourceIdentifier,
        sourceTitle: group.title,
        nonMatchCount,
        lastSeenAt: group.lastSeenAt.toISOString(),
        dominantReason: describeDominantReason(group.counts),
        outcomeSummary: formatOutcomeSummary(group.counts),
        counts: group.counts,
        drilldownHref: buildDrilldownHref(sourceIdentifier),
      } satisfies NonMatchSourceBreakdownItem;
    })
    .sort((left, right) => {
      if (right.nonMatchCount !== left.nonMatchCount) {
        return right.nonMatchCount - left.nonMatchCount;
      }

      if (right.lastSeenAt !== left.lastSeenAt) {
        return right.lastSeenAt.localeCompare(left.lastSeenAt);
      }

      return left.sourceIdentifier.localeCompare(right.sourceIdentifier);
    });
}

function buildDrilldownMeta(
  selectedSource: string | null,
  channels: NonMatchSourceBreakdownItem[],
) {
  if (!selectedSource) {
    return {
      activeLabel: "当前查看全部未自动命中预设的任务",
      helperText:
        "选择左侧来源频道后，这里会聚焦该频道的未命中任务样本，保留任务 id、预设去向与关键阶段时间戳。",
    };
  }

  const matchedChannel = channels.find(
    (item) => item.sourceIdentifier === selectedSource,
  );

  if (!matchedChannel) {
    return {
      activeLabel: `当前来源频道在保留窗口内没有可用样本：${selectedSource}`,
      helperText:
        "可能是当前筛选参数已过期，或该频道样本已经不在最近保留窗口内。可切回全部未命中任务继续查看。",
    };
  }

  return {
    activeLabel: `当前按来源频道筛选：${matchedChannel.sourceTitle}`,
    helperText:
      "该列表只保留这个来源频道下未自动命中预设的任务，用于判断到底是资产覆盖不足，还是识别/匹配策略仍不稳定。",
  };
}

export async function loadOperationsNonMatchAnalysisViewModel(args: {
  request: Request;
  context: OperationsContext;
}): Promise<OperationsNonMatchAnalysisViewModel> {
  const authenticated =
    (await operationsNonMatchAnalysisTestHooks.requireUserSessionImpl(
      args.request,
    )) as AuthenticatedSession;
  const roles = await operationsNonMatchAnalysisTestHooks.getCurrentUserRolesImpl(
    authenticated.user.id,
  );

  await operationsNonMatchAnalysisTestHooks.requireAnyRoleImpl(
    authenticated,
    ["ops", "admin"],
    {
      type: "operations-dashboard",
      id: "ops-home",
    },
  );

  const url = new URL(args.request.url);
  const selectedSource = normalizeSourceIdentifier(url.searchParams.get("source"));
  const page = normalizePage(url.searchParams.get("page"));
  const taskRows = await operationsNonMatchAnalysisTestHooks.listOperationTasksImpl(
    operationsRetentionTaskLimit,
  );
  const eventRows =
    await operationsNonMatchAnalysisTestHooks.listOperationTaskEventsImpl(
      taskRows.map((task) => task.id),
    );
  const groupedEvents = groupEventsByTask(eventRows);
  const samples = buildTaskSamples(taskRows, groupedEvents);
  const nonMatchSamples = samples.filter(
    (sample) =>
      sample.sourceRecognitionComplete && sample.presetPath !== "matched",
  );
  const channels = buildSourceBreakdown(nonMatchSamples);
  const filteredSamples = selectedSource
    ? nonMatchSamples.filter(
        (sample) => sample.task.sourceIdentifier === selectedSource,
      )
    : nonMatchSamples;
  const total = filteredSamples.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / operationsPageSize);
  const currentPage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * operationsPageSize;
  const paginatedSamples = filteredSamples.slice(
    pageStart,
    pageStart + operationsPageSize,
  );
  const repeatedSources = channels.filter((item) => item.nonMatchCount >= 2).length;
  const drilldownMeta = buildDrilldownMeta(selectedSource, channels);

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
    pageTitle: "Yakimoji Operations Non-match Sources",
    navigation: buildNavigation(),
    summary: {
      title: "来源频道反复未命中分析",
      lede:
        nonMatchSamples.length > 0
          ? `当前保留窗口内共识别到 ${nonMatchSamples.length} 条未自动命中预设的任务，涉及 ${channels.length} 个来源频道，其中 ${repeatedSources} 个来源至少出现 2 次未命中。`
          : "当前保留窗口内还没有足够样本可用于判断哪些来源频道反复未命中预设。",
      scopeNote: `统计口径：默认基于最近 ${operationsRetentionTaskLimit} 条任务，只统计来源已识别但未自动命中已有预设的样本；其中会保留手动复用、新建预设、未保存继续和待决策四类去向。`,
    },
    activeSourceIdentifier: selectedSource,
    channels,
    drilldown: {
      activeLabel: drilldownMeta.activeLabel,
      helperText: drilldownMeta.helperText,
      emptyTitle: "暂无匹配任务",
      emptyBody:
        "当前来源频道在保留窗口内没有未命中任务样本，请切回全部来源频道或检查其他运营信号。",
      resetHref: "/operations/non-match-sources",
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
