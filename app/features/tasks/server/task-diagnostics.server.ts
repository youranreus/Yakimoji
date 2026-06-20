import type { TaskStatus } from "./task-status.server";

type GenericRecord = Record<string, unknown>;

export type TaskAttemptSnapshot = {
  attemptNumber: number;
  originTaskId: string;
  retryOfTaskId: string | null;
};

export type TaskReviewItem = {
  id: string;
  snippet: string;
  contextBefore: string;
  contextAfter: string;
  confidenceLabel: string;
  suggestedAction: string;
};

export type TaskReviewDecision = {
  itemId: string;
  decision: "approve" | "needs_attention";
  note: string | null;
};

export type TaskReviewQueue = {
  reviewId: string;
  summary: string;
  items: TaskReviewItem[];
  pendingCount: number;
  resolvedDecisions: TaskReviewDecision[];
};

export type TaskFailureContext = {
  stage: string;
  message: string;
  reasonCode: string | null;
  diagnosticTraceId: string | null;
  retryable: boolean;
  recommendedAction: string;
  supportCategory: string | null;
};

export type TaskSupportDiagnosticEntry = {
  id: string;
  label: string;
  detail: string;
  occurredAt: string;
  requestId: string;
  kind:
    | "lifecycle"
    | "preset"
    | "review"
    | "failure"
    | "retry"
    | "support";
};

