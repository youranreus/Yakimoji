import { and, asc, desc, eq, gte, or } from "drizzle-orm";
import { data } from "react-router";

import { database } from "../../../../database/context";
import { auditLogs, taskEvents, tasks } from "../../../../database/schema";
import { requireAnyRole } from "../../auth/server/authz.server";
import { writeAuditLog } from "../../auth/server/audit.server";
import { getRequestContext } from "../../auth/server/request-context.server";
import {
  extractFailureContext,
  extractReviewQueue,
  getTaskAttemptSnapshot,
  type TaskEventLike,
} from "./task-diagnostics.server";
import {
  getTaskCurrentStageLabel,
  getTaskStatusPresentation,
  type TaskStatus,
} from "./task-status.server";

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

type TaskEventRecord = TaskEventLike & {
  taskId: string;
  actorUserId: number | null;
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
  kind:
    | "lifecycle"
    | "preset"
    | "review"
    | "failure"
    | "retry"
    | "delivery"
    | "support";
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
  writeAuditLogImpl: writeAuditLog,
  getTaskRowByIdImpl: getTaskRowById,
  getTaskEventLedgerImpl: getTaskEventLedger,
  listAuditLogEntriesImpl: listAuditLogEntries,
};

export function setTaskAuditTestHooks(hooks: Partial<typeof taskAuditTestHooks>) {
  taskAuditTestHooks.requireAnyRoleImpl = hooks.requireAnyRoleImpl ?? requireAnyRole;
  taskAuditTestHooks.writeAuditLogImpl = hooks.writeAuditLogImpl ?? writeAuditLog;
  taskAuditTestHooks.getTaskRowByIdImpl = hooks.getTaskRowByIdImpl ?? getTaskRowById;
  taskAuditTestHooks.getTaskEventLedgerImpl =
    hooks.getTaskEventLedgerImpl ?? getTaskEventLedger;
  taskAuditTestHooks.listAuditLogEntriesImpl =
    hooks.listAuditLogEntriesImpl ?? listAuditLogEntries;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

function getTimelineKind(eventType: string): TaskAuditTimelineItem["kind"] {
  switch (eventType) {
    case "task.preset_decision_requested":
      return "preset";
    case "task.review_required":
    case "task.human_review_requested":
    case "task.review_resolved":
      return "review";
    case "task.failed":
      return "failure";
    case "task.retry_requested":
    case "task.retry_spawned":
      return "retry";
    case "task.manual_intervention":
      return "support";
    default:
      return "lifecycle";
  }
}

function getTimelineLabel(eventType: string) {
  switch (eventType) {
    case "task.created":
      return "任务已创建";
    case "task.preset_decision_requested":
      return "预设决策已记录";
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
    default:
      return "任务状态已变化";
  }
}

function getTimelineDescription(event: TaskEventRecord) {
  switch (event.eventType) {
    case "task.preset_decision_requested": {
      const resolution =
        readString(event.payload.presetResolution) ?? readString(event.payload.resolution);
      const note = readString(event.payload.note);

      if (note) {
        return note;
      }

      return resolution
        ? `已记录预设路径：${getPresetPathLabel(resolution)}。`
        : "当前任务已写入预设决策结果。";
    }
    case "task.review_required":
    case "task.human_review_requested": {
      const summary = readString(event.payload.summary);

      if (summary) {
        return summary;
      }

      const itemCount = Array.isArray(event.payload.items) ? event.payload.items.length : null;

      return itemCount == null
        ? "系统检测到低置信度内容，等待人工确认。"
        : `共有 ${itemCount} 个片段等待人工确认。`;
    }
    case "task.review_resolved": {
      const resolvedCount = Array.isArray(event.payload.resolvedItems)
        ? event.payload.resolvedItems.length
        : null;

      return resolvedCount == null
        ? "人工确认结果已提交。"
        : `已提交 ${resolvedCount} 条人工确认结果。`;
    }
    case "task.manual_intervention":
      return readString(event.payload.note) ?? "系统已记录一次人工介入操作。";
    case "task.retry_requested":
      return readString(event.payload.note) ?? "失败后已发起新的恢复重试。";
    case "task.retry_spawned": {
      const nextTaskId = readString(event.payload.nextTaskId);

      return nextTaskId
        ? `系统已生成新的恢复 attempt：${nextTaskId}。`
        : "系统已生成新的恢复 attempt。";
    }
    case "task.failed":
      return readString(event.payload.failureMessage) ?? "任务进入失败终态。";
    case "task.completed":
      return "处理链路已完成，交付结果可被读取。";
    default:
      return event.fromStatus === event.toStatus
        ? "任务生命周期信息已更新。"
        : `状态从 ${event.fromStatus} 变更为 ${event.toStatus}。`;
  }
}

function getAccessAuditLabel(eventType: string) {
  switch (eventType) {
    case "deliverable.download":
      return "交付物访问审计";
    case "authorization.denied":
      return "越权访问拒绝";
    case "task.audit_query":
      return "审计记录读取";
    case "task.api_query":
      return "API 任务读取";
    case "task.api_deliverable_download":
      return "API 交付物访问";
    default:
      return "敏感访问审计";
  }
}

function formatRoleList(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const roles = value.filter((item): item is string => typeof item === "string" && item.length > 0);

  return roles.length > 0 ? roles.join(" / ") : null;
}

function getAccessAuditDetail(audit: AuditLogRecord) {
  if (typeof audit.detail.fileName === "string") {
    return `文件：${audit.detail.fileName}`;
  }

  if (audit.eventType === "authorization.denied") {
    const requiredRoles =
      formatRoleList(audit.detail.requiredAnyRole) ?? formatRoleList(audit.detail.requiredRole);

    return requiredRoles
      ? `已拒绝一次越权访问，所需角色：${requiredRoles}。`
      : "已拒绝一次越权访问。";
  }

  if (audit.eventType === "task.audit_query") {
    const accessRoles = formatRoleList(audit.detail.accessRoles);

    return accessRoles
      ? `支持/运营审计页面已读取该任务，访问角色：${accessRoles}。`
      : "支持/运营审计页面已读取该任务。";
  }

  if (audit.eventType === "task.api_query") {
    return "外部 API 已查询该任务状态或结果。";
  }

  if (audit.eventType === "task.api_deliverable_download") {
    return "外部 API 已访问该任务交付物。";
  }

  return "已记录一次敏感访问。";
}

function getPresetTimelineFallback(task: TaskRecord, events: TaskEventRecord[]) {
  const preset = task.presetSnapshot as TaskPresetSnapshot | null;

  if (!preset?.status || preset.status === "none") {
    return null;
  }

  const hasPresetEvent = events.some((event) => event.eventType === "task.preset_decision_requested");

  if (hasPresetEvent) {
    return null;
  }

  return {
    id: `${task.id}:preset`,
    kind: "preset" as const,
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
  const items: TaskAuditTimelineItem[] = [
    {
      id: `${task.id}:created`,
      kind: "lifecycle",
      label: "任务已创建",
      description: "任务记录已建立，可按 task id 继续追踪后续历史。",
      taskId: task.id,
      requestId: events[0]?.requestId ?? "system",
      occurredAt: task.createdAt.toISOString(),
      actorLabel: "system",
      beforeAfter: null,
    },
  ];

  const presetFallback = getPresetTimelineFallback(task, events);

  if (presetFallback) {
    items.push(presetFallback);
  }

  for (const event of events) {
    if (event.eventType === "task.created") {
      continue;
    }

    items.push({
      id: event.id,
      kind: getTimelineKind(event.eventType),
      label: getTimelineLabel(event.eventType),
      description: getTimelineDescription(event),
      taskId: task.id,
      requestId: event.requestId,
      occurredAt: event.createdAt.toISOString(),
      actorLabel: getActorLabel(event.actorUserId),
      beforeAfter:
        event.fromStatus === event.toStatus
          ? null
          : `${event.fromStatus} → ${event.toStatus}`,
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
      description: getAccessAuditDetail(audit),
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
        "task.audit_query",
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

function buildReviewSummary(events: TaskEventRecord[]) {
  const reviewQueue = extractReviewQueue(events);

  if (!reviewQueue) {
    return null;
  }

  const resolvedEvent = [...events]
    .reverse()
    .find((event) => event.eventType === "task.review_resolved");

  return {
    reviewId: reviewQueue.reviewId,
    pendingCount: reviewQueue.pendingCount,
    confirmedCount: reviewQueue.resolvedDecisions.length,
    completedAt: resolvedEvent?.createdAt.toISOString() ?? null,
    confirmedBy: resolvedEvent ? getActorLabel(resolvedEvent.actorUserId) : "待确认",
  };
}

function buildManualSummary(events: TaskEventRecord[]) {
  const event = [...events]
    .reverse()
    .find((entry) => entry.eventType === "task.manual_intervention");

  if (!event) {
    return null;
  }

  return {
    actionType: "task.manual_intervention",
    actorLabel: getActorLabel(event.actorUserId),
    occurredAt: event.createdAt.toISOString(),
    detail: readString(event.payload.note) ?? "已记录一次人工介入。",
  };
}

function buildSummaryBody(args: {
  currentStageLabel: string;
  currentStatusLabel: string;
  presetPathLabel: string;
  attemptNumber: number;
  partialHistory: boolean;
}) {
  const parts = [
    `当前状态为「${args.currentStatusLabel}」`,
    `当前阶段为「${args.currentStageLabel}」`,
    `预设路径为「${args.presetPathLabel}」`,
    `当前为第 ${args.attemptNumber} 次 attempt`,
  ];

  if (args.partialHistory) {
    parts.push("部分更早历史已超出 30 天保留窗口");
  }

  return `${parts.join("，")}。`;
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
  const latestAudit = audits[0] ?? null;
  const attempt = getTaskAttemptSnapshot(task.sourceSnapshot, task.id);
  const failureSummary = buildFailureSummary(events);
  const reviewSummary = buildReviewSummary(events);
  const manualSummary = buildManualSummary(events);
  const timeline = toTimelineItems(task, events, audits);
  const accessLogs = buildAccessLogs(task, audits);
  const partialHistory = !isWithinRetention(task.createdAt);
  const currentStatusLabel = getTaskStatusPresentation(task.status).label;
  const currentStageLabel = getTaskCurrentStageLabel(task.status, {
    lastActiveStatus: latestEvent?.fromStatus ?? null,
  });
  const presetPathLabel = getPresetPathLabel(
    (task.presetSnapshot as TaskPresetSnapshot | null)?.status,
  );
  const retentionNote = partialHistory
    ? "当前任务创建时间早于 30 天保留窗口，以下仅展示窗口内仍可读取到的关键审计记录。"
    : "当前仅展示 30 天保留窗口内的关键审计记录，避免依赖临时运行日志才能排障。";

  return {
    taskId: task.id,
    sourceIdentifier: task.sourceIdentifier,
    sourceTitle: getSourceTitle(task.sourceSnapshot, task.sourceIdentifier),
    currentStatus: task.status,
    currentStatusLabel,
    currentStageLabel,
    presetPathLabel,
    attemptNumber: attempt.attemptNumber,
    originTaskId: attempt.originTaskId,
    retryOfTaskId: attempt.retryOfTaskId,
    requestId: latestEvent?.requestId ?? latestAudit?.requestId ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    retentionNote,
    partialHistory,
    summary: {
      title: getSourceTitle(task.sourceSnapshot, task.sourceIdentifier),
      body: buildSummaryBody({
        currentStageLabel,
        currentStatusLabel,
        presetPathLabel,
        attemptNumber: attempt.attemptNumber,
        partialHistory,
      }),
    },
    failureSummary,
    reviewSummary,
    manualSummary,
    timeline,
    accessLogs,
  };
}

async function recordTaskAuditRead(args: {
  actorUserId: number;
  actorSessionId: string;
  taskId: string;
  accessRoles: string[];
}) {
  try {
    await taskAuditTestHooks.writeAuditLogImpl({
      actorUserId: args.actorUserId,
      actorSessionId: args.actorSessionId,
      eventType: "task.audit_query",
      resourceType: "task-audit",
      resourceId: args.taskId,
      outcome: "success",
      detail: {
        taskId: args.taskId,
        accessRoles: args.accessRoles,
      },
    });
  } catch {}
}

export async function loadTaskAuditForAuthorizedRole(args: {
  request: Request;
  taskId: string;
  authenticatedSession: {
    user: { id: number };
    session: { id: string };
  };
}) {
  const roles = await taskAuditTestHooks.requireAnyRoleImpl(
    args.authenticatedSession as never,
    ["support", "ops", "admin"],
    {
      type: "task-audit",
      id: args.taskId,
    },
  );

  await recordTaskAuditRead({
    actorUserId: args.authenticatedSession.user.id,
    actorSessionId: args.authenticatedSession.session.id,
    taskId: args.taskId,
    accessRoles: roles,
  });

  return loadTaskAuditViewModel({
    request: args.request,
    taskId: args.taskId,
  });
}
