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
  createChannelPreset,
  findChannelPresetForSource,
  getChannelPresetByIdForUser,
  type ChannelPresetView,
} from "../../presets/server/channel-presets.server";

import { getDefaultProcessingBaseline } from "./task-baseline.server";
import { recordTaskCreation } from "./task-events.server";
import { createTaskActionError, type TaskActionError } from "./task-errors.server";
import { isValidSubtitleTemplateOverride } from "../task-intake.shared";
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

type PresetDefaults = ReturnType<typeof getDefaultProcessingBaseline>;

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
  baseline: PresetDefaults;
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
      appliedPresetSourceIdentifier: string;
      summary: string;
      defaults: PresetDefaults;
    }
  | {
      status: "unresolved";
      sourceIdentifier: string;
      summary: string;
    }
  | {
      status: "manual_reuse";
      presetId: string;
      displayName: string;
      sourceIdentifier: string;
      appliedPresetSourceIdentifier: string;
      summary: string;
      defaults: PresetDefaults;
    }
  | {
      status: "manual_create";
      presetId: string;
      displayName: string;
      sourceIdentifier: string;
      appliedPresetSourceIdentifier: string;
      summary: string;
      defaults: PresetDefaults;
    }
  | {
      status: "continue_without_preset";
      sourceIdentifier: string;
      summary: string;
    };

export type TaskIntakeActionResult =
  | TaskPreviewPayload
  | TaskCreatedPayload
  | TaskActionError;

type TaskIntakeDraftRecord = {
  intakeMethod: "youtube_link";
  sourceUrl: string | null;
  sourceIdentifier: string | null;
  sourceSnapshot: Record<string, unknown>;
  processingBaselineSnapshot: Record<string, unknown>;
  uploadStorageKey: string | null;
  expiresAt: Date;
};

type TaskSourceSnapshot = {
  title?: string;
  confidence?: string;
  recognitionMode?: string;
  previewLabel?: string;
  presetMatch?: TaskPresetMatch;
  taskLevelOverrides?: {
    subtitleTemplate?: string;
  };
};

export const taskIntakeTestHooks = {
  parseFormDataImpl: parseFormData,
  persistUploadedVideoImpl: persistUploadedVideo,
  deleteStoredUploadImpl: deleteStoredUpload,
  nowImpl: () => new Date(),
  findChannelPresetForSourceImpl: findChannelPresetForSource,
  getChannelPresetByIdForUserImpl: getChannelPresetByIdForUser,
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
  taskIntakeTestHooks.getChannelPresetByIdForUserImpl =
    hooks.getChannelPresetByIdForUserImpl ?? getChannelPresetByIdForUser;
}

function buildBaselineSummary(baseline: PresetDefaults) {
  return `${baseline.translationMode} / ${baseline.subtitleTemplate} / ${baseline.outputPackage}`;
}