export type TaskEventLike = {
  id: string;
  eventType: string;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  reasonCode: string | null;
  requestId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export function buildInitialAttemptSnapshot(taskId: string): TaskAttemptSnapshot {
  return {
    attemptNumber: 1,
    originTaskId: taskId,
    retryOfTaskId: null,
  };
}

export function getTaskAttemptSnapshot(
  sourceSnapshot: GenericRecord | null,
  taskId: string,
): TaskAttemptSnapshot {
  const attempt = sourceSnapshot?.attempt;

  if (typeof attempt !== "object" || attempt == null) {
    return buildInitialAttemptSnapshot(taskId);
  }

  const snapshot = attempt as GenericRecord;
  const attemptNumber =
    typeof snapshot.attemptNumber === "number" && snapshot.attemptNumber > 0
      ? Math.floor(snapshot.attemptNumber)
      : 1;
  const originTaskId =
    typeof snapshot.originTaskId === "string" && snapshot.originTaskId
      ? snapshot.originTaskId
      : taskId;
  const retryOfTaskId =
    typeof snapshot.retryOfTaskId === "string" && snapshot.retryOfTaskId
      ? snapshot.retryOfTaskId
      : null;

  return {
    attemptNumber,
    originTaskId,
    retryOfTaskId,
  };
}

export function buildRetryAttemptSnapshot(args: {
  sourceSnapshot: GenericRecord | null;
  currentTaskId: string;
  nextTaskId: string;
}): TaskAttemptSnapshot {
  const current = getTaskAttemptSnapshot(args.sourceSnapshot, args.currentTaskId);

  return {
    attemptNumber: current.attemptNumber + 1,
    originTaskId: current.originTaskId || args.nextTaskId,
    retryOfTaskId: args.currentTaskId,
  };
}

function normalizeReviewItem(input: unknown, index: number): TaskReviewItem | null {
  if (typeof input !== "object" || input == null) {
    return null;
  }

  const value = input as GenericRecord;
  const snippet =
    typeof value.snippet === "string" && value.snippet.trim()
      ? value.snippet.trim()
      : null;

  if (!snippet) {
    return null;
  }

  return {
    id:
      typeof value.id === "string" && value.id.trim()
        ? value.id.trim()
        : `review_item_${index + 1}`,
    snippet,
    contextBefore:
      typeof value.contextBefore === "string" ? value.contextBefore : "",
    contextAfter:
      typeof value.contextAfter === "string" ? value.contextAfter : "",
    confidenceLabel:
      typeof value.confidenceLabel === "string" && value.confidenceLabel.trim()
        ? value.confidenceLabel.trim()
        : "低置信度",
    suggestedAction:
      typeof value.suggestedAction === "string" && value.suggestedAction.trim()
        ? value.suggestedAction.trim()
        : "请确认该片段是否可以直接沿用当前识别结果。",
  };
}

function normalizeReviewDecision(input: unknown): TaskReviewDecision | null {
  if (typeof input !== "object" || input == null) {
    return null;
  }

  const value = input as GenericRecord;

  if (
    typeof value.itemId !== "string" ||
    (value.decision !== "approve" && value.decision !== "needs_attention")
  ) {
    return null;
  }

  return {
    itemId: value.itemId,
    decision: value.decision,
    note: typeof value.note === "string" && value.note.trim() ? value.note.trim() : null,
  };
}

export function extractReviewQueue(events: TaskEventLike[]): TaskReviewQueue | null {
  const requiredEvent = [...events]
    .reverse()
    .find((event) =>
      event.eventType === "task.review_required" ||
      event.eventType === "task.human_review_requested",
    );

  if (!requiredEvent) {
    return null;
  }

  const items = Array.isArray(requiredEvent.payload.items)
    ? requiredEvent.payload.items
        .map((item, index) => normalizeReviewItem(item, index))
        .filter((item): item is TaskReviewItem => item != null)
    : [];

  const resolvedEvent = [...events]
    .reverse()
    .find((event) => event.eventType === "task.review_resolved");
  const resolvedDecisions =
    resolvedEvent && Array.isArray(resolvedEvent.payload.resolvedItems)
      ? resolvedEvent.payload.resolvedItems
          .map((item) => normalizeReviewDecision(item))
          .filter((item): item is TaskReviewDecision => item != null)
      : [];

  const reviewId =
    typeof requiredEvent.payload.reviewId === "string" && requiredEvent.payload.reviewId
      ? requiredEvent.payload.reviewId
      : requiredEvent.id;

  const summary =
    typeof requiredEvent.payload.summary === "string" && requiredEvent.payload.summary
      ? requiredEvent.payload.summary
      : `当前任务有 ${items.length} 个低置信度片段等待人工确认。`;

  return {
    reviewId,
    summary,
    items,
    pendingCount: Math.max(items.length - resolvedDecisions.length, 0),
    resolvedDecisions,
  };
}

export function extractFailureContext(events: TaskEventLike[]): TaskFailureContext | null {
  const failureEvent = [...events]
    .reverse()
    .find((event) => event.eventType === "task.failed" || event.toStatus === "failed");

  if (!failureEvent) {
    return null;
  }

  const payload = failureEvent.payload;

  return {
    stage:
      typeof payload.failureStage === "string" && payload.failureStage
        ? payload.failureStage
        : "处理阶段未知",
    message:
      typeof payload.failureMessage === "string" && payload.failureMessage
        ? payload.failureMessage
        : "当前任务进入失败终态，但没有附带更详细的解释。",
    reasonCode: failureEvent.reasonCode,
    diagnosticTraceId:
      typeof payload.diagnosticTraceId === "string" && payload.diagnosticTraceId
        ? payload.diagnosticTraceId
        : null,
    retryable: payload.retryable !== false,
    recommendedAction:
      typeof payload.recommendedAction === "string" && payload.recommendedAction
        ? payload.recommendedAction
        : "请先查看失败阶段与诊断标识，再决定是否发起新的恢复 attempt。",
    supportCategory:
      typeof payload.supportCategory === "string" && payload.supportCategory
        ? payload.supportCategory
        : null,
  };
}

function getSupportEntryCopy(event: TaskEventLike) {
  switch (event.eventType) {
    case "task.created":
      return {
        kind: "lifecycle" as const,
        label: "任务已创建",
        detail: "任务记录已写入工作台。",
      };
    case "task.preset_decision_requested":
      return {
        kind: "preset" as const,
        label: "等待预设决策",
        detail: "当前来源未命中现有预设，需要人工决定如何继续。",
      };
    case "task.review_required":
    case "task.human_review_requested":
      return {
        kind: "review" as const,
        label: "进入人工确认队列",
        detail: "系统检测到低置信度片段，等待创作者确认。",
      };
    case "task.review_resolved":
      return {
        kind: "review" as const,
        label: "人工确认已提交",
        detail: "创作者已提交低置信度片段确认结果。",
      };
    case "task.failed":
      return {
        kind: "failure" as const,
        label: "任务失败",
        detail:
          typeof event.payload.failureMessage === "string" && event.payload.failureMessage
            ? event.payload.failureMessage
            : "任务进入失败终态。",
      };
    case "task.retry_requested":
      return {
        kind: "retry" as const,
        label: "请求创建恢复 attempt",
        detail: "创作者或系统发起了新的恢复尝试。",
      };
    case "task.retry_spawned":
      return {
        kind: "retry" as const,
        label: "新 attempt 已创建",
        detail: "系统已为恢复流程创建新的执行实例。",
      };
    case "task.manual_intervention":
      return {
        kind: "support" as const,
        label: "记录人工介入",
        detail: "系统记录了一次人工处理动作。",
      };
    default:
      return {
        kind: "lifecycle" as const,
        label: event.eventType,
        detail: `状态从 ${event.fromStatus} 变更为 ${event.toStatus}。`,
      };
  }
}

export function buildSupportDiagnosticEntries(
  events: TaskEventLike[],
): TaskSupportDiagnosticEntry[] {
  return events
    .filter((event) =>
      [
        "task.created",
        "task.preset_decision_requested",
        "task.review_required",
        "task.human_review_requested",
        "task.review_resolved",
        "task.failed",
        "task.retry_requested",
        "task.retry_spawned",
      ].includes(event.eventType),
    )
    .map((event) => {
    const copy = getSupportEntryCopy(event);

    return {
      id: event.id,
      label: copy.label,
      detail: copy.detail,
      occurredAt: event.createdAt.toISOString(),
      requestId: event.requestId,
      kind: copy.kind,
    };
  });
}
