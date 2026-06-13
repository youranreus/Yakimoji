import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import { createRequestContext, runWithRequestContext } from "../app/features/auth/server/request-context.server";
import {
  loadOperationsDashboardViewModel,
  setOperationsDashboardTestHooks,
} from "../app/features/operations/server/operations-dashboard.server";

const repoRoot = process.cwd();

function readText(filePath: string) {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

test.beforeEach(() => {
  setOperationsDashboardTestHooks({});
});

test("operations route manifest and UI copy keep the ops-only dashboard entry points visible", () => {
  const routes = readText("app/routes.ts");
  const routeModule = readText("app/routes/operations.tsx");
  const screen = readText("app/features/operations/components/OperationsDashboardScreen.tsx");
  const cards = readText("app/features/operations/components/OperationsMetricCards.tsx");
  const table = readText("app/features/operations/components/OperationsDrilldownTable.tsx");
  const server = readText("app/features/operations/server/operations-dashboard.server.ts");
  const appCss = readText("app/app.css");

  assert.match(routes, /route\("operations", "routes\/operations\.tsx"\)/);
  assert.match(routeModule, /当前账号没有运营面板访问权限/);
  assert.match(server, /运营可见性判断台/);
  assert.match(screen, /反复未命中来源/);
  assert.match(cards, /查看相关任务/);
  assert.match(table, /相关任务列表/);
  assert.match(appCss, /\.operations-metric-grid/);
  assert.match(appCss, /\.operations-task-table/);
});

test("operations dashboard loader allows admin bypass and rejects unauthorized roles through the shared authz path", async () => {
  setOperationsDashboardTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 12,
        displayName: "Admin",
        email: "admin@example.com",
      },
      session: {
        id: "sess_admin_1",
      },
    }),
    getCurrentUserRolesImpl: async () => ["admin"],
    requireAnyRoleImpl: async () => ["admin"],
    listOperationTasksImpl: async () => [],
    listOperationTaskEventsImpl: async () => [],
  });

  const model = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_ops_admin",
    }),
    async () =>
      loadOperationsDashboardViewModel({
        request: new Request("http://localhost:3000/operations"),
        context: {
          requestId: "req_ops_admin",
          releaseStage: "test",
          serviceName: "yakimoji",
        },
      }),
  );

  assert.deepEqual(model.roles, ["admin"]);
  assert.equal(model.drilldown.taskList.data.length, 0);

  setOperationsDashboardTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 13,
        displayName: "Creator Only",
        email: "creator@example.com",
      },
      session: {
        id: "sess_creator_only",
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
      "x-request-id": "req_ops_forbidden",
    }),
    async () => {
      await assert.rejects(
        () =>
          loadOperationsDashboardViewModel({
            request: new Request("http://localhost:3000/operations"),
            context: {
              requestId: "req_ops_forbidden",
              releaseStage: "test",
              serviceName: "yakimoji",
            },
          }),
        (error: { init?: { status?: number } }) => error.init?.status === 403,
      );
    },
  );
});
