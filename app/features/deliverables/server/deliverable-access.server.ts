import { readFile } from "node:fs/promises";
import path from "node:path";

import { data } from "react-router";

import { writeAuditLog } from "../../auth/server/audit.server";
import { getRequestContext } from "../../auth/server/request-context.server";

import {
  getDeliverableAccess,
  type DeliverableAccessOutcome,
} from "./deliverable-query.server";

const deliverablesRoot = path.join(process.cwd(), ".local-share");

export const deliverableAccessTestHooks = {
  getDeliverableAccessImpl: getDeliverableAccess,
  writeAuditLogImpl: writeAuditLog,
  readFileImpl: readFile,
};

export function setDeliverableAccessTestHooks(
  hooks: Partial<typeof deliverableAccessTestHooks>,
) {
  deliverableAccessTestHooks.getDeliverableAccessImpl =
    hooks.getDeliverableAccessImpl ?? getDeliverableAccess;
  deliverableAccessTestHooks.writeAuditLogImpl =
    hooks.writeAuditLogImpl ?? writeAuditLog;
  deliverableAccessTestHooks.readFileImpl = hooks.readFileImpl ?? readFile;
}

function createErrorResponse(outcome: Extract<DeliverableAccessOutcome, { ok: false }>) {
  const { requestId } = getRequestContext();

  return data(
    {
      code: outcome.code,
      message: outcome.message,
      request_id: requestId,
    },
    {
      status: outcome.status,
      headers: {
        "X-Request-Id": requestId,
      },
    },
  );
}

async function writeDownloadAuditLog(input: {
  actorUserId: number;
  resourceId: string;
  outcome: string;
  taskId: string | null;
  detail: Record<string, unknown>;
}) {
  try {
    await deliverableAccessTestHooks.writeAuditLogImpl({
      actorUserId: input.actorUserId,
      eventType: "deliverable.download",
      resourceType: "deliverable",
      resourceId: input.resourceId,
      outcome: input.outcome,
      detail: {
        ...input.detail,
        taskId: input.taskId,
      },
    });
  } catch {}
}

function createDeliverableFilePath(storageKey: string) {
  return path.join(deliverablesRoot, storageKey);
}

export function sanitizeDownloadFilename(fileName: string) {
  return fileName.replace(/[\r\n"]/g, "_");
}

export async function authorizeDeliverableDownload(args: {
  userId: number;
  deliverableId: string;
}) {
  const access = await deliverableAccessTestHooks.getDeliverableAccessImpl(
    args.userId,
    args.deliverableId,
  );

  if (!access.ok) {
    await writeDownloadAuditLog({
      actorUserId: args.userId,
      resourceId: args.deliverableId,
      outcome: access.code,
      taskId: access.taskId,
      detail: {
        deliverableId: args.deliverableId,
        status: access.status,
      },
    });

    throw createErrorResponse(access);
  }

  return access;
}

export async function streamDeliverableDownload(args: {
  userId: number;
  deliverableId: string;
}) {
  const access = await authorizeDeliverableDownload(args);

  try {
    const fileBuffer = await deliverableAccessTestHooks.readFileImpl(
      createDeliverableFilePath(access.storageKey),
    );

    await writeDownloadAuditLog({
      actorUserId: args.userId,
      resourceId: args.deliverableId,
      outcome: "success",
      taskId: access.taskId,
      detail: {
        deliverableId: args.deliverableId,
        taskId: access.taskId,
        fileName: access.fileName,
        mimeType: access.mimeType,
        mode: access.mode,
      },
    });

    return {
      access,
      fileBuffer,
    };
  } catch (error) {
    await writeDownloadAuditLog({
      actorUserId: args.userId,
      resourceId: args.deliverableId,
      outcome: "deliverable_read_failed",
      taskId: access.taskId,
      detail: {
        deliverableId: args.deliverableId,
        taskId: access.taskId,
        fileName: access.fileName,
        mimeType: access.mimeType,
      },
    });

    throw data(
      {
        code: "deliverable_download_failed",
        message: "交付物读取失败，请稍后重试或联系支持人员。",
        request_id: getRequestContext().requestId,
      },
      {
        status: 500,
        headers: {
          "X-Request-Id": getRequestContext().requestId,
        },
      },
    );
  }
}
