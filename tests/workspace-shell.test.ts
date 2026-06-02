import assert from "node:assert/strict";
import test from "node:test";

import { resolveWorkspacePreview } from "../app/shared/ui/WorkspaceShell";

test("confirm inline error keeps the existing preview context visible", () => {
  const preview = {
    ok: true,
    mode: "preview",
    intakeMethod: "youtube_link",
    draftToken: "draft_1",
    requestId: "req_preview",
    status: "awaiting_confirmation",
    source: {
      identifier: "youtube:UnknownChannel",
      title: "Unknown Channel",
      recognitionMode: "youtube_link",
      confidence: "high",
      previewLabel: "来源识别完成",
    },
    baseline: {
      translationMode: "英译中字幕",
      subtitleTemplate: "科普模板",
      outputPackage: "mp4 + srt",
    },
    presetMatch: {
      status: "unresolved",
      sourceIdentifier: "youtube:UnknownChannel",
      summary: "当前来源未命中现有预设。",
    },
  } as const;

  const error = {
    ok: false,
    code: "manual_resolution_invalid",
    message: "请选择一个可用的字幕模板后再继续。",
    field: "subtitleTemplateOverride",
    request_id: "req_preview",
  } as const;

  const resolved = resolveWorkspacePreview({
    actionData: null,
    youtubeData: preview,
    uploadData: null,
    confirmData: error,
  });

  assert.deepEqual(resolved, preview);
});
