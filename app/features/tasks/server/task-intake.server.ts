import { randomUUID } from "node:crypto";
import path from "node:path";

import {
  FormDataParseError,
  MaxFileSizeExceededError,
  MaxFilesExceededError,
  MaxPartsExceededError,
  parseFormData,
  type FileUpload,
} from "@remix-run/form-data-parser";
import { and, desc, eq, lt } from "drizzle-orm";

import { database } from "../../../../database/context";
import { taskIntakeDrafts, tasks } from "../../../../database/schema";
import { getRequestContext } from "../../auth/server/request-context.server";
import {
  findChannelPresetForSource,
  type ChannelPresetView,
} from "../../presets/server/channel-presets.server";

import { getDefaultProcessingBaseline } from "./task-baseline.server";
import { recordTaskCreation } from "./task-events.server";
import { createTaskActionError, type TaskActionError } from "./task-errors.server";
import { recognizeSourceFromUpload, recognizeSourceFromYoutubeUrl } from "./source-recognition.server";
import { initialTaskStatus, type TaskStatus } from "./task-status.server";
import { deleteStoredUpload, persistUploadedVideo } from "./upload-storage.server";

const supportedVideoTypes = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-matroska",
  "video/webm",
]);

const supportedVideoExtensions = new Set([".mp4", ".mov", ".mkv", ".webm"]);
const maxUploadSize = 512 * 1024 * 1024;
const draftTtlMs = 30 * 60 * 1000;

export type TaskPreviewPayload = {
  ok: true;
  mode: "preview";
  intakeMethod: "youtube_link";
  draftToken: string;
  requestId: string;
  status: TaskStatus;
  source: {
    identifier: string;
    title: string;
    recognitionMode: "youtube_link";
    confidence: "high";
    previewLabel: string;
  };
  baseline: ReturnType<typeof getDefaultProcessingBaseline>;
  presetMatch: TaskPresetMatch;
};

export type TaskCreatedPayload = {
  ok: true;
  mode: "created";
  requestId: string;
  task: {
    id: string;
    status: TaskStatus;
    intakeMethod: "youtube_link";
    sourceIdentifier: string;
    sourceTitle: string;
    baselineSummary: string;
    presetMatch: TaskPresetMatch;
    createdAt: string;
  };
};

export type TaskPresetMatch =
  | {
      status: "matched";
      presetId: string;
      displayName: string;
      sourceIdentifier: string;
      summary: string;
      defaults: ChannelPresetView["defaults"];
    }
  | {
      status: "none";
      sourceIdentifier: string;
      summary: string;
    };

export type TaskIntakeActionResult =
  | TaskPreviewPayload
  | TaskCreatedPayload
  | TaskActionError;

export const taskIntakeTestHooks = {
  parseFormDataImpl: parseFormData,
  persistUploadedVideoImpl: persistUploadedVideo,
  deleteStoredUploadImpl: deleteStoredUpload,
  nowImpl: () => new Date(),
  findChannelPresetForSourceImpl: findChannelPresetForSource,
};

export function setTaskIntakeTestHooks(
  hooks: Partial<typeof taskIntakeTestHooks>,
) {
  taskIntakeTestHooks.parseFormDataImpl =
    hooks.parseFormDataImpl ?? parseFormData;
  taskIntakeTestHooks.persistUploadedVideoImpl =
    hooks.persistUploadedVideoImpl ?? persistUploadedVideo;
  taskIntakeTestHooks.deleteStoredUploadImpl =
    hooks.deleteStoredUploadImpl ?? deleteStoredUpload;
  taskIntakeTestHooks.nowImpl = hooks.nowImpl ?? (() => new Date());
  taskIntakeTestHooks.findChannelPresetForSourceImpl =
    hooks.findChannelPresetForSourceImpl ?? findChannelPresetForSource;
}

function buildBaselineSummary(baseline: ReturnType<typeof getDefaultProcessingBaseline>) {
  return `${baseline.translationMode} / ${baseline.subtitleTemplate} / ${baseline.outputPackage}`;
}

