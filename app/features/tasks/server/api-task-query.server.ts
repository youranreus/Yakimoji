import { readFile } from "node:fs/promises";
import path from "node:path";

import { and, eq } from "drizzle-orm";
import { data } from "react-router";

import { database } from "../../../../database/context";
import { deliverables, tasks } from "../../../../database/schema";
import type { AuthenticatedApiCredential } from "../../api-credentials/server/api-credential-auth.server";
import {
  createPublicApiError,
  throwPublicApiError,
} from "../../api-credentials/server/public-api-errors.server";
import { writeAuditLog } from "../../auth/server/audit.server";
import { getRequestContext } from "../../auth/server/request-context.server";
import { sanitizeDownloadFilename } from "../../deliverables/server/deliverable-access.server";

import { getTaskDetailForUser, type TaskDetailView } from "./task-query.server";

type ApiOwnedTaskRecord = {
  id: string;
  creatorUserId: number;
  apiCredentialId: string | null;
  presetSnapshot: Record<string, unknown> | null;
  status: string;
};

type DeliverableRow = {
  id: string;
  taskId: string;
  kind: string;
  fileName: string;
  storageKey: string;
  mimeType: string;
  status: string;
  availableAt: Date;
  expiresAt: Date;
};

const deliverablesRoot = path.join(process.cwd(), ".local-share");

export const apiTaskQueryTestHooks = {
  getOwnedTaskImpl: getOwnedTask,
  getTaskByIdImpl: getTaskById,
  getTaskDetailForUserImpl: getTaskDetailForUser,
  getDeliverableByTaskImpl: getDeliverableByTask,
  writeAuditLogImpl: writeAuditLog,
  readFileImpl: readFile,
};

export function setApiTaskQueryTestHooks(
  hooks: Partial<typeof apiTaskQueryTestHooks>,
) {
  apiTaskQueryTestHooks.getOwnedTaskImpl =
    hooks.getOwnedTaskImpl ?? getOwnedTask;
  apiTaskQueryTestHooks.getTaskByIdImpl =
    hooks.getTaskByIdImpl ?? getTaskById;
  apiTaskQueryTestHooks.getTaskDetailForUserImpl =
    hooks.getTaskDetailForUserImpl ?? getTaskDetailForUser;
  apiTaskQueryTestHooks.getDeliverableByTaskImpl =
    hooks.getDeliverableByTaskImpl ?? getDeliverableByTask;
  apiTaskQueryTestHooks.writeAuditLogImpl =
    hooks.writeAuditLogImpl ?? writeAuditLog;
  apiTaskQueryTestHooks.readFileImpl =
    hooks.readFileImpl ?? readFile;
}

async function getOwnedTask(
  taskId: string,
  apiCredentialId: string,
): Promise<ApiOwnedTaskRecord | null> {
  const db = database();
  const [record] = await db
    .select({
      id: tasks.id,
      creatorUserId: tasks.creatorUserId,
      apiCredentialId: tasks.apiCredentialId,
      presetSnapshot: tasks.presetSnapshot,
      status: tasks.status,
    })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.apiCredentialId, apiCredentialId)))
    .limit(1);

  return (record as ApiOwnedTaskRecord | undefined) ?? null;
}

