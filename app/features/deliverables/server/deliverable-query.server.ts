import { and, asc, eq } from "drizzle-orm";
import { data } from "react-router";

import { database } from "../../../../database/context";
import { deliverables, tasks } from "../../../../database/schema";
import { getRequestContext } from "../../auth/server/request-context.server";

export type DeliverableKind = "video" | "subtitle";
export type DeliverableStatus = "pending" | "ready" | "expired" | "unavailable";

export type DeliverableRecord = {
  id: string;
  taskId: string;
  kind: DeliverableKind;
  fileName: string;
  storageKey: string;
  mimeType: string;
  fileSizeBytes: number;
  status: DeliverableStatus;
  availableAt: Date;
  expiresAt: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type DeliverableView = {
  id: string;
  taskId: string;
  kind: DeliverableKind;
  kindLabel: string;
  fileName: string;
  mimeType: string;
  fileSizeLabel: string;
  status: DeliverableStatus;
  statusLabel: string;
  canDownload: boolean;
  availableAt: string;
  expiresAt: string;
  downloadAction: string | null;
};

export type DeliverableAccessOutcome =
  | {
      ok: true;
      mode: "stream" | "short-lived-url";
      taskId: string;
      storageKey: string;
      deliverable: DeliverableView;
      fileName: string;
      mimeType: string;
    }
  | {
      ok: false;
      status: 403 | 404 | 410;
      code: "deliverable_forbidden" | "deliverable_not_found" | "deliverable_expired";
      message: string;
      taskId: string | null;
    };

export const deliverableQueryTestHooks = {
  getTaskRowForUserImpl: getTaskRowForUser,
  getTaskRowByIdImpl: getTaskRowById,
  listDeliverablesForTaskImpl: listDeliverablesForTask,
  getDeliverableRowForUserImpl: getDeliverableRowForUser,
  getDeliverableRowByIdImpl: getDeliverableRowById,
};

export function setDeliverableQueryTestHooks(
  hooks: Partial<typeof deliverableQueryTestHooks>,
) {
  deliverableQueryTestHooks.getTaskRowForUserImpl =
    hooks.getTaskRowForUserImpl ?? getTaskRowForUser;
  deliverableQueryTestHooks.getTaskRowByIdImpl =
    hooks.getTaskRowByIdImpl ?? getTaskRowById;
  deliverableQueryTestHooks.listDeliverablesForTaskImpl =
    hooks.listDeliverablesForTaskImpl ?? listDeliverablesForTask;
  deliverableQueryTestHooks.getDeliverableRowForUserImpl =
    hooks.getDeliverableRowForUserImpl ?? getDeliverableRowForUser;
  deliverableQueryTestHooks.getDeliverableRowByIdImpl =
    hooks.getDeliverableRowByIdImpl ?? getDeliverableRowById;
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

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(kilobytes >= 10 ? 0 : 1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function getDeliverableKindLabel(kind: DeliverableKind) {
  return kind === "video" ? "成品视频" : "字幕文件";
}

function getDeliverableStatusLabel(status: DeliverableStatus) {
  switch (status) {
    case "pending":
      return "处理中";
    case "ready":
      return "可下载";
    case "expired":
      return "已过期";
    case "unavailable":
      return "暂不可用";
  }
}

function getEffectiveDeliverableStatus(record: DeliverableRecord): DeliverableStatus {
  const now = Date.now();

  if (record.expiresAt.getTime() <= now) {
    return "expired";
  }

  if (record.status === "ready" && record.availableAt.getTime() > now) {
    return "pending";
  }

  return record.status;
}

function isReadyToDownload(record: DeliverableRecord) {
  const effectiveStatus = getEffectiveDeliverableStatus(record);

  return effectiveStatus === "ready";
}

function mapDeliverable(record: DeliverableRecord): DeliverableView {
  const effectiveStatus = getEffectiveDeliverableStatus(record);
  const canDownload = isReadyToDownload(record);

  return {
    id: record.id,
    taskId: record.taskId,
    kind: record.kind,
    kindLabel: getDeliverableKindLabel(record.kind),
    fileName: record.fileName,
    mimeType: record.mimeType,
    fileSizeLabel: formatFileSize(record.fileSizeBytes),
    status: effectiveStatus,
    statusLabel: getDeliverableStatusLabel(effectiveStatus),
    canDownload,
    availableAt: record.availableAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    downloadAction: canDownload ? `/workspace/deliverables/${record.id}` : null,
  };
}

async function getTaskRowForUser(userId: number, taskId: string) {
  const db = database();
  const [record] = await db
    .select({ id: tasks.id, creatorUserId: tasks.creatorUserId })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.creatorUserId, userId)))
    .limit(1);

  return (record as { id: string; creatorUserId: number } | undefined) ?? null;
}

async function getTaskRowById(taskId: string) {
  const db = database();
  const [record] = await db
    .select({ id: tasks.id, creatorUserId: tasks.creatorUserId })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  return (record as { id: string; creatorUserId: number } | undefined) ?? null;
}