function buildPresetMatch(
  sourceIdentifier: string,
  preset: ChannelPresetView | null,
): TaskPresetMatch {
  if (!preset) {
    return {
      status: "none",
      sourceIdentifier,
      summary: "未命中频道预设，将使用当前默认处理基线。",
    };
  }

  return {
    status: "matched",
    presetId: preset.id,
    displayName: preset.displayName,
    sourceIdentifier: preset.sourceIdentifier,
    summary: preset.summary,
    defaults: preset.defaults,
  };
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

  if (
    intent === "preview_youtube" ||
    intent === "preview_upload" ||
    intent === "confirm"
  ) {
    return intent;
  }

  throw createTaskActionError("invalid_intake", "当前任务导入动作无效。");
}

async function cleanupExpiredDrafts() {
  const now = taskIntakeTestHooks.nowImpl();
  const db = database();
  const expiredDrafts = await db
    .delete(taskIntakeDrafts)
    .where(lt(taskIntakeDrafts.expiresAt, now))
    .returning({
      uploadStorageKey: taskIntakeDrafts.uploadStorageKey,
    });

  await Promise.all(
    expiredDrafts
      .map((draft) => draft.uploadStorageKey)
      .filter((value): value is string => Boolean(value))
      .map((storageKey) => taskIntakeTestHooks.deleteStoredUploadImpl(storageKey)),
  );
}

