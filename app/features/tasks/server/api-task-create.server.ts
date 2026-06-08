import { randomUUID } from "node:crypto";

import { z } from "zod";
import { data } from "react-router";

import { database } from "../../../../database/context";
import { tasks } from "../../../../database/schema";
import type { AuthenticatedApiCredential } from "../../api-credentials/server/api-credential-auth.server";
import { throwPublicApiError } from "../../api-credentials/server/public-api-errors.server";
import { writeAuditLog } from "../../auth/server/audit.server";
import { getRequestContext } from "../../auth/server/request-context.server";
import {
  findChannelPresetForSource,
  type ChannelPresetView,
} from "../../presets/server/channel-presets.server";

import { getDefaultProcessingBaseline } from "./task-baseline.server";
import { recordTaskCreation, transitionTaskStatus } from "./task-events.server";
import { recognizeSourceFromYoutubeUrl } from "./source-recognition.server";
import { initialTaskStatus, type TaskStatus } from "./task-status.server";

const apiTaskCreateSchema = z.object({
  sourceType: z.literal("youtube_link"),
  sourceUrl: z.string().trim().min(1, "sourceUrl is required."),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type ApiTaskCreateInput = z.infer<typeof apiTaskCreateSchema>;

type ApiTaskPresetMatch =
  | {
      status: "matched";
      presetId: string;
      displayName: string;
      sourceIdentifier: string;
      appliedPresetSourceIdentifier: string;
      summary: string;
      defaults: ReturnType<typeof getDefaultProcessingBaseline>;
    }
  | {
      status: "unresolved";
      sourceIdentifier: string;
      summary: string;
    };

export const apiTaskCreateTestHooks = {
  findChannelPresetForSourceImpl: findChannelPresetForSource,
  writeAuditLogImpl: writeAuditLog,
};

export function setApiTaskCreateTestHooks(
  hooks: Partial<typeof apiTaskCreateTestHooks>,
) {
  apiTaskCreateTestHooks.findChannelPresetForSourceImpl =
    hooks.findChannelPresetForSourceImpl ?? findChannelPresetForSource;
  apiTaskCreateTestHooks.writeAuditLogImpl =
    hooks.writeAuditLogImpl ?? writeAuditLog;
}

function buildPresetMatch(
  sourceIdentifier: string,
  preset: ChannelPresetView | null,
): ApiTaskPresetMatch {
  if (!preset) {
    return {
      status: "unresolved",
      sourceIdentifier,
      summary:
        "当前来源未命中现有预设，任务将等待后续预设决策。",
    };
  }

  return {
    status: "matched",
    presetId: preset.id,
    displayName: preset.displayName,
    sourceIdentifier,
    appliedPresetSourceIdentifier: preset.sourceIdentifier,
    summary: preset.summary,
    defaults: preset.defaults,
  };
}

function parseFieldErrors(error: z.ZodError<ApiTaskCreateInput>) {
  return Object.fromEntries(
    error.issues.map((issue) => [
      issue.path.join(".") || "body",
      issue.message,
    ]),
  );
}

async function parseApiTaskCreateRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throwPublicApiError(
      "TASK_REQUEST_INVALID",
      "Request body must be application/json.",
      {
        status: 422,
        details: {
          fieldErrors: {
            body: "Request body must be application/json.",
          },
        },
      },
    );
  }

  let json: unknown;

  try {
    json = await request.json();
  } catch {
    throwPublicApiError(
      "TASK_REQUEST_INVALID",
      "Request body is not valid JSON.",
      {
        status: 422,
        details: {
          fieldErrors: {
            body: "Request body is not valid JSON.",
          },
        },
      },
    );
  }

  const parsed = apiTaskCreateSchema.safeParse(json);

  if (!parsed.success) {
    throwPublicApiError(
      "TASK_REQUEST_INVALID",
      "Task create request is invalid.",
      {
        status: 422,
        details: {
          fieldErrors: parseFieldErrors(parsed.error),
        },
      },
    );
  }

  return parsed.data;
}

