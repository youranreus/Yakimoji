import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { createRequestContext, runWithRequestContext } from "../app/features/auth/server/request-context.server";
import { setSessionTestHooks } from "../app/features/auth/server/session.server";
import {
  loadTaskAuditForAuthorizedRole,
  setTaskAuditTestHooks,
} from "../app/features/tasks/server/task-audit.server";
import { setAuthzTestHooks } from "../app/features/auth/server/authz.server";

const repoRoot = process.cwd();

function readText(filePath: string) {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

test.beforeEach(() => {
  setTaskAuditTestHooks({});
  setAuthzTestHooks({});
  setSessionTestHooks({});
});

test("task audit route is registered as a separate support entry point", () => {
  const routes = readText("app/routes.ts");
  const routeModule = readText("app/routes/tasks.$taskId.audit.tsx");

  assert.match(routes, /route\("tasks\/:taskId\/audit", "routes\/tasks\.\$taskId\.audit\.tsx"\)/);
  assert.match(routeModule, /当前账号没有审计记录访问权限/);
});

test("task audit loader allows support style roles and rejects creator-only sessions", async () => {
  const auditWrites: Array<Record<string, unknown>> = [];

  setSessionTestHooks({
    getOptionalUserSessionImpl: async () => ({
      user: {
        id: 19,
        displayName: "Support",
        email: "support@example.com",
      } as never,
      session: {
        id: "sess_support",
      } as never,
    }),
  });

  setAuthzTestHooks({
    getUserRolesImpl: async () => ["support"],
    writeAuditLogImpl: async () => undefined,
  });

  setTaskAuditTestHooks({
    requireAnyRoleImpl: async () => ["support"],
    writeAuditLogImpl: async (entry) => {
      auditWrites.push(entry);
    },
    getTaskRowByIdImpl: async () => ({
      id: "task_audit_1",
      creatorUserId: 7,
      sourceIdentifier: "youtube:source_1",
      sourceSnapshot: null,
      presetSnapshot: {},
      status: "completed",
      createdAt: new Date("2026-05-26T01:00:00.000Z"),
      updatedAt: new Date("2026-05-26T02:00:00.000Z"),
    }),
    getTaskEventLedgerImpl: async () => [],
    listAuditLogEntriesImpl: async () => [],
  });

  const model = await runWithRequestContext(
    createRequestContext({ "x-request-id": "req_audit_loader" }),
    async () =>
      loadTaskAuditForAuthorizedRole({
        request: new Request("http://localhost/tasks/task_audit_1/audit"),
        taskId: "task_audit_1",
        authenticatedSession: {
          user: { id: 19 },
          session: { id: "sess_support" },
        },
      }),
  );

  assert.equal(model.taskId, "task_audit_1");
  assert.equal(auditWrites[0]?.eventType, "task.audit_query");
  assert.equal(auditWrites[0]?.resourceType, "task-audit");
  assert.deepEqual(auditWrites[0]?.detail, {
    taskId: "task_audit_1",
    accessRoles: ["support"],
  });

  setTaskAuditTestHooks({
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
    writeAuditLogImpl: async () => undefined,
    getTaskRowByIdImpl: async () => null,
    getTaskEventLedgerImpl: async () => [],
    listAuditLogEntriesImpl: async () => [],
  });

  await assert.rejects(
    runWithRequestContext(
      createRequestContext({ "x-request-id": "req_audit_forbidden" }),
      async () =>
        loadTaskAuditForAuthorizedRole({
          request: new Request("http://localhost/tasks/task_audit_1/audit"),
          taskId: "task_audit_1",
          authenticatedSession: {
            user: { id: 20 },
            session: { id: "sess_creator" },
          },
        }),
    ),
    (error: { init?: { status?: number } }) => error.init?.status === 403,
  );
});

test("task audit loader does not fail open when success audit logging throws", async () => {
  setTaskAuditTestHooks({
    requireAnyRoleImpl: async () => ["ops"],
    writeAuditLogImpl: async () => {
      throw new Error("audit write failed");
    },
    getTaskRowByIdImpl: async () => ({
      id: "task_audit_2",
      creatorUserId: 8,
      sourceIdentifier: "youtube:source_2",
      sourceSnapshot: {
        title: "来源二",
      },
      presetSnapshot: {},
      status: "completed",
      createdAt: new Date("2026-05-26T01:00:00.000Z"),
      updatedAt: new Date("2026-05-26T02:00:00.000Z"),
    }),
    getTaskEventLedgerImpl: async () => [],
    listAuditLogEntriesImpl: async () => [],
  });

  const model = await runWithRequestContext(
    createRequestContext({ "x-request-id": "req_audit_loader_soft_fail" }),
    async () =>
      loadTaskAuditForAuthorizedRole({
        request: new Request("http://localhost/tasks/task_audit_2/audit"),
        taskId: "task_audit_2",
        authenticatedSession: {
          user: { id: 21 },
          session: { id: "sess_ops" },
        },
      }),
  );

  assert.equal(model.taskId, "task_audit_2");
  assert.equal(model.summary.title, "来源二");
});