async function getTaskById(taskId: string): Promise<ApiOwnedTaskRecord | null> {
  const db = database();
  const [record] = await db
    .select({
      id: tasks.id,
      creatorUserId: tasks.creatorUserId,
      apiCredentialId: tasks.apiCredentialId,
      presetSnapshot: tasks.presetSnapshot,
      status: tasks.status,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  return (record as ApiOwnedTaskRecord | undefined) ?? null;
}

async function getDeliverableByTask(
  taskId: string,
  deliverableId: string,
): Promise<DeliverableRow | null> {
  const db = database();
  const [record] = await db
    .select({
      id: deliverables.id,
      taskId: deliverables.taskId,
      kind: deliverables.kind,
      fileName: deliverables.fileName,
      storageKey: deliverables.storageKey,
      mimeType: deliverables.mimeType,
      status: deliverables.status,
      availableAt: deliverables.availableAt,
      expiresAt: deliverables.expiresAt,
    })
    .from(deliverables)
    .where(
      and(
        eq(deliverables.id, deliverableId),
        eq(deliverables.taskId, taskId),
      ),
    )
    .limit(1);

  return (record as DeliverableRow | undefined) ?? null;
}

async function writeTaskAuditLog(input: {
  actorUserId: number;
  resourceId: string;
  outcome: string;
  detail?: Record<string, unknown>;
}) {
  await apiTaskQueryTestHooks.writeAuditLogImpl({
    actorUserId: input.actorUserId,
    eventType: "task.api_query",
    resourceType: "task",
    resourceId: input.resourceId,
    outcome: input.outcome,
    detail: input.detail,
  });
}

async function writeDeliverableAuditLog(input: {
  actorUserId: number;
  credentialId: string;
  taskId: string;
  deliverableId: string;
  outcome: string;
  status?: number;
}) {
  await apiTaskQueryTestHooks.writeAuditLogImpl({
    actorUserId: input.actorUserId,
    eventType: "task.api_deliverable_download",
    resourceType: "deliverable",
    resourceId: input.deliverableId,
    outcome: input.outcome,
    detail: {
      apiCredentialId: input.credentialId,
      taskId: input.taskId,
      deliverableId: input.deliverableId,
      status: input.status,
    },
  });
}

async function authorizeTaskRead(
  credential: AuthenticatedApiCredential,
  taskId: string,
) {
  const ownedTask = await apiTaskQueryTestHooks.getOwnedTaskImpl(
    taskId,
    credential.id,
  );

  if (ownedTask) {
    return ownedTask;
  }

  const existingTask = await apiTaskQueryTestHooks.getTaskByIdImpl(taskId);

  if (existingTask) {
    await writeTaskAuditLog({
      actorUserId: credential.ownerUserId,
      resourceId: taskId,
      outcome: "forbidden",
      detail: {
        apiCredentialId: credential.id,
      },
    });
    throwPublicApiError(
      "TASK_FORBIDDEN",
      "Task access is forbidden for this API credential.",
      { status: 403 },
    );
  }

  await writeTaskAuditLog({
    actorUserId: credential.ownerUserId,
    resourceId: taskId,
    outcome: "not_found",
    detail: {
      apiCredentialId: credential.id,
    },
  });
  throwPublicApiError("TASK_NOT_FOUND", "Task not found.", { status: 404 });
}

function getResultState(detail: TaskDetailView) {
  if (detail.status === "failed" || detail.status === "cancelled") {
    return "failed";
  }

  const hasReadyDeliverable = detail.deliverables.some(
    (deliverable) => deliverable.canDownload && deliverable.status === "ready",
  );

  if (hasReadyDeliverable) {
    return "ready";
  }

  const hasExpiredDeliverable = detail.deliverables.some(
    (deliverable) => deliverable.status === "expired",
  );

  if (hasExpiredDeliverable) {
    return "expired";
  }

  return "not_ready";
}

function getReviewState(detail: TaskDetailView) {
  if (
    detail.status === "awaiting_human_review" &&
    detail.reviewQueue?.items.length
  ) {
    return "required";
  }

  if (detail.reviewQueue) {
    return "resolved";
  }

  return "none";
}

function getPresetResolutionStatus(task: ApiOwnedTaskRecord) {
  const presetSnapshot = task.presetSnapshot as { status?: string } | null;

  return presetSnapshot?.status ?? "none";
}

function getApiPresetResolution(task: ApiOwnedTaskRecord) {
  const status = getPresetResolutionStatus(task);

  if (task.status === "awaiting_preset_decision" && status === "unresolved") {
    return {
      status,
      nextAction: "manual_resolution_required",
      message: "No matching preset was found for this source.",
    };
  }

  return {
    status,
  };
}

const normalizedFailureStages = new Set([
  "source_resolution",
  "preset_matching",
  "queueing",
  "processing",
  "human_review",
  "subtitle_generation",
  "deliverable_packaging",
  "result_delivery",
]);

function normalizeFailureStage(stage: string | null | undefined) {
  if (!stage) {
    return "processing";
  }

  if (normalizedFailureStages.has(stage)) {
    return stage;
  }

  const lowerStage = stage.toLowerCase();

  if (lowerStage.includes("source") || stage.includes("来源")) {
    return "source_resolution";
  }

  if (lowerStage.includes("preset") || stage.includes("预设")) {
    return "preset_matching";
  }

  if (
    lowerStage.includes("queue") ||
    lowerStage.includes("queued") ||
    stage.includes("队列") ||
    stage.includes("排队") ||
    stage.includes("入队")
  ) {
    return "queueing";
  }

  if (
    lowerStage.includes("review") ||
    stage.includes("复核") ||
    stage.includes("人工")
  ) {
    return "human_review";
  }

  if (
    lowerStage.includes("subtitle") ||
    stage.includes("字幕")
  ) {
    return "subtitle_generation";
  }

  if (
    lowerStage.includes("package") ||
    lowerStage.includes("packaging") ||
    stage.includes("打包")
  ) {
    return "deliverable_packaging";
  }

  if (
    lowerStage.includes("deliver") ||
    lowerStage.includes("download") ||
    stage.includes("交付") ||
    stage.includes("下载")
  ) {
    return "result_delivery";
  }

  return "processing";
}

function getFailureRecommendedAction(detail: TaskDetailView) {
  if (detail.status === "cancelled") {
    return "create_new_task";
  }

  if (detail.failureContext?.retryable) {
    return "retry_with_new_attempt";
  }

  return "contact_support";
}

function getApiFailure(detail: TaskDetailView) {
  if (detail.status !== "failed" && detail.status !== "cancelled") {
    return null;
  }

  return {
    reasonCode:
      detail.failureContext?.reasonCode ??
      (detail.status === "cancelled" ? "task_cancelled" : "task_failed"),
    stage: normalizeFailureStage(detail.failureContext?.stage),
    message:
      detail.failureContext?.message ??
      (detail.status === "cancelled"
        ? "Task was cancelled."
        : "Task processing failed."),
    diagnosticTraceId: detail.failureContext?.diagnosticTraceId ?? null,
    retryable: detail.failureContext?.retryable ?? false,
    recommendedAction: getFailureRecommendedAction(detail),
  };
}

function mapApiDeliverables(detail: TaskDetailView) {
  return detail.deliverables
    .filter((deliverable) => deliverable.status === "ready" || deliverable.status === "expired")
    .map((deliverable) => ({
      kind: deliverable.kind,
      fileName: deliverable.fileName,
      mimeType: deliverable.mimeType,
      expiresAt: deliverable.expiresAt,
      download:
        deliverable.canDownload
          ? {
              method: "GET",
              href: `/tasks/${detail.id}/result/deliverables/${deliverable.id}/download`,
            }
          : null,
    }));
}

export async function loadApiTaskStatus(
  credential: AuthenticatedApiCredential,
  taskId: string,
) {
  const ownedTask = await authorizeTaskRead(credential, taskId);
  const detail = await apiTaskQueryTestHooks.getTaskDetailForUserImpl(
    ownedTask.creatorUserId,
    taskId,
  );
  const requestId = getRequestContext().requestId;

  await writeTaskAuditLog({
    actorUserId: credential.ownerUserId,
    resourceId: taskId,
    outcome: "success",
    detail: {
      apiCredentialId: credential.id,
      mode: "status",
    },
  });

  return data(
    {
      data: {
        taskId: detail.id,
        status: detail.status,
        statusLabel: detail.statusLabel,
        resultState: getResultState(detail),
        reviewState: getReviewState(detail),
        attempt: {
          attemptNumber: detail.attempt.attemptNumber,
          originTaskId: detail.attempt.originTaskId,
          retryOfTaskId: detail.attempt.retryOfTaskId,
        },
        presetResolution: getApiPresetResolution(ownedTask),
        failure: getApiFailure(detail),
      },
      meta: {
        requestId,
      },
    },
    {
      status: 200,
      headers: {
        "X-Request-Id": requestId,
      },
    },
  );
}

export async function loadApiTaskResult(
  credential: AuthenticatedApiCredential,
  taskId: string,
) {
  const ownedTask = await authorizeTaskRead(credential, taskId);
  const detail = await apiTaskQueryTestHooks.getTaskDetailForUserImpl(
    ownedTask.creatorUserId,
    taskId,
  );
  const requestId = getRequestContext().requestId;

  await writeTaskAuditLog({
    actorUserId: credential.ownerUserId,
    resourceId: taskId,
    outcome: "success",
    detail: {
      apiCredentialId: credential.id,
      mode: "result",
    },
  });

  return data(
    {
      data: {
        taskId: detail.id,
        status: detail.status,
        result: {
          state: getResultState(detail),
          deliverables: mapApiDeliverables(detail),
        },
        attempt: {
          attemptNumber: detail.attempt.attemptNumber,
          originTaskId: detail.attempt.originTaskId,
          retryOfTaskId: detail.attempt.retryOfTaskId,
        },
        failure: getApiFailure(detail),
      },
      meta: {
        requestId,
      },
    },
    {
      status: 200,
      headers: {
        "X-Request-Id": requestId,
      },
    },
  );
}

function getDeliverableResponseStatus(record: DeliverableRow) {
  const now = Date.now();

  if (record.expiresAt.getTime() <= now) {
    return "expired";
  }

  if (record.status === "ready" && record.availableAt.getTime() <= now) {
    return "ready";
  }

  return "pending";
}

export async function streamApiTaskDeliverable(args: {
  credential: AuthenticatedApiCredential;
  taskId: string;
  deliverableId: string;
}) {
  const ownedTask = await authorizeTaskRead(args.credential, args.taskId);
  const record = await apiTaskQueryTestHooks.getDeliverableByTaskImpl(
    args.taskId,
    args.deliverableId,
  );

  if (!record) {
    await writeDeliverableAuditLog({
      actorUserId: args.credential.ownerUserId,
      credentialId: args.credential.id,
      taskId: args.taskId,
      deliverableId: args.deliverableId,
      outcome: "not_found",
      status: 404,
    });
    throwPublicApiError(
      "DELIVERABLE_NOT_FOUND",
      "Deliverable not found.",
      { status: 404 },
    );
  }

  const status = getDeliverableResponseStatus(record);

  if (status === "expired") {
    await writeDeliverableAuditLog({
      actorUserId: args.credential.ownerUserId,
      credentialId: args.credential.id,
      taskId: args.taskId,
      deliverableId: args.deliverableId,
      outcome: "expired",
      status: 410,
    });
    throwPublicApiError(
      "DELIVERABLE_EXPIRED",
      "Deliverable has expired.",
      { status: 410 },
    );
  }

  if (status !== "ready") {
    await writeDeliverableAuditLog({
      actorUserId: args.credential.ownerUserId,
      credentialId: args.credential.id,
      taskId: args.taskId,
      deliverableId: args.deliverableId,
      outcome: "not_ready",
      status: 404,
    });
    throwPublicApiError(
      "DELIVERABLE_NOT_FOUND",
      "Deliverable is not ready.",
      { status: 404 },
    );
  }

  const requestId = getRequestContext().requestId;
  let fileBuffer: Awaited<ReturnType<typeof apiTaskQueryTestHooks.readFileImpl>>;

  try {
    fileBuffer = await apiTaskQueryTestHooks.readFileImpl(
      path.join(deliverablesRoot, record.storageKey),
    );
  } catch {
    await writeDeliverableAuditLog({
      actorUserId: args.credential.ownerUserId,
      credentialId: args.credential.id,
      taskId: args.taskId,
      deliverableId: args.deliverableId,
      outcome: "read_failed",
      status: 500,
    });

    throw createPublicApiError(
      "DELIVERABLE_DOWNLOAD_FAILED",
      "Deliverable download failed. Please retry later.",
      { status: 500 },
    );
  }

  await writeDeliverableAuditLog({
    actorUserId: args.credential.ownerUserId,
    credentialId: args.credential.id,
    taskId: ownedTask.id,
    deliverableId: args.deliverableId,
    outcome: "success",
  });

  return new Response(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": record.mimeType,
      "Content-Disposition": `attachment; filename="${sanitizeDownloadFilename(record.fileName)}"`,
      "X-Request-Id": requestId,
    },
  });
}
