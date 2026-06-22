import assert from "node:assert/strict";
import test from "node:test";

import {
  loadOperationsNonMatchAnalysisViewModel,
  setOperationsNonMatchAnalysisTestHooks,
} from "../app/features/operations/server/operations-non-match-analysis.server";
import {
  createRequestContext,
  runWithRequestContext,
} from "../app/features/auth/server/request-context.server";

function makeTask(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    intakeMethod: "youtube_link",
    sourceIdentifier: `youtube:${id}`,
    sourceSnapshot: {
      title: `Channel ${id}`,
    },
    processingBaselineSnapshot: {
      translationMode: "中译中",
      subtitleTemplate: "标准模板",
      outputPackage: "SRT",
    },
    presetSnapshot: {
      status: "matched",
      summary: "自动命中已有预设",
    },
    status: "processing",
    createdAt: new Date("2026-06-10T00:00:00.000Z"),
    updatedAt: new Date("2026-06-10T02:00:00.000Z"),
    ...overrides,
  };
}

function makeEvent(
  taskId: string,
  eventType: string,
  createdAt: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `${taskId}_${eventType}_${createdAt}`,
    taskId,
    eventType,
    fromStatus: "created",
    toStatus: "processing",
    reasonCode: null,
    requestId: `req_${taskId}`,
    payload: {},
    createdAt: new Date(createdAt),
    ...overrides,
  };
}

test.beforeEach(() => {
  setOperationsNonMatchAnalysisTestHooks({});
});

test("non-match analysis groups repeated source misses and supports source drill-down", async () => {
  const taskRows = [
    makeTask("alpha_1", {
      sourceIdentifier: "youtube:alpha",
      sourceSnapshot: { title: "Alpha Channel" },
      presetSnapshot: { status: "manual_reuse", summary: "手动复用已有预设" },
      updatedAt: new Date("2026-06-10T09:00:00.000Z"),
    }),
    makeTask("alpha_2", {
      sourceIdentifier: "youtube:alpha",
      sourceSnapshot: { title: "Alpha Channel" },
      presetSnapshot: { status: "manual_reuse", summary: "手动复用已有预设" },
      updatedAt: new Date("2026-06-10T08:00:00.000Z"),
    }),
    makeTask("beta_1", {
      sourceIdentifier: "youtube:beta",
      sourceSnapshot: { title: "Beta Channel" },
      presetSnapshot: {
        status: "continue_without_preset",
        summary: "未使用预设继续",
      },
      status: "awaiting_preset_decision",
      updatedAt: new Date("2026-06-10T07:00:00.000Z"),
    }),
    makeTask("gamma_1", {
      sourceIdentifier: "youtube:gamma",
      sourceSnapshot: { title: "Gamma Channel" },
      presetSnapshot: { status: "matched", summary: "自动命中已有预设" },
      updatedAt: new Date("2026-06-10T06:00:00.000Z"),
    }),
  ];

  const events = [
    makeEvent("alpha_1", "task.processing", "2026-06-10T00:20:00.000Z"),
    makeEvent("alpha_2", "task.processing", "2026-06-10T00:30:00.000Z"),
    makeEvent(
      "beta_1",
      "task.preset_decision_requested",
      "2026-06-10T00:10:00.000Z",
      {
        toStatus: "awaiting_preset_decision",
      },
    ),
    makeEvent("gamma_1", "task.processing", "2026-06-10T00:15:00.000Z"),
  ];

  setOperationsNonMatchAnalysisTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 21,
        displayName: "运营同学",
        email: "ops@example.com",
      },
      session: {
        id: "sess_ops_non_match",
      },
    }),
    getCurrentUserRolesImpl: async () => ["ops"],
    requireAnyRoleImpl: async () => ["ops"],
    listOperationTasksImpl: async () => taskRows,
    listOperationTaskEventsImpl: async () => events,
  });

  const model = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_non_match_alpha",
    }),
    async () =>
      loadOperationsNonMatchAnalysisViewModel({
        request: new Request(
          "http://localhost:3000/operations/non-match-sources?source=youtube%3Aalpha",
        ),
        context: {
          requestId: "req_non_match_alpha",
          releaseStage: "test",
          serviceName: "yakimoji",
        },
      }),
  );

  assert.equal(model.channels.length, 2);
  assert.equal(model.channels[0]?.sourceIdentifier, "youtube:alpha");
  assert.equal(model.channels[0]?.nonMatchCount, 2);
  assert.match(model.channels[0]?.dominantReason ?? "", /自动命中仍不稳定/);
  assert.equal(
    model.channels[0]?.drilldownHref,
    "/operations/non-match-sources?source=youtube%3Aalpha",
  );
  assert.match(model.summary.lede, /3 条未自动命中预设的任务/);
  assert.match(model.summary.lede, /2 个来源频道/);

  assert.equal(model.drilldown.taskList.data.length, 2);
  assert.equal(model.drilldown.taskList.data[0]?.sourceIdentifier, "youtube:alpha");
  assert.equal(model.drilldown.taskList.data[0]?.presetOutcomeLabel, "手动复用已有预设");
  assert.match(model.drilldown.activeLabel, /Alpha Channel/);
});

test("non-match analysis allows admin and rejects creator-only access through shared authz", async () => {
  setOperationsNonMatchAnalysisTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 22,
        displayName: "Admin",
        email: "admin@example.com",
      },
      session: {
        id: "sess_admin_non_match",
      },
    }),
    getCurrentUserRolesImpl: async () => ["admin"],
    requireAnyRoleImpl: async () => ["admin"],
    listOperationTasksImpl: async () => [],
    listOperationTaskEventsImpl: async () => [],
  });

  const adminModel = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_non_match_admin",
    }),
    async () =>
      loadOperationsNonMatchAnalysisViewModel({
        request: new Request("http://localhost:3000/operations/non-match-sources"),
        context: {
          requestId: "req_non_match_admin",
          releaseStage: "test",
          serviceName: "yakimoji",
        },
      }),
  );

  assert.deepEqual(adminModel.roles, ["admin"]);
  assert.equal(adminModel.drilldown.taskList.data.length, 0);

  setOperationsNonMatchAnalysisTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 23,
        displayName: "Creator Only",
        email: "creator@example.com",
      },
      session: {
        id: "sess_creator_non_match",
      },
    }),
    getCurrentUserRolesImpl: async () => ["creator"],
    requireAnyRoleImpl: async () => {
      throw {
        data: {
          message: "当前账号没有访问该工作区的权限。",
        },
        init: {
          status: 403,
        },
      };
    },
    listOperationTasksImpl: async () => [],
    listOperationTaskEventsImpl: async () => [],
  });

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_non_match_forbidden",
    }),
    async () => {
      await assert.rejects(
        () =>
          loadOperationsNonMatchAnalysisViewModel({
            request: new Request("http://localhost:3000/operations/non-match-sources"),
            context: {
              requestId: "req_non_match_forbidden",
              releaseStage: "test",
              serviceName: "yakimoji",
            },
          }),
        (error: { init?: { status?: number } }) => error.init?.status === 403,
      );
    },
  );
});
