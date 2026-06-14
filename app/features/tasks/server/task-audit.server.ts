import { and, asc, desc, eq, gte, or } from "drizzle-orm";
import { data } from "react-router";

import { database } from "../../../../database/context";
import { auditLogs, taskEvents, tasks } from "../../../../database/schema";
import { requireAnyRole } from "../../auth/server/authz.server";
import { getRequestContext } from "../../auth/server/request-context.server";
import {
  extractFailureContext,
  extractReviewQueue,
  getTaskAttemptSnapshot,
} from "./task-diagnostics.server";
import { getTaskCurrentStageLabel, getTaskStatusPresentation, type TaskStatus } from "./task-status.server";

const retentionWindowDays = 30;
const retentionWindowMs = retentionWindowDays * 24 * 60 * 60 * 1000;

type TaskSourceSnapshot = {
  title?: string;
};

type TaskPresetSnapshot = {
  status?: string;
  summary?: string;
};

type TaskRecord = {
  id: string;
  creatorUserId: number;
  sourceIdentifier: string;
  sourceSnapshot: Record<string, unknown> | null;
  presetSnapshot: Record<string, unknown> | null;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
};

type TaskEventRecord = {
  id: string;
  taskId: string;
  eventType: string;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  reasonCode: string | null;
  requestId: string;
  actorUserId: number | null;
  payload: Record<string, unknown>;
  createdAt: Date;
};

type AuditLogRecord = {
  id: number;
  requestId: string;
  actorUserId: number | null;
  eventType: string;
  resourceType: string;
  resourceId: string;
  outcome: string;
  detail: Record<string, unknown>;
  occurredAt: Date;
};

export type TaskAuditTimelineItem = {
  id: string;
  kind: "lifecycle" | "preset" | "review" | "failure" | "retry" | "delivery" | "access";
  label: string;
  description: string;
  taskId: string;
  requestId: string;
  occurredAt: string;
  actorLabel: string;
  beforeAfter: string | null;
};

export type TaskAuditAccessLogItem = {
  id: string;
  label: string;
  taskId: string;
  requestId: string;
  occurredAt: string;
  actorLabel: string;
  resourceType: string;
  resourceId: string;
  outcome: string;
  detail: string;
};

export type TaskAuditRecordView = {
  taskId: string;
  sourceIdentifier: string;
  sourceTitle: string;
  currentStatus: TaskStatus;
  currentStatusLabel: string;
  currentStageLabel: string;
  presetPathLabel: string;
  attemptNumber: number;
  originTaskId: string;
  retryOfTaskId: string | null;
  requestId: string | null;
  createdAt: string;
  updatedAt: string;
  retentionNote: string;
  partialHistory: boolean;
  summary: {
    title: string;
    body: string;
  };
  failureSummary: {
    stage: string;
    message: string;
    reasonCode: string | null;
    diagnosticTraceId: string | null;
    retryable: boolean;
  } | null;
  reviewSummary: {
    reviewId: string;
    pendingCount: number;
    confirmedCount: number;
    completedAt: string | null;
    confirmedBy: string;
  } | null;
  manualSummary: {
    actionType: string;
    actorLabel: string;
    occurredAt: string;
    detail: string;
  } | null;
  timeline: TaskAuditTimelineItem[];
  accessLogs: TaskAuditAccessLogItem[];
};

export const taskAuditTestHooks = {
  requireAnyRoleImpl: requireAnyRole,
  getTaskRowByIdImpl: getTaskRowById,
  getTaskEventLedgerImpl: getTaskEventLedger,
  listAuditLogEntriesImpl: listAuditLogEntries,
};

export function setTaskAuditTestHooks(hooks: Partial<typeof taskAuditTestHooks>) {
  taskAuditTestHooks.requireAnyRoleImpl = hooks.requireAnyRoleImpl ?? requireAnyRole;
  taskAuditTestHooks.getTaskRowByIdImpl = hooks.getTaskRowByIdImpl ?? getTaskRowById;
  taskAuditTestHooks.getTaskEventLedgerImpl =
    hooks.getTaskEventLedgerImpl ?? getTaskEventLedger;
  taskAuditTestHooks.listAuditLogEntriesImpl =
    hooks.listAuditLogEntriesImpl ?? listAuditLogEntries;
}

function getSourceTitle(sourceSnapshot: Record<string, unknown> | null, sourceIdentifier: string) {
  const snapshot = sourceSnapshot as TaskSourceSnapshot | null;

  return snapshot?.title ?? sourceIdentifier;
}

