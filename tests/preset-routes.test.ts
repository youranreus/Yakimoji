import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  handlePresetCreateRouteAction,
  handlePresetEditRouteAction,
  loadPresetDetailRouteViewModel,
  loadPresetEditRouteViewModel,
  loadPresetRouteViewModel,
  setPresetRouteTestHooks,
} from "../app/features/presets/server/preset-routes.server";
import { createRequestContext, runWithRequestContext } from "../app/features/auth/server/request-context.server";

const repoRoot = process.cwd();

function readText(filePath: string) {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

test.beforeEach(() => {
  setPresetRouteTestHooks({});
});

test("preset routes are registered as dedicated list and create entry points", () => {
  const routes = readText("app/routes.ts");
  const listRoute = readText("app/routes/presets.tsx");
  const newRoute = readText("app/routes/presets.new.tsx");
  const detailRoute = readText("app/routes/presets.$presetId.tsx");
  const editRoute = readText("app/routes/presets.$presetId.edit.tsx");
  const component = readText("app/features/presets/components/ChannelPresetWorkbench.tsx");

  assert.match(routes, /route\("presets", "routes\/presets\.tsx"\)/);
  assert.match(routes, /route\("presets\/new", "routes\/presets\.new\.tsx"\)/);
  assert.match(routes, /route\("presets\/:presetId", "routes\/presets\.\$presetId\.tsx"\)/);
  assert.match(routes, /route\("presets\/:presetId\/edit", "routes\/presets\.\$presetId\.edit\.tsx"\)/);
  assert.match(listRoute, /当前账号没有预设列表访问权限/);
  assert.match(newRoute, /当前账号没有创建预设权限/);
  assert.match(detailRoute, /当前账号没有访问该预设详情的权限/);
  assert.match(editRoute, /当前账号没有访问该预设编辑页的权限/);
  assert.match(component, /查看详情/);
  assert.match(component, /编辑预设/);
});

test("preset route loader returns creator-owned preset summaries", async () => {
  setPresetRouteTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 7,
        displayName: "季悠然",
        email: "creator@example.com",
      },
      session: {
        id: "sess_preset_1",
      },
    }),
    requireRoleImpl: async () => ["creator"],
    listChannelPresetsForUserImpl: async () => [
      {
        id: "preset_1",
        sourceIdentifier: "youtube:KurzgesagtCN",
        displayName: "Kurzgesagt 中文频道",
        summary: "英译中字幕 / 科普模板 / mp4 + srt",
        defaults: {
          translationMode: "英译中字幕",
          subtitleTemplate: "科普模板",
          outputPackage: "mp4 + srt",
        },
        notes: null,
        previewStyle: {
          fontSize: 36,
          theme: "classic",
        },
        createdAt: "2026-06-15T10:00:00.000Z",
        updatedAt: "2026-06-15T10:00:00.000Z",
      },
    ],
  });

  const model = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_presets_loader",
    }),
    async () =>
      loadPresetRouteViewModel({
        request: new Request("http://localhost:3000/presets"),
        context: {
          requestId: "req_presets_loader",
          releaseStage: "test",
          serviceName: "yakimoji",
        },
      }),
  );

  assert.equal(model.user.id, 7);
  assert.equal(model.channelPresets.length, 1);
  assert.equal(model.channelPresets[0]?.displayName, "Kurzgesagt 中文频道");
});

test("preset detail loader returns a read-only detail model with preview and override hint", async () => {
  setPresetRouteTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 7,
        displayName: "季悠然",
        email: "creator@example.com",
      },
      session: {
        id: "sess_preset_detail",
      },
    }),
    requireRoleImpl: async () => ["creator"],
    getChannelPresetByIdForUserImpl: async () => ({
      id: "preset_1",
      sourceIdentifier: "youtube:KurzgesagtCN",
      displayName: "Kurzgesagt 中文频道",
      summary: "英译中字幕 / 科普模板 / mp4 + srt",
      defaults: {
        translationMode: "英译中字幕",
        subtitleTemplate: "科普模板",
        outputPackage: "mp4 + srt",
      },
      notes: "长期使用的科普频道规则",
      previewStyle: {
        fontSize: 44,
        theme: "cinema",
      },
      createdAt: "2026-06-15T10:00:00.000Z",
      updatedAt: "2026-06-15T12:00:00.000Z",
    }),
  });

  const model = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_presets_detail",
    }),
    async () =>
      loadPresetDetailRouteViewModel({
        request: new Request("http://localhost:3000/presets/preset_1?updated=1"),
        context: {
          requestId: "req_presets_detail",
          releaseStage: "test",
          serviceName: "yakimoji",
        },
        presetId: "preset_1",
      }),
  );

  assert.equal(model.preset.previewStyle.theme, "cinema");
  assert.equal(model.justUpdated, true);
  assert.match(model.templateOverrideHint, /不会隐式回写到频道预设/);
});

