import { and, asc, desc, eq } from "drizzle-orm";
import { data } from "react-router";

import { database } from "../../../../database/context";
import { taskEvents, tasks } from "../../../../database/schema";
import { getRequestContext } from "../../auth/server/request-context.server";
import {
  listDeliverablesForTaskDetail,
  type DeliverableView,
} from "../../deliverables/server/deliverable-query.server";

import {
  buildTaskStageTimeline,
  getTaskCurrentStageLabel,
  getTaskStatusPresentation,
  type TaskStageState,
  type TaskStageView,
  type TaskStatus,
  type TaskStatusTone,
} from "./task-status.server";

const defaultPageSize = 10;
const maxPageSize = 20;

type TaskSourceSnapshot = {
  title?: string;
};

type TaskRecord = {
  id: string;
  creatorUserId: number;
  intakeMethod: "youtube_link" | "video_upload";
  sourceIdentifier: string;
  sourceSnapshot: Record<string, unknown> | null;
  processingBaselineSnapshot: Record<string, unknown> | null;
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

export type TaskListItem = {
  id: string;
  status: TaskStatus;
  statusLabel: string;
  statusTone: TaskStatusTone;
  intakeMethod: "youtube_link" | "video_upload";
  sourceIdentifier: string;
  sourceTitle: string;
  latestEventType: string | null;
  latestEventAt: string | null;
  latestProgressLabel: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type PaginatedTaskList = {
  data: TaskListItem[];
  meta: {
    pagination: TaskPagination;
  };
};

export type TaskTimelineEventView = {
  id: string;
  eventType: string;
  label: string;
  description: string;
  statusLabel: string;
  stageState: TaskStageState;
  occurredAt: string;
  requestId: string;
  reasonCode: string | null;
};

export type TaskDetailView = {
  id: string;
  sourceIdentifier: string;
  sourceTitle: string;
  status: TaskStatus;
  statusLabel: string;
  statusTone: TaskStatusTone;
  currentStageLabel: string;
  latestProgressLabel: string;
  requestId: string | null;
  createdAt: string;
  updatedAt: string;
  nextStepLabel: string;
  resultStatus: {
    label: string;
    description: string;
    tone: "neutral" | "info" | "warning" | "danger" | "success";
  };
  deliverables: DeliverableView[];
  stages: TaskStageView[];
  events: TaskTimelineEventView[];
};

const taskEventLabels: Record<
  string,
  {
    label: string;
    description: string;
  }
> = {
  "task.created": {
    label: "任务已创建",
    description: "任务已经进入工作台，等待推进到下一阶段。",
  },
  "task.resolving_source": {
    label: "正在识别来源",
    description: "系统正在建立来源识别上下文。",
  },
  "task.matching_preset": {
    label: "正在匹配预设",
    description: "系统正在寻找可复用的预设配置。",
  },
  "task.preset_decision_requested": {
    label: "等待预设决策",
    description: "需要创作者确认匹配到的预设。",
  },
  "task.queued": {
    label: "已进入处理队列",
    description: "任务已排队，等待处理资源就绪。",
  },
  "task.processing": {
    label: "正在处理内容",
    description: "系统正在执行核心处理流程。",
  },
  "task.human_review_requested": {
    label: "已进入人工复核队列",
    description: "系统已识别到需要人工确认的片段。",
  },
  "task.failed": {
    label: "处理失败",
    description: "任务进入失败终态，需要结合追踪信息排查。",
  },
  "task.completed": {
    label: "处理完成",
    description: "任务已完成当前处理流程。",
  },
  "task.cancelled": {
    label: "任务已取消",
    description: "任务已被取消，不再继续推进。",
  },
  "task.manual_intervention": {
    label: "已记录人工介入",
    description: "系统记录了一次人工干预动作。",
  },
  "task.recovered": {
    label: "任务已恢复",
    description: "任务已从异常中恢复并继续推进。",
  },
};

export const taskQueryTestHooks = {
  countTasksForUserImpl: countTasksForUser,
  listTaskPageRowsForUserImpl: listTaskPageRowsForUser,
  getTaskRowForUserImpl: getTaskRowForUser,
  getTaskRowByIdImpl: getTaskRowById,
  getTaskEventLedgerImpl: getTaskEventLedger,
  getLatestTaskEventForTaskImpl: getLatestTaskEventForTask,
  listDeliverablesForTaskDetailImpl: listDeliverablesForTaskDetail,
};

export function setTaskQueryTestHooks(
  hooks: Partial<typeof taskQueryTestHooks>,
) {
  taskQueryTestHooks.countTasksForUserImpl =
    hooks.countTasksForUserImpl ?? countTasksForUser;
  taskQueryTestHooks.listTaskPageRowsForUserImpl =
    hooks.listTaskPageRowsForUserImpl ?? listTaskPageRowsForUser;
  taskQueryTestHooks.getTaskRowForUserImpl =
    hooks.getTaskRowForUserImpl ?? getTaskRowForUser;
  taskQueryTestHooks.getTaskRowByIdImpl =
    hooks.getTaskRowByIdImpl ?? getTaskRowById;
  taskQueryTestHooks.getTaskEventLedgerImpl =
    hooks.getTaskEventLedgerImpl ?? getTaskEventLedger;
  taskQueryTestHooks.getLatestTaskEventForTaskImpl =
    hooks.getLatestTaskEventForTaskImpl ?? getLatestTaskEventForTask;
  taskQueryTestHooks.listDeliverablesForTaskDetailImpl =
    hooks.listDeliverablesForTaskDetailImpl ?? listDeliverablesForTaskDetail;
}

function normalizePage(value?: number) {
  if (!value || Number.isNaN(value) || value < 1) {
    return 1;
  }

  return Math.floor(value);
}

function normalizePageSize(value?: number) {
  if (!value || Number.isNaN(value) || value < 1) {
    return defaultPageSize;
  }

  return Math.min(Math.floor(value), maxPageSize);
}

function getSourceTitle(
  sourceSnapshot: Record<string, unknown> | null,
  sourceIdentifier: string,
) {
  const snapshot = sourceSnapshot as TaskSourceSnapshot | null;

  return snapshot?.title ?? sourceIdentifier;
}

function getEventCopy(eventType: string | null, status: TaskStatus) {
  if (eventType && taskEventLabels[eventType]) {
    return taskEventLabels[eventType];
  }

  const fallback = getTaskStatusPresentation(status);

  return {
    label: fallback.label,
    description: fallback.description,
  };
}

function getNextStepLabel(status: TaskStatus) {
  switch (status) {
    case "created":
      return "等待进入来源识别阶段";
    case "resolving_source":
      return "等待识别完成并进入预设匹配";
    case "matching_preset":
      return "等待命中可复用预设或转入人工决策";
    case "awaiting_preset_decision":
      return "等待创作者确认预设选择";
    case "queued":
      return "等待处理资源就绪后开始执行";
    case "processing":
      return "等待处理完成或转入人工复核";
    case "awaiting_human_review":
      return "等待人工复核完成后继续推进";
    case "completed":
      return "可继续查看交付结果与后续状态";
    case "failed":
      return "请结合 request_id 和失败说明排查原因";
    case "cancelled":
      return "如需继续处理，请重新创建任务";
  }
}

function getResultStatus(
  taskStatus: TaskStatus,
  deliverables: DeliverableView[],
) {
  const readyCount = deliverables.filter(
    (deliverable) => deliverable.status === "ready" && deliverable.canDownload,
  ).length;
  const expiredCount = deliverables.filter(
    (deliverable) => deliverable.status === "expired",
  ).length;

  if (taskStatus !== "completed") {
    if (taskStatus === "failed" || taskStatus === "cancelled") {
      return {
        label: "结果不可用",
        description: "任务尚未产出可交付结果。",
        tone: "danger" as const,
      };
    }

    return {
      label: "结果生成中",
      description: "任务仍在处理中，交付物尚未就绪。",
      tone: "info" as const,
    };
  }

  if (deliverables.length === 0) {
    return {
      label: "结果待生成",
      description: "任务已完成，但可交付文件尚未生成。",
      tone: "warning" as const,
    };
  }

  if (readyCount === deliverables.length) {
    return {
      label: "结果可交付",
      description: "成品视频和字幕文件都已准备完成，可直接下载。",
      tone: "success" as const,
    };
  }

  if (readyCount > 0) {
    return {
      label: "结果部分可用",
      description: "部分交付物已就绪，其他文件仍在生成或已过期。",
      tone: "warning" as const,
    };
  }

  if (expiredCount > 0) {
    return {
      label: "结果已过期",
      description: "交付物已超过保留期，需要重新生成。",
      tone: "danger" as const,
    };
  }

  return {
    label: "结果暂不可用",
    description: "当前还没有可以下载的成品文件。",
    tone: "warning" as const,
  };
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

function mapTaskListItem(
  task: TaskRecord,
  latestEvent: TaskEventRecord | null,
): TaskListItem {
  const statusPresentation = getTaskStatusPresentation(task.status);
  const latestCopy = getEventCopy(latestEvent?.eventType ?? null, task.status);

  return {
    id: task.id,
    status: task.status,
    statusLabel: statusPresentation.label,
    statusTone: statusPresentation.tone,
    intakeMethod: task.intakeMethod,
    sourceIdentifier: task.sourceIdentifier,
    sourceTitle: getSourceTitle(task.sourceSnapshot, task.sourceIdentifier),
    latestEventType: latestEvent?.eventType ?? null,
    latestEventAt: latestEvent?.createdAt.toISOString() ?? null,
    latestProgressLabel: latestCopy.label,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function mapTaskTimelineEvent(
  event: TaskEventRecord,
  index: number,
  total: number,
  currentStatus: TaskStatus,
): TaskTimelineEventView {
  const eventCopy = getEventCopy(event.eventType, event.toStatus);
  const statusPresentation = getTaskStatusPresentation(event.toStatus);
  let stageState: TaskStageState = "completed";

  if (index === total - 1) {
    if (currentStatus === "awaiting_human_review") {
      stageState = "attention";
    } else if (currentStatus === "failed" || currentStatus === "cancelled") {
      stageState = "terminal";
    } else if (currentStatus === "completed") {
      stageState = "completed";
    } else {
      stageState = "current";
    }
  }

  return {
    id: event.id,
    eventType: event.eventType,
    label: eventCopy.label,
    description: eventCopy.description,
    statusLabel: statusPresentation.label,
    stageState,
    occurredAt: event.createdAt.toISOString(),
    requestId: event.requestId,
    reasonCode: event.reasonCode,
  };
}

async function countTasksForUser(userId: number) {
  const db = database();
  const records = await db
    .select({
      id: tasks.id,
    })
    .from(tasks)
    .where(eq(tasks.creatorUserId, userId));

  return records.length;
}

async function listTaskPageRowsForUser(
  userId: number,
  options: {
    limit: number;
    offset: number;
  },
): Promise<TaskRecord[]> {
  const db = database();
  const records = await db
    .select({
      id: tasks.id,
      creatorUserId: tasks.creatorUserId,
      intakeMethod: tasks.intakeMethod,
      sourceIdentifier: tasks.sourceIdentifier,
      sourceSnapshot: tasks.sourceSnapshot,
      processingBaselineSnapshot: tasks.processingBaselineSnapshot,
      status: tasks.status,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .where(eq(tasks.creatorUserId, userId))
    .orderBy(desc(tasks.updatedAt))
    .limit(options.limit)
    .offset(options.offset);

  return records as TaskRecord[];
}

async function getTaskRowForUser(
  userId: number,
  taskId: string,
): Promise<TaskRecord | null> {
  const db = database();
  const [record] = await db
    .select({
      id: tasks.id,
      creatorUserId: tasks.creatorUserId,
      intakeMethod: tasks.intakeMethod,
      sourceIdentifier: tasks.sourceIdentifier,
      sourceSnapshot: tasks.sourceSnapshot,
      processingBaselineSnapshot: tasks.processingBaselineSnapshot,
      status: tasks.status,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.creatorUserId, userId)))
    .limit(1);

  return (record as TaskRecord | undefined) ?? null;
}

async function getTaskRowById(taskId: string): Promise<TaskRecord | null> {
  const db = database();
  const [record] = await db
    .select({
      id: tasks.id,
      creatorUserId: tasks.creatorUserId,
      intakeMethod: tasks.intakeMethod,
      sourceIdentifier: tasks.sourceIdentifier,
      sourceSnapshot: tasks.sourceSnapshot,
      processingBaselineSnapshot: tasks.processingBaselineSnapshot,
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
    .where(eq(taskEvents.taskId, taskId))
    .orderBy(asc(taskEvents.createdAt));

  return records.map((record) => ({
    ...(record as Omit<TaskEventRecord, "payload">),
    payload: (record.payload as Record<string, unknown>) ?? {},
  }));
}

async function getLatestTaskEventForTask(
  taskId: string,
): Promise<TaskEventRecord | null> {
  const db = database();
  const [record] = await db
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
    .where(eq(taskEvents.taskId, taskId))
    .orderBy(desc(taskEvents.createdAt))
    .limit(1);

  if (!record) {
    return null;
  }

  return {
    ...(record as Omit<TaskEventRecord, "payload">),
    payload: (record.payload as Record<string, unknown>) ?? {},
  };
}

export async function listPaginatedTasksForUser(
  userId: number,
  options: {
    page?: number;
    pageSize?: number;
  } = {},
): Promise<PaginatedTaskList> {
  const page = normalizePage(options.page);
  const pageSize = normalizePageSize(options.pageSize);
  const offset = (page - 1) * pageSize;
  const total = await taskQueryTestHooks.countTasksForUserImpl(userId);
  const rows = await taskQueryTestHooks.listTaskPageRowsForUserImpl(userId, {
    limit: pageSize,
    offset,
  });
  const latestEvents = await Promise.all(
    rows.map((row) => taskQueryTestHooks.getLatestTaskEventForTaskImpl(row.id)),
  );
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    data: rows.map((row, index) => mapTaskListItem(row, latestEvents[index] ?? null)),
    meta: {
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: total > page * pageSize,
        hasPreviousPage: page > 1,
      },
    },
  };
}

export async function getTaskDetailForUser(
  userId: number,
  taskId: string,
): Promise<TaskDetailView> {
  const task = await taskQueryTestHooks.getTaskRowForUserImpl(userId, taskId);

  if (!task) {
    const existingTask = await taskQueryTestHooks.getTaskRowByIdImpl(taskId);

    if (existingTask) {
      createTaskReadError("task_forbidden", "当前账号无权访问该任务详情。", 403);
    }

    createTaskReadError("task_not_found", "任务不存在，或当前链接已经失效。", 404);
  }

  const ownedTask = task;

  const events = await taskQueryTestHooks.getTaskEventLedgerImpl(taskId);
  const latestEvent =
    events.at(-1) ??
    (await taskQueryTestHooks.getLatestTaskEventForTaskImpl(taskId));
  const deliverables =
    await taskQueryTestHooks.listDeliverablesForTaskDetailImpl(
      userId,
      ownedTask.id,
    );
  const statusPresentation = getTaskStatusPresentation(ownedTask.status);
  const latestCopy = getEventCopy(
    latestEvent?.eventType ?? null,
    ownedTask.status,
  );
  const resultStatus = getResultStatus(ownedTask.status, deliverables);

  return {
    id: ownedTask.id,
    sourceIdentifier: ownedTask.sourceIdentifier,
    sourceTitle: getSourceTitle(
      ownedTask.sourceSnapshot,
      ownedTask.sourceIdentifier,
    ),
    status: ownedTask.status,
    statusLabel: statusPresentation.label,
    statusTone: statusPresentation.tone,
    currentStageLabel: getTaskCurrentStageLabel(ownedTask.status, {
      lastActiveStatus: latestEvent?.fromStatus ?? null,
    }),
    latestProgressLabel: latestCopy.label,
    requestId: latestEvent?.requestId ?? null,
    createdAt: ownedTask.createdAt.toISOString(),
    updatedAt: ownedTask.updatedAt.toISOString(),
    nextStepLabel: getNextStepLabel(ownedTask.status),
    resultStatus,
    deliverables,
    stages: buildTaskStageTimeline(ownedTask.status, {
      lastActiveStatus: latestEvent?.fromStatus ?? null,
    }),
    events: events.map((event, index) =>
      mapTaskTimelineEvent(event, index, events.length, ownedTask.status),
    ),
  };
}