function getPresetPathLabel(status: string | undefined) {
  switch (status) {
    case "matched":
      return "自动命中已有预设";
    case "manual_reuse":
      return "手动复用已有预设";
    case "manual_create":
      return "新建最小预设后继续";
    case "continue_without_preset":
      return "未保存预设继续";
    case "unresolved":
      return "仍待预设决策";
    default:
      return "未使用预设";
  }
}

function getActorLabel(actorUserId: number | null) {
  return actorUserId == null ? "system" : `user:${actorUserId}`;
}

function isWithinRetention(createdAt: Date) {
  return Date.now() - createdAt.getTime() <= retentionWindowMs;
}

function getFriendlyEventLabel(eventType: string) {
  switch (eventType) {
    case "task.created":
      return "任务已创建";
    case "task.preset_decision_requested":
      return "预设已决策";
    case "task.review_required":
    case "task.human_review_requested":
      return "人工确认已请求";
    case "task.review_resolved":
      return "人工确认已提交";
    case "task.manual_intervention":
      return "已记录人工介入";
    case "task.retry_requested":
      return "已请求恢复重试";
    case "task.retry_spawned":
      return "新的恢复 attempt 已创建";
    case "task.failed":
      return "任务已失败";
    case "task.completed":
      return "任务已完成";
    case "deliverable.download":
      return "交付物已访问";
    case "authorization.denied":
      return "访问已拒绝";
    case "task.api_query":
      return "任务审计读取";
    case "task.api_deliverable_download":
      return "API 交付物访问";
    default:
      return "生命周期事件";
  }
}

function getAccessAuditLabel(eventType: string) {
  switch (eventType) {
    case "deliverable.download":
      return "交付物访问审计";
    case "authorization.denied":
      return "越权访问拒绝";
    case "task.api_query":
      return "任务读取审计";
    case "task.api_deliverable_download":
      return "API 交付物访问审计";
    default:
      return "敏感访问审计";
  }
}

function getAccessAuditDetail(audit: AuditLogRecord) {
  if (typeof audit.detail.fileName === "string") {
    return `文件：${audit.detail.fileName}`;
  }

  if (audit.eventType === "authorization.denied") {
    return "已记录一次越权访问拒绝。";
  }

  if (audit.eventType === "task.api_query") {
    return "已记录一次任务查询访问。";
  }

  if (audit.eventType === "task.api_deliverable_download") {
    return "已记录一次 API 交付物访问。";
  }

  return "已记录一次敏感访问。";
}

function getPresetTimelineItem(task: TaskRecord): TaskAuditTimelineItem | null {
  const preset = task.presetSnapshot as TaskPresetSnapshot | null;

  if (!preset?.status || preset.status === "none") {
    return null;
  }

  return {
    id: `${task.id}:preset`,
    kind: "preset",
    label: "预设已应用",
    description: preset.summary ?? getPresetPathLabel(preset.status),
    taskId: task.id,
    requestId: "system",
    occurredAt: task.createdAt.toISOString(),
    actorLabel: "system",
    beforeAfter: null,
  };
}

function toTimelineItems(task: TaskRecord, events: TaskEventRecord[], audits: AuditLogRecord[]) {
  const items: TaskAuditTimelineItem[] = [];

  items.push({
    id: `${task.id}:created`,
    kind: "lifecycle",
    label: "任务已创建",
    description: "任务记录已创建。",
    taskId: task.id,
    requestId: events[0]?.requestId ?? "system",
    occurredAt: task.createdAt.toISOString(),
    actorLabel: "system",
    beforeAfter: null,
  });

  const presetItem = getPresetTimelineItem(task);

  if (presetItem) {
    items.push(presetItem);
  }

  for (const event of events) {
    if (event.eventType === "task.created") {
      continue;
    }

    const beforeAfter =
      event.fromStatus === event.toStatus
        ? null
        : `${event.fromStatus} → ${event.toStatus}`;

    items.push({
      id: event.id,
      kind:
        event.eventType === "task.retry_requested" ||
        event.eventType === "task.retry_spawned"
          ? "retry"
          : event.eventType === "task.review_required" ||
              event.eventType === "task.human_review_requested" ||
              event.eventType === "task.review_resolved"
            ? "review"
            : event.eventType === "task.failed"
              ? "failure"
              : event.eventType === "task.manual_intervention"
                ? "review"
                : "lifecycle",
      label: getFriendlyEventLabel(event.eventType),
      description: event.reasonCode
        ? `原因码：${event.reasonCode}`
        : "状态或生命周期信息已记录。",
      taskId: task.id,
      requestId: event.requestId,
      occurredAt: event.createdAt.toISOString(),
      actorLabel: getActorLabel(event.actorUserId),
      beforeAfter,
    });
  }

  for (const audit of audits) {
    if (audit.eventType !== "deliverable.download") {
      continue;
    }

    items.push({
      id: `audit:${audit.id}`,
      kind: "delivery",
      label: "交付物已访问",
      description: [
        audit.resourceType,
        audit.resourceId,
        audit.outcome,
      ].join(" / "),
      taskId: task.id,
      requestId: audit.requestId,
      occurredAt: audit.occurredAt.toISOString(),
      actorLabel: getActorLabel(audit.actorUserId),
      beforeAfter: null,
    });
  }

  return items.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}