test("preset edit loader returns RHF-friendly form defaults", async () => {
  setPresetRouteTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 7,
        displayName: "季悠然",
        email: "creator@example.com",
      },
      session: {
        id: "sess_preset_edit",
      },
    }),
    requireRoleImpl: async () => ["creator"],
    getChannelPresetByIdForUserImpl: async () => ({
      id: "preset_1",
      sourceIdentifier: "youtube:KurzgesagtCN",
      displayName: "Kurzgesagt 中文频道",
      summary: "英译中字幕 / 科普模板 / mp4 + srt",
      defaults: {
        translationMode: "英译中字幕",
        subtitleTemplate: "科普模板",
        outputPackage: "mp4 + srt",
      },
      notes: null,
      previewStyle: {
        fontSize: 40,
        theme: "highContrast",
      },
      createdAt: "2026-06-15T10:00:00.000Z",
      updatedAt: "2026-06-15T12:00:00.000Z",
    }),
  });

  const model = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_presets_edit",
    }),
    async () =>
      loadPresetEditRouteViewModel({
        request: new Request("http://localhost:3000/presets/preset_1/edit"),
        context: {
          requestId: "req_presets_edit",
          releaseStage: "test",
          serviceName: "yakimoji",
        },
        presetId: "preset_1",
      }),
  );

  assert.equal(model.formDefaults.previewFontSize, 40);
  assert.equal(model.formDefaults.previewTheme, "highContrast");
  assert.equal(model.formDefaults.notes, "");
});

test("preset route loader rejects unauthorized access through shared authz flow", async () => {
  setPresetRouteTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 19,
        displayName: "Viewer",
        email: "viewer@example.com",
      },
      session: {
        id: "sess_preset_forbidden",
      },
    }),
    requireRoleImpl: async () => {
      throw {
        data: {
          message: "当前账号没有访问该工作区的权限。",
        },
        init: {
          status: 403,
        },
      };
    },
  });

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_presets_forbidden",
    }),
    async () => {
      await assert.rejects(
        () =>
          loadPresetRouteViewModel({
            request: new Request("http://localhost:3000/presets"),
            context: {
              requestId: "req_presets_forbidden",
              releaseStage: "test",
              serviceName: "yakimoji",
            },
          }),
        (error: { init?: { status?: number } }) => error.init?.status === 403,
      );
    },
  );
});

test("preset create action preserves field errors and creator ownership contract", async () => {
  let receivedOwnerUserId = 0;
  let receivedIntent = "";
  let receivedSourceIdentifier = "";

  setPresetRouteTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 7,
        displayName: "季悠然",
        email: "creator@example.com",
      },
      session: {
        id: "sess_preset_action",
      },
    }),
    requireRoleImpl: async () => ["creator"],
    handleChannelPresetActionImpl: async (ownerUserId, formData) => {
      receivedOwnerUserId = ownerUserId;
      receivedIntent = String(formData.get("intent"));
      receivedSourceIdentifier = String(formData.get("sourceIdentifier"));

      return {
        ok: false,
        resource: "channel_preset",
        code: "channel_preset_invalid",
        message: "请输入可识别的来源频道标识。",
        field: "sourceIdentifier",
        request_id: "req_presets_action",
      };
    },
  });

  const formData = new FormData();
  formData.set("intent", "create_channel_preset");
  formData.set("sourceIdentifier", "");

  const request = new Request("http://localhost:3000/presets/new", {
    method: "POST",
    body: formData,
  });

  const result = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_presets_action",
    }),
    async () => handlePresetCreateRouteAction(request),
  );

  assert.equal(receivedOwnerUserId, 7);
  assert.equal(receivedIntent, "create_channel_preset");
  assert.equal(receivedSourceIdentifier, "");
  assert.equal(result.ok, false);
  assert.equal(result.field, "sourceIdentifier");
});

