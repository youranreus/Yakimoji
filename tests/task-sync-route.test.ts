import assert from "node:assert/strict";
import test from "node:test";

import {
  setTaskSyncRouteTestHooks,
  loadTaskSyncResponse,
} from "../app/routes/workspace.task-sync.server";

test.beforeEach(() => {
  setTaskSyncRouteTestHooks({});
});

test("task sync route returns polling payload with request-scoped headers", async () => {
  let receivedArgs: Record<string, unknown> | null = null;

  setTaskSyncRouteTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 7,
        displayName: "季悠然",
        email: "creator@example.com",
      },
      session: {
        id: "sess_sync_route",
      },
    }),
    requireRoleImpl: async () => ["creator"],
    getTaskSyncEnvelopeImpl: async (args) => {
      receivedArgs = args;

      return {
        ok: true,
        mode: "delta",
        transport: "polling",
        cursor: "2026-05-26T01:40:00.000Z",
        intervalMs: 15000,
        changedTaskIds: ["task_1"],
        visibleTaskIds: ["task_1", "task_2"],
        snapshots: [
          {
            taskId: "task_1",
            status: "processing",
            statusLabel: "正在处理",
            latestEventType: "task.processing",
            latestEventAt: "2026-05-26T01:40:00.000Z",
            updatedAt: "2026-05-26T01:40:00.000Z",
            requestId: "req_sync_route",
          },
        ],
        event: {
          event: "task.status.changed",
          data: {
            cursor: "2026-05-26T01:40:00.000Z",
            changedTaskIds: ["task_1"],
            taskIds: ["task_1"],
            latestEventAt: "2026-05-26T01:40:00.000Z",
            transport: "polling",
          },
        },
      };
    },
  });

  const response = await loadTaskSyncResponse({
    request: new Request(
      "http://localhost:3000/workspace/task-sync?transport=polling&page=2&taskId=task_1&cursor=2026-05-26T01:20:00.000Z",
    ),
    context: {
      requestId: "req_sync_route",
      releaseStage: "test",
      serviceName: "yakimoji",
    },
  } as never);

  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-request-id"), "req_sync_route");
  assert.deepEqual(receivedArgs, {
    userId: 7,
    selectedTaskId: "task_1",
    page: 2,
    pageSize: 10,
    cursor: "2026-05-26T01:20:00.000Z",
    transport: "polling",
    pollingIntervalMs: 15000,
  });

  const payload = await response.json();

  assert.equal(payload.transport, "polling");
  assert.deepEqual(payload.changedTaskIds, ["task_1"]);
});

test("task sync route keeps SSE response headers on the server entry", async () => {
  setTaskSyncRouteTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 7,
        displayName: "季悠然",
        email: "creator@example.com",
      },
      session: {
        id: "sess_sync_route",
      },
    }),
    requireRoleImpl: async () => ["creator"],
    getTaskSyncEnvelopeImpl: async () => ({
      ok: true,
      mode: "heartbeat",
      transport: "sse",
      cursor: "2026-05-26T01:40:00.000Z",
      intervalMs: 15000,
      changedTaskIds: [],
      visibleTaskIds: ["task_1"],
      snapshots: [],
      event: null,
    }),
  });

  const controller = new AbortController();
  const response = await loadTaskSyncResponse({
    request: new Request("http://localhost:3000/workspace/task-sync", {
      signal: controller.signal,
    }),
    context: {
      requestId: "req_sync_sse",
    },
  } as never);

  assert.equal(
    response.headers.get("content-type"),
    "text/event-stream; charset=utf-8",
  );
  assert.equal(response.headers.get("x-request-id"), "req_sync_sse");

  controller.abort();
});
