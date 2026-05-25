import { randomUUID } from "node:crypto";

import {
  FormDataParseError,
  MaxFileSizeExceededError,
  MaxFilesExceededError,
  MaxPartsExceededError,
  parseFormData,
  type FileUpload,
} from "@remix-run/form-data-parser";
import { desc, eq } from "drizzle-orm";

import { database } from "../../../../database/context";
import { tasks } from "../../../../database/schema";
import { getRequestContext } from "../../auth/server/request-context.server";

import { getDefaultProcessingBaseline } from "./task-baseline.server";
import { createTaskActionError } from "./task-errors.server";
import { recognizeSourceFromUpload, recognizeSourceFromYoutubeUrl } from "./source-recognition.server";
import { initialTaskStatus, type TaskStatus } from "./task-status.server";
import { persistUploadedVideo } from "./upload-storage.server";

const supportedVideoTypes = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-matroska",
  "video/webm",
]);

const maxUploadSize = 512 * 1024 * 1024;

export type TaskPreviewPayload = {
  ok: true;
  mode: "preview";
  intakeMethod: "youtube_link" | "video_upload";
  draftToken: string;
  requestId: string;
  status: TaskStatus;
  source: {
    identifier: string;
    title: string;
    recognitionMode: "youtube_link" | "video_upload";
    confidence: "high" | "unknown";
    previewLabel: string;
  };
  baseline: ReturnType<typeof getDefaultProcessingBaseline>;
  upload?: {
    storageKey: string;
    fileName: string;
    contentType: string;
    size: number;
  };
};

export type TaskCreatedPayload = {
  ok: true;
  mode: "created";
  requestId: string;
  task: {
    id: string;
    status: TaskStatus;
    intakeMethod: "youtube_link" | "video_upload";
    sourceIdentifier: string;
    sourceTitle: string;
    baselineSummary: string;
    createdAt: string;
  };
};

type PreviewDraft =
  | {
      intakeMethod: "youtube_link";
      sourceUrl: string;
      uploadStorageKey: null;
      uploadMeta: null;
      source: TaskPreviewPayload["source"];
    }
  | {
      intakeMethod: "video_upload";
      sourceUrl: null;
      uploadStorageKey: string;
      uploadMeta: NonNullable<TaskPreviewPayload["upload"]>;
      source: TaskPreviewPayload["source"];
    };

const previewDrafts = new Map<string, PreviewDraft>();

export const taskIntakeTestHooks = {
  parseFormDataImpl: parseFormData,
  persistUploadedVideoImpl: persistUploadedVideo,
};

export function setTaskIntakeTestHooks(
  hooks: Partial<typeof taskIntakeTestHooks>,
) {
  taskIntakeTestHooks.parseFormDataImpl =
    hooks.parseFormDataImpl ?? parseFormData;
  taskIntakeTestHooks.persistUploadedVideoImpl =
    hooks.persistUploadedVideoImpl ?? persistUploadedVideo;
}

function buildBaselineSummary(baseline: ReturnType<typeof getDefaultProcessingBaseline>) {
  return `${baseline.translationMode} / ${baseline.subtitleTemplate} / ${baseline.outputPackage}`;
}

function assertYoutubeUrlInput(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    throw createTaskActionError(
      "invalid_youtube_url",
      "请输入有效的 YouTube 链接后再开始识别。",
      { field: "sourceUrl" },
    );
  }

  return value.trim();
}

function assertDraftToken(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    throw createTaskActionError(
      "confirmation_failed",
      "当前确认上下文已失效，请重新导入并识别来源。",
      { field: "draftToken" },
    );
  }

  return value.trim();
}

function assertIntent(formData: FormData) {
  const intent = formData.get("intent");

  if (intent === "preview" || intent === "confirm") {
    return intent;
  }

  throw createTaskActionError("invalid_intake", "当前任务导入动作无效。");
}

async function parseVideoUpload(request: Request) {
  let uploadedFile: FileUpload | null = null;

  try {
    const formData = await taskIntakeTestHooks.parseFormDataImpl(
      request,
      {
        maxFiles: 1,
        maxFileSize: maxUploadSize,
        maxParts: 10,
      },
      (file) => {
        uploadedFile = file;
        return file.name;
      },
    );

    return {
      formData,
      uploadedFile,
    };
  } catch (error) {
    if (error instanceof MaxFilesExceededError) {
      throw createTaskActionError("invalid_upload", "一次只能上传一个视频文件。", {
        field: "videoFile",
      });
    }

    if (error instanceof MaxFileSizeExceededError) {
      throw createTaskActionError("invalid_upload", "视频文件过大，请控制在 512MB 以内。", {
        field: "videoFile",
      });
    }

    if (error instanceof MaxPartsExceededError || error instanceof FormDataParseError) {
      throw createTaskActionError("invalid_upload", "上传数据无法解析，请重新选择视频文件。", {
        field: "videoFile",
      });
    }

    throw error;
  }
}

function validateUploadedVideo(file: FileUpload | null) {
  if (!file) {
    throw createTaskActionError("invalid_upload", "请先选择一个待导入的视频文件。", {
      field: "videoFile",
    });
  }

  if (!supportedVideoTypes.has(file.type)) {
    throw createTaskActionError("unsupported_media_type", "当前仅支持 mp4、mov、mkv 和 webm 视频。", {
      field: "videoFile",
    });
  }

  if (file.size === 0) {
    throw createTaskActionError("invalid_upload", "上传文件为空，请重新选择有效视频。", {
      field: "videoFile",
    });
  }

  return file;
}