async function parseVideoUpload(request: Request) {
  let uploadedFile: FileUpload | null = null;
  let formData: FormData | null = null;

  try {
    formData = await taskIntakeTestHooks.parseFormDataImpl(
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

  const extension = path.extname(file.name).toLowerCase();
  const hasSupportedType = supportedVideoTypes.has(file.type);
  const hasSupportedExtension = supportedVideoExtensions.has(extension);

  if (!hasSupportedType && !hasSupportedExtension) {
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

async function createYoutubePreviewDraft(
  userId: number,
  sourceUrl: string,
): Promise<TaskPreviewPayload> {
  const requestId = getRequestContext().requestId;
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

  const preset = await taskIntakeTestHooks.findChannelPresetForSourceImpl(
    userId,
    source.identifier,
  );
  const presetMatch = buildPresetMatch(source.identifier, preset);
  const baseline =
    presetMatch.status === "matched"
      ? presetMatch.defaults
      : getDefaultProcessingBaseline();

  const draftToken = `draft_${randomUUID().replace(/-/g, "")}`;
  const now = taskIntakeTestHooks.nowImpl();
  const expiresAt = new Date(now.getTime() + draftTtlMs);
  const db = database();

  await db.insert(taskIntakeDrafts).values({
    token: draftToken,
    creatorUserId: userId,
    intakeMethod: "youtube_link",
    sourceUrl,
    sourceIdentifier: source.identifier,
    sourceSnapshot: {
      title: source.title,
      confidence: source.confidence,
      recognitionMode: source.recognitionMode,
      previewLabel: source.previewLabel,
      presetMatch,
      requestId,
    },
    processingBaselineSnapshot: baseline,
    uploadStorageKey: null,
    uploadSnapshot: {},
    expiresAt,
    createdAt: now,
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
    presetMatch,
  };
}

async function previewUploadedVideo(request: Request): Promise<TaskActionError> {
  const { formData, uploadedFile } = await parseVideoUpload(request);
  const intent = assertIntent(formData);

  if (intent !== "preview_upload") {
    throw createTaskActionError("invalid_upload", "当前上传请求缺少有效的导入意图。", {
      field: "videoFile",
    });
  }

  const file = validateUploadedVideo(uploadedFile);
  const storedUpload = await taskIntakeTestHooks.persistUploadedVideoImpl(file);

  try {
    const source = recognizeSourceFromUpload(file.name);

    if (!source || source.identifier == null) {
      return createTaskActionError(
        "source_recognition_failed",
        "当前上传文件仍无法可靠识别来源，请改用 YouTube 链接或稍后重试。",
        { field: "videoFile", retryable: true },
      ).data as TaskActionError;
    }

    return createTaskActionError(
      "source_recognition_failed",
      `${source.previewLabel}，请改用 YouTube 链接继续创建任务。`,
      { field: "videoFile", retryable: true },
    ).data as TaskActionError;
  } finally {
    await taskIntakeTestHooks.deleteStoredUploadImpl(storedUpload.storageKey);
  }
}

export async function confirmTaskCreation(
  userId: number,
  formData: FormData,
): Promise<TaskCreatedPayload> {
  const requestId = getRequestContext().requestId;
  const draftToken = assertDraftToken(formData.get("draftToken"));
  const db = database();
  const now = taskIntakeTestHooks.nowImpl();
  const [draft] = await db
    .delete(taskIntakeDrafts)
    .where(
      and(
        eq(taskIntakeDrafts.token, draftToken),
        eq(taskIntakeDrafts.creatorUserId, userId),
      ),
    )
    .returning({
      intakeMethod: taskIntakeDrafts.intakeMethod,
      sourceUrl: taskIntakeDrafts.sourceUrl,
      sourceIdentifier: taskIntakeDrafts.sourceIdentifier,
      sourceSnapshot: taskIntakeDrafts.sourceSnapshot,
      processingBaselineSnapshot: taskIntakeDrafts.processingBaselineSnapshot,
      uploadStorageKey: taskIntakeDrafts.uploadStorageKey,
      expiresAt: taskIntakeDrafts.expiresAt,
    });

  if (!draft || draft.expiresAt.getTime() <= now.getTime()) {
    throw createTaskActionError(
      "confirmation_failed",
      "识别预览已过期，请重新导入后再确认提交。",
      { field: "draftToken", retryable: true },
    );
  }

  const taskId = `task_${randomUUID().replace(/-/g, "")}`;
  const baseline = draft.processingBaselineSnapshot as ReturnType<typeof getDefaultProcessingBaseline>;
  const sourceSnapshot = draft.sourceSnapshot as {
    title?: string;
    confidence?: string;
    recognitionMode?: string;
    previewLabel?: string;
    presetMatch?: TaskPresetMatch;
  };
  const presetMatch =
    sourceSnapshot.presetMatch ??
    buildPresetMatch(draft.sourceIdentifier ?? "youtube:unknown", null);

  await db.transaction(async (tx) => {
    await tx.insert(tasks).values({
      id: taskId,
      creatorUserId: userId,
      intakeMethod: "youtube_link",
      sourceUrl: draft.sourceUrl,
      sourceIdentifier: draft.sourceIdentifier ?? "youtube:unknown",
      sourceSnapshot: {
        title: sourceSnapshot.title,
        confidence: sourceSnapshot.confidence,
        recognitionMode: sourceSnapshot.recognitionMode,
        previewLabel: sourceSnapshot.previewLabel,
        presetMatch,
        requestId,
      },
      processingBaselineSnapshot: baseline,
      presetId: presetMatch.status === "matched" ? presetMatch.presetId : null,
      presetSnapshot: presetMatch,
      uploadStorageKey: draft.uploadStorageKey,
      status: initialTaskStatus,
      createdAt: now,
      updatedAt: now,
    });

    await recordTaskCreation({
      taskId,
      requestId,
      actorUserId: userId,
      createdAt: now,
      db: tx,
    });
  });

  return {
    ok: true,
    mode: "created",
    requestId,
    task: {
      id: taskId,
      status: initialTaskStatus,
      intakeMethod: "youtube_link",
      sourceIdentifier: draft.sourceIdentifier ?? "youtube:unknown",
      sourceTitle: sourceSnapshot.title ?? draft.sourceIdentifier ?? "未知来源",
      baselineSummary: buildBaselineSummary(baseline),
      presetMatch,
      createdAt: now.toISOString(),
    },
  };
}

export async function handleTaskIntakeAction(
  userId: number,
  request: Request,
): Promise<TaskIntakeActionResult> {
  await cleanupExpiredDrafts();

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    return previewUploadedVideo(request);
  }

  const formData = await request.formData();
  const intent = assertIntent(formData);

  if (intent === "preview_upload") {
    return createTaskActionError(
      "invalid_upload",
      "上传视频必须使用 multipart/form-data 表单编码，请重新选择文件后再试。",
      { field: "videoFile", retryable: true },
    ).data as TaskActionError;
  }

  if (intent === "preview_youtube") {
    const sourceUrl = assertYoutubeUrlInput(formData.get("sourceUrl"));
    return createYoutubePreviewDraft(userId, sourceUrl);
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
