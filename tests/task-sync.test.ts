import assert from "node:assert/strict";
import test from "node:test";

import {
  encodeTaskSyncSseEvent,
  getTaskSyncEnvelope,
  getTaskSyncPollingIntervalMs,
  getTaskSyncSseRetryMs,
  setTaskSyncTestHooks,
} from "../app/features/tasks/server/task-sync.server";

function makeTask(id: string, createdAt: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    status: "processing",
    updatedAt: new Date(createdAt),
    ...overrides,
  };
}

function makeEvent(taskId: string, createdAt: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `${taskId}_${createdAt}`,
    taskId,
    eventType: "task.processing",
    toStatus: "processing",
    requestId: "req_sync_test",
    createdAt: new Date(createdAt),
    ...overrides,
  };
}

test.beforeEach(() => {
  setTaskSyncTestHooks({});
});

test("task sync envelope only includes visible creator tasks and uses a small summary payload", async () => {
  setTaskSyncTestHooks({
    listVisibleTasksForUserImpl: async ({ userId, selectedTaskId }) => {
      void userId;

      return [
        makeTask("task_1", "2026-05-26T01:10:00.000Z"),
        makeTask("task_2", "2026-05-26T01:20:00.000Z", {
          status: "awaiting_human_review",
        }),
      ].filter((task) => !selectedTaskId || task.id === selectedTaskId);
    },
    listLatestEventsForTaskIdsImpl: async ({ taskIds }) =>
      new Map(
        taskIds.map((taskId) => [
          taskId,
          makeEvent(taskId, `2026-05-26T01:3${taskId.endsWith("1") ? "0" : "5"}:00.000Z`),
        ]),
      ),
    listEventsSinceForTaskIdsImpl: async ({ taskIds }) =>
      taskIds.map((taskId) => makeEvent(taskId, "2026-05-26T01:40:00.000Z")),
  });

  const initial = await getTaskSyncEnvelope({
    userId: 7,
    transport: "sse",
  });

  assert.equal(initial.mode, "heartbeat");
  assert.equal(initial.visibleTaskIds.length, 2);
  assert.equal(initial.snapshots.length, 2);
  assert.equal(initial.event, null);
  assert.equal(initial.intervalMs, getTaskSyncPollingIntervalMs());
  assert.match(initial.snapshots[0]?.statusLabel ?? "", /正在处理|等待人工复核/);

  const delta = await getTaskSyncEnvelope({
    userId: 7,
    cursor: "2026-05-26T01:00:00.000Z",
    transport: "polling",
  });

  assert.equal(delta.mode, "delta");
  assert.equal(delta.event?.event, "task.status.changed");
  assert.deepEqual(delta.event?.data.changedTaskIds, ["task_1", "task_2"]);
  assert.equal(delta.event?.data.transport, "polling");
  assert.equal(delta.snapshots.length, 2);
});

test("task sync event encoding stays SSE compatible", () => {
  const encoded = encodeTaskSyncSseEvent({
    event: "task.status.changed",
    data: {
      cursor: "2026-05-26T01:40:00.000Z",
      changedTaskIds: ["task_1"],
      taskIds: ["task_1"],
      latestEventAt: "2026-05-26T01:40:00.000Z",
      transport: "sse",
    },
  });

  assert.match(encoded, /^event: task\.status\.changed/m);
  assert.match(encoded, /data: {"cursor":/);
  assert.equal(getTaskSyncSseRetryMs(), 5_000);
});