test("preset create route rejects update intent so edit capability cannot leak through the new entry point", async () => {
  let forwarded = false;

  setPresetRouteTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 7,
        displayName: "季悠然",
        email: "creator@example.com",
      },
      session: {
        id: "sess_preset_update_blocked",
      },
    }),
    requireRoleImpl: async () => ["creator"],
    handleChannelPresetActionImpl: async () => {
      forwarded = true;
      throw new Error("should not forward update intents");
    },
  });

  const formData = new FormData();
  formData.set("intent", "update_channel_preset");
  formData.set("presetId", "preset_1");
  formData.set("sourceIdentifier", "youtube:KurzgesagtCN");

  const request = new Request("http://localhost:3000/presets/new", {
    method: "POST",
    body: formData,
    headers: {
      "x-request-id": "req_presets_update_blocked",
    },
  });

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_presets_update_blocked",
    }),
    async () => {
      await assert.rejects(
        () => handlePresetCreateRouteAction(request),
        (error: any) => {
          assert.equal(error.constructor?.name, "DataWithResponseInit");
          assert.equal(error.init?.status, 400);
          assert.equal(error.data.code, "channel_preset_invalid_intent");
          assert.equal(error.data.request_id, "req_presets_update_blocked");
          return true;
        },
      );
    },
  );

  assert.equal(forwarded, false);
});

test("preset detail and edit loaders reject cross-owner access with 403 semantics and request_id", async () => {
  setPresetRouteTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 7,
        displayName: "季悠然",
        email: "creator@example.com",
      },
      session: {
        id: "sess_preset_cross_owner",
      },
    }),
    requireRoleImpl: async () => ["creator"],
    getChannelPresetByIdForUserImpl: async () => null,
  });

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_presets_cross_owner",
    }),
    async () => {
      await assert.rejects(
        () =>
          loadPresetDetailRouteViewModel({
            request: new Request("http://localhost:3000/presets/preset_forbidden"),
            context: {
              requestId: "req_presets_cross_owner",
              releaseStage: "test",
              serviceName: "yakimoji",
            },
            presetId: "preset_forbidden",
          }),
        (error: any) => {
          assert.equal(error.constructor?.name, "DataWithResponseInit");
          assert.equal(error.init?.status, 403);
          assert.equal(error.data.request_id, "req_presets_cross_owner");
          return true;
        },
      );
    },
  );
});

test("preset edit action preserves field errors for inline edit form rendering", async () => {
  let receivedPresetId = "";
  let receivedOwnerUserId = 0;

  setPresetRouteTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 7,
        displayName: "季悠然",
        email: "creator@example.com",
      },
      session: {
        id: "sess_preset_edit_action",
      },
    }),
    requireRoleImpl: async () => ["creator"],
    handleChannelPresetActionImpl: async (ownerUserId, formData) => {
      receivedOwnerUserId = ownerUserId;
      receivedPresetId = String(formData.get("presetId"));

      return {
        ok: false,
        resource: "channel_preset",
        code: "channel_preset_invalid",
        message: "字幕预览字号不能小于 24。",
        field: "previewFontSize",
        request_id: "req_presets_edit_action",
      };
    },
  });

  const formData = new FormData();
  formData.set("sourceIdentifier", "youtube:KurzgesagtCN");
  formData.set("displayName", "Kurzgesagt 中文频道");
  formData.set("translationMode", "英译中字幕");
  formData.set("subtitleTemplate", "科普模板");
  formData.set("outputPackage", "mp4 + srt");
  formData.set("previewFontSize", "18");
  formData.set("previewTheme", "classic");

  const request = new Request("http://localhost:3000/presets/preset_1/edit", {
    method: "POST",
    body: formData,
  });

  const result = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_presets_edit_action",
    }),
    async () =>
      handlePresetEditRouteAction({
        request,
        presetId: "preset_1",
      }),
  );

  assert.equal(receivedOwnerUserId, 7);
  assert.equal(receivedPresetId, "preset_1");
  assert.equal(result.ok, false);
  assert.equal(result.field, "previewFontSize");
});

test("preset edit action preserves 403 semantics for cross-owner save attempts", async () => {
  setPresetRouteTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 7,
        displayName: "季悠然",
        email: "creator@example.com",
      },
      session: {
        id: "sess_preset_edit_forbidden",
      },
    }),
    requireRoleImpl: async () => ["creator"],
    handleChannelPresetActionImpl: async () => {
      throw {
        constructor: {
          name: "DataWithResponseInit",
        },
        data: {
          code: "channel_preset_forbidden",
          message: "当前账号无权修改该频道预设，或预设不存在。",
          request_id: "req_presets_edit_forbidden",
        },
        init: {
          status: 403,
        },
      };
    },
  });

  const request = new Request("http://localhost:3000/presets/preset_1/edit", {
    method: "POST",
    body: new FormData(),
  });

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_presets_edit_forbidden",
    }),
    async () => {
      await assert.rejects(
        () =>
          handlePresetEditRouteAction({
            request,
            presetId: "preset_1",
          }),
        (error: any) => {
          assert.equal(error.init?.status, 403);
          assert.equal(error.data.request_id, "req_presets_edit_forbidden");
          return true;
        },
      );
    },
  );
});