async function listDeliverablesForTask(taskId: string): Promise<DeliverableRecord[]> {
  const db = database();
  const records = await db
    .select({
      id: deliverables.id,
      taskId: deliverables.taskId,
      kind: deliverables.kind,
      fileName: deliverables.fileName,
      storageKey: deliverables.storageKey,
      mimeType: deliverables.mimeType,
      fileSizeBytes: deliverables.fileSizeBytes,
      status: deliverables.status,
      availableAt: deliverables.availableAt,
      expiresAt: deliverables.expiresAt,
      metadata: deliverables.metadata,
      createdAt: deliverables.createdAt,
      updatedAt: deliverables.updatedAt,
    })
    .from(deliverables)
    .where(eq(deliverables.taskId, taskId))
    .orderBy(asc(deliverables.kind));

  return records.map((record) => ({
    ...(record as Omit<DeliverableRecord, "metadata">),
    metadata: (record.metadata as Record<string, unknown>) ?? {},
  }));
}

async function getDeliverableRowForUser(
  userId: number,
  deliverableId: string,
): Promise<DeliverableRecord | null> {
  const db = database();
  const [record] = await db
    .select({
      id: deliverables.id,
      taskId: deliverables.taskId,
      kind: deliverables.kind,
      fileName: deliverables.fileName,
      storageKey: deliverables.storageKey,
      mimeType: deliverables.mimeType,
      fileSizeBytes: deliverables.fileSizeBytes,
      status: deliverables.status,
      availableAt: deliverables.availableAt,
      expiresAt: deliverables.expiresAt,
      metadata: deliverables.metadata,
      createdAt: deliverables.createdAt,
      updatedAt: deliverables.updatedAt,
    })
    .from(deliverables)
    .innerJoin(tasks, eq(deliverables.taskId, tasks.id))
    .where(
      and(
        eq(deliverables.id, deliverableId),
        eq(tasks.creatorUserId, userId),
      ),
    )
    .limit(1);

  if (!record) {
    return null;
  }

  return {
    ...(record as Omit<DeliverableRecord, "metadata">),
    metadata: (record.metadata as Record<string, unknown>) ?? {},
  };
}

async function getDeliverableRowById(
  deliverableId: string,
): Promise<DeliverableRecord | null> {
  const db = database();
  const [record] = await db
    .select({
      id: deliverables.id,
      taskId: deliverables.taskId,
      kind: deliverables.kind,
      fileName: deliverables.fileName,
      storageKey: deliverables.storageKey,
      mimeType: deliverables.mimeType,
      fileSizeBytes: deliverables.fileSizeBytes,
      status: deliverables.status,
      availableAt: deliverables.availableAt,
      expiresAt: deliverables.expiresAt,
      metadata: deliverables.metadata,
      createdAt: deliverables.createdAt,
      updatedAt: deliverables.updatedAt,
    })
    .from(deliverables)
    .where(eq(deliverables.id, deliverableId))
    .limit(1);

  if (!record) {
    return null;
  }

  return {
    ...(record as Omit<DeliverableRecord, "metadata">),
    metadata: (record.metadata as Record<string, unknown>) ?? {},
  };
}

function createDeliverableError(
  code: DeliverableAccessOutcome extends { ok: false; code: infer C } ? C : never,
  message: string,
  status: 403 | 404 | 410,
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

export async function listDeliverablesForTaskDetail(
  userId: number,
  taskId: string,
) {
  const task = await deliverableQueryTestHooks.getTaskRowForUserImpl(userId, taskId);

  if (!task) {
    const existingTask = await deliverableQueryTestHooks.getTaskRowByIdImpl(taskId);

    if (existingTask) {
      createTaskReadError("task_forbidden", "当前账号无权访问该任务详情。", 403);
    }

    createTaskReadError("task_not_found", "任务不存在，或当前链接已经失效。", 404);
  }

  const deliverableRows = await deliverableQueryTestHooks.listDeliverablesForTaskImpl(taskId);

  return deliverableRows.map(mapDeliverable);
}

export async function getDeliverableAccess(
  userId: number,
  deliverableId: string,
): Promise<DeliverableAccessOutcome> {
  const record = await deliverableQueryTestHooks.getDeliverableRowForUserImpl(
    userId,
    deliverableId,
  );

  if (!record) {
    const existing = await deliverableQueryTestHooks.getDeliverableRowByIdImpl(
      deliverableId,
    );

    if (!existing) {
      return {
        ok: false,
        status: 404,
        code: "deliverable_not_found",
        message: "交付物不存在，或当前链接已经失效。",
        taskId: null,
      };
    }

    return {
      ok: false,
      status: 403,
      code: "deliverable_forbidden",
      message: "当前账号无权访问该交付物。",
      taskId: existing.taskId,
    };
  }

  const deliverable = mapDeliverable(record);

  if (deliverable.status === "expired") {
    return {
      ok: false,
      status: 410,
      code: "deliverable_expired",
      message: "该交付物已过期，请联系支持人员重新生成。",
      taskId: record.taskId,
    };
  }

  if (!deliverable.canDownload) {
    return {
      ok: false,
      status: 404,
      code: "deliverable_not_found",
      message: "当前交付物暂不可下载。",
      taskId: record.taskId,
    };
  }

  return {
    ok: true,
    mode: "stream",
    taskId: record.taskId,
    storageKey: record.storageKey,
    deliverable,
    fileName: deliverable.fileName,
    mimeType: deliverable.mimeType,
  };
}