function buildAccessLogs(task: TaskRecord, audits: AuditLogRecord[]): TaskAuditAccessLogItem[] {
  return audits
    .filter((audit) =>
      [
        "deliverable.download",
        "authorization.denied",
        "task.api_query",
        "task.api_deliverable_download",
      ].includes(audit.eventType),
    )
    .map((audit) => ({
      id: `audit:${audit.id}`,
      label: getAccessAuditLabel(audit.eventType),
      taskId: task.id,
      requestId: audit.requestId,
      occurredAt: audit.occurredAt.toISOString(),
      actorLabel: getActorLabel(audit.actorUserId),
      resourceType: audit.resourceType,
      resourceId: audit.resourceId,
      outcome: audit.outcome,
      detail: getAccessAuditDetail(audit),
    }))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

function createTaskReadError(
  code: "task_forbidden" | "task_not_found",
  message: string,
  status: number,
): never {
  const { requestId } = getRequestContext();

  throw data(
    {
      code,
      message,
      request_id: requestId,
    },
    {
      status,
      headers: {
        "X-Request-Id": requestId,
      },
    },
  );
}

async function getTaskRowById(taskId: string): Promise<TaskRecord | null> {
  const db = database();
  const [record] = await db
    .select({
      id: tasks.id,
      creatorUserId: tasks.creatorUserId,
      sourceIdentifier: tasks.sourceIdentifier,
      sourceSnapshot: tasks.sourceSnapshot,
      presetSnapshot: tasks.presetSnapshot,
      status: tasks.status,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  return (record as TaskRecord | undefined) ?? null;
}

async function getTaskEventLedger(taskId: string): Promise<TaskEventRecord[]> {
  const db = database();
  const cutoff = new Date(Date.now() - retentionWindowMs);
  const records = await db
    .select({
      id: taskEvents.id,
      taskId: taskEvents.taskId,
      eventType: taskEvents.eventType,
      fromStatus: taskEvents.fromStatus,
      toStatus: taskEvents.toStatus,
      reasonCode: taskEvents.reasonCode,
      requestId: taskEvents.requestId,
      actorUserId: taskEvents.actorUserId,
      payload: taskEvents.payload,
      createdAt: taskEvents.createdAt,
    })
    .from(taskEvents)
    .where(and(eq(taskEvents.taskId, taskId), gte(taskEvents.createdAt, cutoff)))
    .orderBy(asc(taskEvents.createdAt));

  return records.map((record) => ({
    ...(record as Omit<TaskEventRecord, "payload">),
    payload: (record.payload as Record<string, unknown>) ?? {},
  }));
}

async function listAuditLogEntries(taskId: string): Promise<AuditLogRecord[]> {
  const db = database();
  const cutoff = new Date(Date.now() - retentionWindowMs);
  const records = await db
    .select({
      id: auditLogs.id,
      requestId: auditLogs.requestId,
      actorUserId: auditLogs.actorUserId,
      eventType: auditLogs.eventType,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      outcome: auditLogs.outcome,
      detail: auditLogs.detail,
      occurredAt: auditLogs.occurredAt,
    })
    .from(auditLogs)
    .where(
      and(
        gte(auditLogs.occurredAt, cutoff),
        or(eq(auditLogs.resourceId, taskId), eq(auditLogs.resourceType, "deliverable")),
      ),
    )
    .orderBy(desc(auditLogs.occurredAt));

  return records
    .map((record) => ({
      ...(record as Omit<AuditLogRecord, "detail">),
      detail: (record.detail as Record<string, unknown>) ?? {},
    }))
    .filter((record) => record.resourceId === taskId || record.detail.taskId === taskId);
}

function buildFailureSummary(events: TaskEventRecord[]) {
  const failure = extractFailureContext(events);

  if (!failure) {
    return null;
  }

  return {
    stage: failure.stage,
    message: failure.message,
    reasonCode: failure.reasonCode,
    diagnosticTraceId: failure.diagnosticTraceId,
    retryable: failure.retryable,
  };
}

function buildReviewSummary(taskId: string, events: TaskEventRecord[]) {
  const reviewQueue = extractReviewQueue(events);

  if (!reviewQueue) {
    return null;
  }

  const confirmedCount = reviewQueue.resolvedDecisions.length;
  const completedAt = events
    .slice()
    .reverse()
    .find((event) => event.eventType === "task.review_resolved")
    ?.createdAt.toISOString() ?? null;

  return {
    reviewId: reviewQueue.reviewId,
    pendingCount: reviewQueue.pendingCount,
    confirmedCount,
    completedAt,
    confirmedBy: completedAt ? "system" : "待确认",
  };
}

function buildManualSummary(events: TaskEventRecord[], audits: AuditLogRecord[]) {
  const event = [...events]
    .reverse()
    .find((entry) => entry.eventType === "task.manual_intervention");

  if (event) {
    return {
      actionType: "task.manual_intervention",
      actorLabel: getActorLabel(event.actorUserId),
      occurredAt: event.createdAt.toISOString(),
      detail:
        typeof event.payload.note === "string" && event.payload.note
          ? event.payload.note
          : "已记录一次人工介入。",
    };
  }

  const audit = [...audits]
    .reverse()
    .find((entry) => entry.eventType === "authorization.denied" || entry.eventType === "deliverable.download");

  if (!audit) {
    return null;
  }

  return {
    actionType: audit.eventType,
    actorLabel: getActorLabel(audit.actorUserId),
    occurredAt: audit.occurredAt.toISOString(),
    detail: audit.outcome,
  };
}

export async function loadTaskAuditViewModel(args: {
  request: Request;
  taskId: string;
}): Promise<TaskAuditRecordView> {
  const task = await taskAuditTestHooks.getTaskRowByIdImpl(args.taskId);

  if (!task) {
    createTaskReadError("task_not_found", "任务不存在，或当前链接已经失效。", 404);
  }

  const events = await taskAuditTestHooks.getTaskEventLedgerImpl(args.taskId);
  const audits = await taskAuditTestHooks.listAuditLogEntriesImpl(args.taskId);
  const latestEvent = events.at(-1) ?? null;
  const attempt = getTaskAttemptSnapshot(task.sourceSnapshot, task.id);
  const failureSummary = buildFailureSummary(events);
  const reviewSummary = buildReviewSummary(task.id, events);
  const manualSummary = buildManualSummary(events, audits);
  const timeline = toTimelineItems(task, events, audits);
  const accessLogs = buildAccessLogs(task, audits);
  const retentionFilteredOut = !isWithinRetention(task.createdAt);
  const retentionNote = retentionFilteredOut
    ? "当前任务创建时间早于 30 天保留窗口，以下仅展示窗口内仍可查询到的关键审计记录。"
    : "当前仅展示 30 天保留窗口内的关键审计记录。";

  return {
    taskId: task.id,
    sourceIdentifier: task.sourceIdentifier,
    sourceTitle: getSourceTitle(task.sourceSnapshot, task.sourceIdentifier),
    currentStatus: task.status,
    currentStatusLabel: getTaskStatusPresentation(task.status).label,
    currentStageLabel: getTaskCurrentStageLabel(task.status, {
      lastActiveStatus: latestEvent?.fromStatus ?? null,
    }),
    presetPathLabel: getPresetPathLabel((task.presetSnapshot as TaskPresetSnapshot | null)?.status),
    attemptNumber: attempt.attemptNumber,
    originTaskId: attempt.originTaskId,
    retryOfTaskId: attempt.retryOfTaskId,
    requestId: latestEvent?.requestId ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    retentionNote,
    partialHistory: retentionFilteredOut,
    summary: {
      title: "最小审计记录",
      body: `任务 ${task.id} 的可查询审计记录已按结构化方式整理。`,
    },
    failureSummary,
    reviewSummary,
    manualSummary,
    timeline,
    accessLogs,
  };
}

export async function loadTaskAuditForAuthorizedRole(args: {
  request: Request;
  taskId: string;
  authenticatedSession: {
    user: { id: number };
    session: { id: string };
  };
}) {
  await taskAuditTestHooks.requireAnyRoleImpl(args.authenticatedSession as never, ["support", "ops", "admin"], {
    type: "task-audit",
    id: args.taskId,
  });

  return loadTaskAuditViewModel({
    request: args.request,
    taskId: args.taskId,
  });
}