export async function createApiTask(
  request: Request,
  credential: AuthenticatedApiCredential,
) {
  const input = await parseApiTaskCreateRequest(request);
  const requestId = getRequestContext().requestId;

  let source;

  try {
    source = recognizeSourceFromYoutubeUrl(input.sourceUrl);
  } catch (error) {
    throwPublicApiError(
      "TASK_REQUEST_INVALID",
      error instanceof Error ? error.message : "sourceUrl is invalid.",
      {
        status: 422,
        details: {
          fieldErrors: {
            sourceUrl:
              error instanceof Error ? error.message : "sourceUrl is invalid.",
          },
        },
      },
    );
  }

  const preset = await apiTaskCreateTestHooks.findChannelPresetForSourceImpl(
    credential.ownerUserId,
    source.identifier,
  );
  const presetMatch = buildPresetMatch(source.identifier, preset);
  const baseline =
    presetMatch.status === "matched"
      ? presetMatch.defaults
      : getDefaultProcessingBaseline();
  const desiredStatus: TaskStatus =
    presetMatch.status === "matched"
      ? initialTaskStatus
      : "awaiting_preset_decision";
  const taskId = `task_${randomUUID().replace(/-/g, "")}`;
  const createdAt = new Date();
  const db = database();

  await db.transaction(async (tx) => {
    await tx.insert(tasks).values({
      id: taskId,
      creatorUserId: credential.ownerUserId,
      apiCredentialId: credential.id,
      intakeMethod: "youtube_link",
      sourceUrl: input.sourceUrl,
      sourceIdentifier: source.identifier,
      sourceSnapshot: {
        title: source.title,
        confidence: source.confidence,
        recognitionMode: source.recognitionMode,
        previewLabel: source.previewLabel,
        presetMatch,
        requestId,
        createdBy: {
          type: "apiCredential",
          credentialId: credential.id,
        },
        apiRequestMetadata: input.metadata ?? {},
      },
      processingBaselineSnapshot: baseline,
      presetId: presetMatch.status === "matched" ? presetMatch.presetId : null,
      presetSnapshot: presetMatch,
      uploadStorageKey: null,
      status: initialTaskStatus,
      createdAt,
      updatedAt: createdAt,
    });

    await recordTaskCreation({
      taskId,
      requestId,
      actorUserId: credential.ownerUserId,
      payload: {
        createdByType: "api_credential",
        apiCredentialId: credential.id,
        presetResolution: presetMatch.status,
      },
      createdAt,
      db: tx,
    });

    if (desiredStatus !== initialTaskStatus) {
      await transitionTaskStatus({
        taskId,
        fromStatus: initialTaskStatus,
        toStatus: desiredStatus,
        eventType: "task.preset_decision_requested",
        requestId,
        actorUserId: credential.ownerUserId,
        createdAt,
        payload: {
          apiCredentialId: credential.id,
          presetResolution: presetMatch.status,
        },
        db: tx,
      });
    }
  });

  await apiTaskCreateTestHooks.writeAuditLogImpl({
    actorUserId: credential.ownerUserId,
    eventType: "task.api_created",
    resourceType: "task",
    resourceId: taskId,
    outcome: "success",
    detail: {
      apiCredentialId: credential.id,
      sourceType: input.sourceType,
      status: desiredStatus,
    },
  });

  return data(
    {
      data: {
        taskId,
        status: desiredStatus,
        sourceType: input.sourceType,
        createdBy: {
          type: "apiCredential",
          credentialId: credential.id,
        },
        links: {
          task: `/tasks/${taskId}`,
          result: `/tasks/${taskId}/result`,
        },
      },
      meta: {
        requestId,
      },
    },
    {
      status: 201,
      headers: {
        "X-Request-Id": requestId,
      },
    },
  );
}
