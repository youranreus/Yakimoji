import assert from "node:assert/strict";
import test from "node:test";

import {
  createChannelPreset,
  findChannelPresetForSource,
  handleChannelPresetAction,
  listChannelPresetsForUser,
  mergePresetMetadata,
  setChannelPresetTestHooks,
  updateChannelPreset,
} from "../app/features/presets/server/channel-presets.server";
import { createRequestContext, runWithRequestContext } from "../app/features/auth/server/request-context.server";

function makeRow(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-05-27T00:00:00.000Z");

  return {
    id: "preset_1",
    ownerUserId: 7,
    sourceIdentifier: "youtube:KurzgesagtCN",
    displayName: "Kurzgesagt 中文频道",
    translationMode: "英译中字幕",
    subtitleTemplate: "科普模板",
    outputPackage: "mp4 + srt",
    notes: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();

  formData.set("sourceIdentifier", "youtube:KurzgesagtCN");
  formData.set("displayName", "Kurzgesagt 中文频道");
  formData.set("translationMode", "英译中字幕");
  formData.set("subtitleTemplate", "科普模板");
  formData.set("outputPackage", "mp4 + srt");
  formData.set("previewFontSize", "36");
  formData.set("previewTheme", "classic");

  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }

  return formData;
}

test.beforeEach(() => {
  setChannelPresetTestHooks({});
});

test("channel preset list maps saved defaults into creator-readable summaries", async () => {
  setChannelPresetTestHooks({
    listRowsForUserImpl: async () => [makeRow()],
  });

  const presets = await listChannelPresetsForUser(7);

  assert.equal(presets.length, 1);
  assert.equal(presets[0]?.displayName, "Kurzgesagt 中文频道");
  assert.equal(presets[0]?.summary, "英译中字幕 / 科普模板 / mp4 + srt");
  assert.equal(presets[0]?.defaults.subtitleTemplate, "科普模板");
  assert.equal(presets[0]?.previewStyle.fontSize, 36);
  assert.equal(presets[0]?.previewStyle.theme, "classic");
});

test("channel preset detail maps controlled preview metadata into a read-only view model", async () => {
  setChannelPresetTestHooks({
    findRowByIdImpl: async () =>
      makeRow({
        metadata: {
          subtitleStylePreview: {
            fontSize: 44,
            theme: "cinema",
          },
        },
      }),
  });

  const detail = await import("../app/features/presets/server/channel-presets.server").then(
    ({ getChannelPresetByIdForUser }) => getChannelPresetByIdForUser(7, "preset_1"),
  );

  assert.equal(detail?.previewStyle.fontSize, 44);
  assert.equal(detail?.previewStyle.theme, "cinema");
});

test("mergePresetMetadata preserves unrelated metadata keys while updating preview style", () => {
  const merged = mergePresetMetadata(
    {
      foo: "bar",
      subtitleStylePreview: {
        theme: "classic",
        legacyFlag: true,
      },
    },
    {
      previewFontSize: 48,
      previewTheme: "highContrast",
    },
  );

  assert.deepEqual(merged, {
    foo: "bar",
    subtitleStylePreview: {
      theme: "highContrast",
      fontSize: 48,
      legacyFlag: true,
    },
  });
});

test("create channel preset rejects duplicate source identifiers for the same creator", async () => {
  setChannelPresetTestHooks({
    findRowBySourceImpl: async () => makeRow(),
  });

  await assert.rejects(
    runWithRequestContext(
      createRequestContext({
        "x-request-id": "req_duplicate_preset",
      }),
      async () => createChannelPreset(7, makeForm()),
    ),
    (error: any) => {
      assert.equal(error.constructor?.name, "DataWithResponseInit");
      assert.equal(error.data.code, "channel_preset_duplicate");
      assert.equal(error.data.field, "sourceIdentifier");
      assert.equal(error.data.request_id, "req_duplicate_preset");
      return true;
    },
  );
});

test("create channel preset returns field-level validation errors", async () => {
  await assert.rejects(
    runWithRequestContext(
      createRequestContext({
        "x-request-id": "req_invalid_preset",
      }),
      async () =>
        createChannelPreset(
          7,
          makeForm({
            sourceIdentifier: "",
          }),
        ),
    ),
    (error: any) => {
      assert.equal(error.constructor?.name, "DataWithResponseInit");
      assert.equal(error.data.code, "channel_preset_invalid");
      assert.equal(error.data.field, "sourceIdentifier");
      assert.equal(error.data.request_id, "req_invalid_preset");
      return true;
    },
  );
});

test("update channel preset enforces owner isolation", async () => {
  setChannelPresetTestHooks({
    findRowByIdImpl: async () => null,
    updateRowForUserImpl: async () => null,
  });

  await assert.rejects(
    runWithRequestContext(
      createRequestContext({
        "x-request-id": "req_forbidden_preset",
      }),
      async () => updateChannelPreset(7, "preset_other", makeForm()),
    ),
    (error: any) => {
      assert.equal(error.constructor?.name, "DataWithResponseInit");
      assert.equal(error.data.code, "channel_preset_forbidden");
      assert.equal(error.init.status, 403);
      return true;
    },
  );
});

test("handle channel preset action creates and updates presets with request context", async () => {
  let inserted = false;
  let updated = false;
  let receivedMetadata: Record<string, unknown> | null = null;

  setChannelPresetTestHooks({
    findRowBySourceImpl: async () => null,
    findRowByIdImpl: async () =>
      makeRow({
        metadata: {
          existing: "value",
          subtitleStylePreview: {
            theme: "classic",
          },
        },
      }),
    insertRowImpl: async () => {
      inserted = true;
      return makeRow();
    },
    updateRowForUserImpl: async (_ownerUserId, _presetId, input, metadata) => {
      updated = true;
      receivedMetadata = metadata ?? null;
      return makeRow({
        displayName: "Kurzgesagt Updated",
        metadata: mergePresetMetadata(metadata ?? {}, input),
      });
    },
  });

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_preset_action",
    }),
    async () => {
      const createForm = makeForm({
        intent: "create_channel_preset",
      });
      const created = await handleChannelPresetAction(7, createForm);

      assert.equal(created.ok, true);
      assert.equal(created.mode, "created");
      assert.equal(created.requestId, "req_preset_action");
      assert.equal(inserted, true);
      assert.equal(created.preset.previewStyle.fontSize, 36);

      const updateForm = makeForm({
        intent: "update_channel_preset",
        presetId: "preset_1",
        previewFontSize: "42",
        previewTheme: "highContrast",
      });
      const result = await handleChannelPresetAction(7, updateForm);

      assert.equal(result.ok, true);
      assert.equal(result.mode, "updated");
      assert.equal(result.preset.displayName, "Kurzgesagt Updated");
      assert.equal(result.preset.previewStyle.fontSize, 42);
      assert.equal(result.preset.previewStyle.theme, "highContrast");
      assert.deepEqual(receivedMetadata, {
        existing: "value",
        subtitleStylePreview: {
          theme: "classic",
        },
      });
      assert.equal(updated, true);
    },
  );
});

test("source lookup returns the creator-owned preset for familiar source matching", async () => {
  setChannelPresetTestHooks({
    findRowBySourceImpl: async (_ownerUserId, sourceIdentifier) =>
      sourceIdentifier === "youtube:KurzgesagtCN" ? makeRow() : null,
  });

  const match = await findChannelPresetForSource(7, "youtube:KurzgesagtCN");
  const missing = await findChannelPresetForSource(7, "youtube:unknown");

  assert.equal(match?.id, "preset_1");
  assert.equal(missing, null);
});