export async function previewTaskIntake(request: Request): Promise<TaskPreviewPayload> {
  const contentType = request.headers.get("content-type") ?? "";
  const requestId = getRequestContext().requestId;
  const baseline = getDefaultProcessingBaseline();

  if (contentType.includes("multipart/form-data")) {
    const { uploadedFile } = await parseVideoUpload(request);
    const file = validateUploadedVideo(uploadedFile);
    const storedUpload = await taskIntakeTestHooks.persistUploadedVideoImpl(file);
    const source = recognizeSourceFromUpload(file.name);

    if (!source) {
      throw createTaskActionError(
        "source_recognition_failed",
        "当前上传文件不足以识别来源，请更换文件或改用 YouTube 链接。",
        { field: "videoFile", retryable: true },
      );
    }

    const draftToken = `draft_${randomUUID().replace(/-/g, "")}`;

    previewDrafts.set(draftToken, {
      intakeMethod: "video_upload",
      sourceUrl: null,
      uploadStorageKey: storedUpload.storageKey,
      uploadMeta: {
        storageKey: storedUpload.storageKey,
        fileName: storedUpload.originalFileName,
        contentType: storedUpload.contentType,
        size: storedUpload.size,
      },
      source,
    });

    return {
      ok: true,
      mode: "preview",
      intakeMethod: "video_upload",
      draftToken,
      requestId,
      status: "resolving_source",
      source,
      baseline,
      upload: {
        storageKey: storedUpload.storageKey,
        fileName: storedUpload.originalFileName,
        contentType: storedUpload.contentType,
        size: storedUpload.size,
      },
    };
  }

  const formData = await request.formData();
  const sourceUrl = assertYoutubeUrlInput(formData.get("sourceUrl"));

  let source;

  try {
    source = recognizeSourceFromYoutubeUrl(sourceUrl);
  } catch (error) {
    throw createTaskActionError(
      "invalid_youtube_url",
      error instanceof Error ? error.message : "请输入有效的 YouTube 链接。",
      { field: "sourceUrl" },
    );
  }

  const draftToken = `draft_${randomUUID().replace(/-/g, "")}`;
  previewDrafts.set(draftToken, {
    intakeMethod: "youtube_link",
    sourceUrl,
    uploadStorageKey: null,
    uploadMeta: null,
    source,
  });

  return {
    ok: true,
    mode: "preview",
    intakeMethod: "youtube_link",
    draftToken,
    requestId,
    status: "resolving_source",
    source,
    baseline,
  };
}

export async function confirmTaskCreation(
  userId: number,
  formData: FormData,
): Promise<TaskCreatedPayload> {
  const requestId = getRequestContext().requestId;
  const draftToken = assertDraftToken(formData.get("draftToken"));
  const draft = previewDrafts.get(draftToken);

  if (!draft) {
    throw createTaskActionError(
      "confirmation_failed",
      "识别预览已过期，请重新导入后再确认提交。",
      { field: "draftToken", retryable: true },
    );
  }

  const db = database();
  const taskId = `task_${randomUUID().replace(/-/g, "")}`;
  const baseline = getDefaultProcessingBaseline();
  const now = new Date();

  await db.insert(tasks).values({
    id: taskId,
    creatorUserId: userId,
    intakeMethod: draft.intakeMethod,
    sourceUrl: draft.sourceUrl,
    sourceIdentifier: draft.source.identifier,
    sourceSnapshot: {
      title: draft.source.title,
      confidence: draft.source.confidence,
      recognitionMode: draft.source.recognitionMode,
      previewLabel: draft.source.previewLabel,
      requestId,
    },
    processingBaselineSnapshot: baseline,
    uploadStorageKey: draft.uploadStorageKey,
    status: initialTaskStatus,
    createdAt: now,
    updatedAt: now,
  });

  previewDrafts.delete(draftToken);

  return {
    ok: true,
    mode: "created",
    requestId,
    task: {
      id: taskId,
      status: initialTaskStatus,
      intakeMethod: draft.intakeMethod,
      sourceIdentifier: draft.source.identifier,
      sourceTitle: draft.source.title,
      baselineSummary: buildBaselineSummary(baseline),
      createdAt: now.toISOString(),
    },
  };
}

export async function handleTaskIntakeAction(userId: number, request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    return previewTaskIntake(request);
  }

  const formData = await request.formData();
  const intent = assertIntent(formData);

  if (intent === "preview") {
    const previewRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: new URLSearchParams(
        Array.from(formData.entries()).flatMap(([key, value]) =>
          typeof value === "string" ? [[key, value]] : [],
        ),
      ),
    });

    return previewTaskIntake(previewRequest);
  }

  return confirmTaskCreation(userId, formData);
}

export async function listRecentTasksForUser(userId: number) {
  const db = database();
  const records = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      intakeMethod: tasks.intakeMethod,
      sourceIdentifier: tasks.sourceIdentifier,
      sourceSnapshot: tasks.sourceSnapshot,
      processingBaselineSnapshot: tasks.processingBaselineSnapshot,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .where(eq(tasks.creatorUserId, userId))
    .orderBy(desc(tasks.createdAt))
    .limit(5);

  return records.map((record) => {
    const sourceSnapshot = record.sourceSnapshot as { title?: string } | null;
    const baseline = record.processingBaselineSnapshot as ReturnType<typeof getDefaultProcessingBaseline>;

    return {
      id: record.id,
      status: record.status as TaskStatus,
      intakeMethod: record.intakeMethod as "youtube_link" | "video_upload",
      sourceIdentifier: record.sourceIdentifier,
      sourceTitle: sourceSnapshot?.title ?? record.sourceIdentifier,
      baselineSummary: buildBaselineSummary(baseline),
      createdAt: record.createdAt.toISOString(),
    };
  });
}

export function __resetTaskIntakeDraftsForTests() {
  previewDrafts.clear();
}
