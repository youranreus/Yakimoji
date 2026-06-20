import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { createRequestContext, runWithRequestContext } from "../app/features/auth/server/request-context.server";
import {
  loadSupportDiagnosticForAuthorizedRole,
  setTaskQueryTestHooks,
} from "../app/features/tasks/server/task-query.server";

const repoRoot = process.cwd();

function readText(filePath: string) {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

test.beforeEach(() => {
  setTaskQueryTestHooks({});
});

test("support diagnostics route is registered as a dedicated support entry point", () => {
  const routes = readText("app/routes.ts");
  const routeModule = readText("app/routes/support.tasks.$taskId.diagnostics.tsx");

  assert.match(
    routes,
    /route\("support\/tasks\/:taskId\/diagnostics", "routes\/support\.tasks\.\$taskId\.diagnostics\.tsx"\)/,
  );
  assert.match(routeModule, /当前账号没有访问该诊断视图的权限/);
});

test("support diagnostics loader allows support roles and returns a support-only detail model", async () => {
  setTaskQueryTestHooks({
    requireAnyRoleImpl: async () => ["support"],
    getTaskRowByIdImpl: async () => ({
      id: "task_support_1",
      creatorUserId: 7,
      intakeMethod: "youtube_link",
      sourceIdentifier: "youtube:support_1",
      sourceSnapshot: {
        title: "Support Task",
        attempt: {
          attemptNumber: 2,
          originTaskId: "task_root_1",
          retryOfTaskId: "task_prev_1",
        },
      },
      processingBaselineSnapshot: {
        translationMode: "中译中",
        subtitleTemplate: "标准模板",
        outputPackage: "SRT",
      },
      presetSnapshot: {
        status: "continue_without_preset",
        summary: "未命中后继续",
      },
      status: "failed",
      createdAt: new Date("2026-05-26T01:00:00.000Z"),
      updatedAt: new Date("2026-05-26T01:10:00.000Z"),
    }),
    getTaskEventLedgerImpl: async () => [
      {
        id: "evt_created",
        taskId: "task_support_1",
        eventType: "task.created",
        fromStatus: "created",
        toStatus: "created",
        reasonCode: null,
        requestId: "req_support_created",
        actorUserId: 7,
        payload: {},
        createdAt: new Date("2026-05-26T01:00:00.000Z"),
      },
      {
        id: "evt_non_match",
        taskId: "task_support_1",
        eventType: "task.preset_decision_requested",
        fromStatus: "matching_preset",
        toStatus: "awaiting_preset_decision",
        reasonCode: "preset_not_found",
        requestId: "req_support_non_match",
        actorUserId: 7,
        payload: {
          message: "当前来源未命中现有预设，需要人工决定如何继续。",
        },
        createdAt: new Date("2026-05-26T01:03:00.000Z"),
      },
      {
        id: "evt_failed",
        taskId: "task_support_1",
        eventType: "task.failed",
        fromStatus: "processing",
        toStatus: "failed",
        reasonCode: "worker_timeout",
        requestId: "req_support_failed",
        actorUserId: 7,
        payload: {
          failureStage: "字幕生成",
          failureMessage: "外部节点超时。",
          diagnosticTraceId: "trace_support",
          retryable: true,
          recommendedAction: "创建新的恢复 attempt。",
          supportCategory: "worker-timeout",
        },
        createdAt: new Date("2026-05-26T01:10:00.000Z"),
      },
    ],
    getLatestTaskEventForTaskImpl: async () => null,
    listDeliverablesForTaskDetailImpl: async () => [],
  });

  const model = await runWithRequestContext(
    createRequestContext({ "x-request-id": "req_support_diagnostics" }),
    async () =>
      loadSupportDiagnosticForAuthorizedRole({
        request: new Request("http://localhost/support/tasks/task_support_1/diagnostics"),
        taskId: "task_support_1",
        authenticatedSession: {
          user: { id: 19 },
          session: { id: "sess_support" },
        },
      }),
  );

  assert.equal(model.accessMode, "support");
  assert.equal(model.deliverables.length, 0);
  assert.equal(model.supportDiagnostics?.currentTaskId, "task_support_1");
  assert.equal(model.supportDiagnostics?.presetResolution, "continue_without_preset");
  assert.equal(model.supportDiagnostics?.presetReasonCategory, "preset_not_found");
  assert.match(model.supportDiagnostics?.presetReason ?? "", /未命中现有预设/);
  assert.equal(model.supportDiagnostics?.entries.length, 3);
});

test("support diagnostics loader rejects creator-only sessions", async () => {
  setTaskQueryTestHooks({
    requireAnyRoleImpl: async () => {
      throw {
        data: {
          message: "当前账号没有访问该诊断视图的权限。",
        },
        init: {
          status: 403,
        },
      };
    },
  });

  await assert.rejects(
    runWithRequestContext(
      createRequestContext({ "x-request-id": "req_support_forbidden" }),
      async () =>
        loadSupportDiagnosticForAuthorizedRole({
          request: new Request("http://localhost/support/tasks/task_support_1/diagnostics"),
          taskId: "task_support_1",
          authenticatedSession: {
            user: { id: 7 },
            session: { id: "sess_creator" },
          },
        }),
    ),
    (error: { init?: { status?: number } }) => error.init?.status === 403,
  );
});