function buildResolvedPresetMatch(
  sourceIdentifier: string,
  preset: ChannelPresetView | null,
): TaskPresetMatch {
  if (!preset) {
    return {
      status: "unresolved",
      sourceIdentifier,
      summary:
        "当前来源未命中现有预设。请选择复用已有预设、新建最小预设，或不保存预设继续当前任务。",
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

function buildManualPresetMatch(
  sourceIdentifier: string,
  preset: ChannelPresetView,
  mode: "manual_reuse" | "manual_create",
): TaskPresetMatch {
  return {
    status: mode,
    presetId: preset.id,
    displayName: preset.displayName,
    sourceIdentifier,
    appliedPresetSourceIdentifier: preset.sourceIdentifier,
    summary:
      mode === "manual_reuse"
        ? `手动复用预设「${preset.displayName}」继续当前任务：${preset.summary}`
        : `已为当前来源创建最小预设「${preset.displayName}」并继续当前任务：${preset.summary}`,
    defaults: preset.defaults,
  };
}

function buildContinueWithoutPresetMatch(
  sourceIdentifier: string,
  baseline: PresetDefaults,
): TaskPresetMatch {
  return {
    status: "continue_without_preset",
    sourceIdentifier,
    summary: `未保存频道预设，继续使用当前默认处理基线：${buildBaselineSummary(baseline)}`,
  };
}

function getSubtitleTemplateOverride(formData: FormData) {
  const value = formData.get("subtitleTemplateOverride");

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function assertOverrideSupportedForIntent(
  intent: ReturnType<typeof assertIntent>,
  override: string | null,
) {
  if (intent !== "confirm_continue_without_preset" || override == null) {
    return;
  }

  throw createTaskActionError(
    "manual_resolution_invalid",
    "任务级字幕模板覆盖仅支持基于预设继续的任务，请先复用或创建预设后再设置覆盖。",
    { field: "subtitleTemplateOverride" },
  );
}

function applySubtitleTemplateOverride(
  baseline: PresetDefaults,
  override: string | null,
) {
  if (!override) {
    return baseline;
  }

  if (!isValidSubtitleTemplateOverride(override)) {
    throw createTaskActionError(
      "manual_resolution_invalid",
      "请选择一个可用的字幕模板后再继续。",
      { field: "subtitleTemplateOverride" },
    );
  }

  return {
    ...baseline,
    subtitleTemplate: override,
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
    intent === "confirm" ||
    intent === "confirm_manual_reuse" ||
    intent === "confirm_manual_create" ||
    intent === "confirm_continue_without_preset"
  ) {
    return intent;
  }

  throw createTaskActionError("invalid_intake", "当前任务导入动作无效。");
}

function isDataErrorLike(
  error: unknown,
): error is {
  data?: {
    message?: unknown;
    field?: unknown;
  };
} {
  return typeof error === "object" && error !== null && "data" in error;
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

async function getDraftForUser(
  userId: number,
  draftToken: string,
): Promise<TaskIntakeDraftRecord | null> {
  const db = database();
  const [draft] = await db
    .select({
      intakeMethod: taskIntakeDrafts.intakeMethod,
      sourceUrl: taskIntakeDrafts.sourceUrl,
      sourceIdentifier: taskIntakeDrafts.sourceIdentifier,
      sourceSnapshot: taskIntakeDrafts.sourceSnapshot,
      processingBaselineSnapshot: taskIntakeDrafts.processingBaselineSnapshot,
      uploadStorageKey: taskIntakeDrafts.uploadStorageKey,
      expiresAt: taskIntakeDrafts.expiresAt,
    })
    .from(taskIntakeDrafts)
    .where(
      and(
        eq(taskIntakeDrafts.token, draftToken),
        eq(taskIntakeDrafts.creatorUserId, userId),
      ),
    )
    .limit(1);

  return (draft as TaskIntakeDraftRecord | undefined) ?? null;
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
  const presetMatch = buildResolvedPresetMatch(source.identifier, preset);
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
  const intent = assertIntent(formData);
  const draftToken = assertDraftToken(formData.get("draftToken"));
  const now = taskIntakeTestHooks.nowImpl();
  const draft = await getDraftForUser(userId, draftToken);

  if (!draft || draft.expiresAt.getTime() <= now.getTime()) {
    throw createTaskActionError(
      "confirmation_failed",
      "识别预览已过期，请重新导入后再确认提交。",
      { field: "draftToken", retryable: true },
    );
  }

  const taskId = `task_${randomUUID().replace(/-/g, "")}`;
  const db = database();
  const sourceIdentifier = draft.sourceIdentifier ?? "youtube:unknown";
  const defaultBaseline = draft.processingBaselineSnapshot as PresetDefaults;
  const sourceSnapshot = draft.sourceSnapshot as TaskSourceSnapshot;
  const draftPresetMatch =
    sourceSnapshot.presetMatch ??
    buildResolvedPresetMatch(sourceIdentifier, null);
  const subtitleTemplateOverride = getSubtitleTemplateOverride(formData);
  assertOverrideSupportedForIntent(intent, subtitleTemplateOverride);

  let baseline: PresetDefaults;
  let presetMatch: TaskPresetMatch;

  if (intent === "confirm") {
    if (draftPresetMatch.status !== "matched") {
      throw createTaskActionError(
        "confirmation_failed",
        "当前来源尚未完成预设决策，请先选择继续方式后再创建任务。",
        { field: "draftToken", retryable: true },
      );
    }

    baseline = applySubtitleTemplateOverride(
      draftPresetMatch.defaults,
      subtitleTemplateOverride,
    );
    presetMatch = draftPresetMatch;
  } else if (intent === "confirm_manual_reuse") {
    const presetId = formData.get("presetId");

    if (typeof presetId !== "string" || !presetId.trim()) {
      throw createTaskActionError(
        "manual_resolution_invalid",
        "请选择一个可复用的频道预设后再继续。",
        { field: "presetId" },
      );
    }

    const preset = await taskIntakeTestHooks.getChannelPresetByIdForUserImpl(
      userId,
      presetId.trim(),
    );

    if (!preset) {
      throw createTaskActionError(
        "manual_resolution_invalid",
        "所选频道预设不可用，请重新选择后再继续。",
        { field: "presetId", retryable: true },
      );
    }

    baseline = applySubtitleTemplateOverride(
      preset.defaults,
      subtitleTemplateOverride,
    );
    presetMatch = buildManualPresetMatch(
      sourceIdentifier,
      preset,
      "manual_reuse",
    );
  } else if (intent === "confirm_manual_create") {
    const presetFormData = new FormData();
    presetFormData.set("sourceIdentifier", sourceIdentifier);

    for (const field of [
      "displayName",
      "translationMode",
      "subtitleTemplate",
      "outputPackage",
      "notes",
    ] as const) {
      const value = formData.get(field);

      if (typeof value === "string") {
        presetFormData.set(field, value);
      }
    }

    let createdPreset: ChannelPresetView;

    try {
      createdPreset = await createChannelPreset(userId, presetFormData);
    } catch (error) {
      if (isDataErrorLike(error)) {
        throw createTaskActionError(
          "manual_resolution_invalid",
          typeof error.data?.message === "string"
            ? error.data.message
            : "最小预设创建失败，请修正后重试。",
          {
            field:
              typeof error.data?.field === "string"
                ? error.data.field
                : undefined,
          },
        );
      }

      throw error;
    }

    baseline = applySubtitleTemplateOverride(
      createdPreset.defaults,
      subtitleTemplateOverride,
    );
    presetMatch = buildManualPresetMatch(
      sourceIdentifier,
      createdPreset,
      "manual_create",
    );
  } else {
    baseline = defaultBaseline;
    presetMatch = buildContinueWithoutPresetMatch(sourceIdentifier, baseline);
  }

  await db.transaction(async (tx) => {
    await tx.insert(tasks).values({
      id: taskId,
      creatorUserId: userId,
      intakeMethod: "youtube_link",
      sourceUrl: draft.sourceUrl,
      sourceIdentifier,
      sourceSnapshot: {
        title: sourceSnapshot.title,
        confidence: sourceSnapshot.confidence,
        recognitionMode: sourceSnapshot.recognitionMode,
        previewLabel: sourceSnapshot.previewLabel,
        presetMatch,
        taskLevelOverrides:
          subtitleTemplateOverride == null
            ? {}
            : {
                subtitleTemplate: subtitleTemplateOverride,
              },
        requestId,
      },
      processingBaselineSnapshot: baseline,
      presetId:
        presetMatch.status === "matched" ||
        presetMatch.status === "manual_reuse" ||
        presetMatch.status === "manual_create"
          ? presetMatch.presetId
          : null,
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
      payload: {
        presetResolution: presetMatch.status,
        subtitleTemplateOverride,
      },
      createdAt: now,
      db: tx,
    });

    await tx
      .delete(taskIntakeDrafts)
      .where(
        and(
          eq(taskIntakeDrafts.token, draftToken),
          eq(taskIntakeDrafts.creatorUserId, userId),
        ),
      )
      .returning({
        token: taskIntakeDrafts.token,
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
      sourceIdentifier,
      sourceTitle: sourceSnapshot.title ?? sourceIdentifier,
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
    const baseline = record.processingBaselineSnapshot as PresetDefaults;

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
