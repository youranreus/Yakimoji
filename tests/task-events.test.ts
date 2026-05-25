import assert from "node:assert/strict";
import test from "node:test";

import {
  appendTaskEvent,
  getTaskLifecycleSnapshot,
  transitionTaskStatus,
} from "../app/features/tasks/server/task-events.server";
import { createRequestContext, runWithRequestContext } from "../app/features/auth/server/request-context.server";
import { DatabaseContext } from "../database/context";

type TaskRow = Record<string, unknown>;
type TaskEventRow = Record<string, unknown>;

function cloneRows<T extends Record<string, unknown>>(rows: T[]) {
  return rows.map((row) => ({ ...row }));
}

function cloneTaskMap(rows: Map<string, TaskRow>) {
  return new Map(
    [...rows.entries()].map(([key, value]) => [key, { ...value }]),
  );
}

function collectParamValues(sql: unknown, values: unknown[] = []) {
  if (!sql || typeof sql !== "object") {
    return values;
  }

  if ("value" in sql && "encoder" in sql) {
    values.push((sql as { value: unknown }).value);
  }

  if ("queryChunks" in sql && Array.isArray((sql as { queryChunks: unknown[] }).queryChunks)) {
    for (const chunk of (sql as { queryChunks: unknown[] }).queryChunks) {
      collectParamValues(chunk, values);
    }
  }

  return values;
}

function createFakeDb() {
  const taskRows = new Map<string, TaskRow>();
  const taskEventRows: TaskEventRow[] = [];
  let failEventInsert = false;

  const db = {
    async transaction<T>(callback: (tx: typeof db) => Promise<T>) {
      const taskRowsSnapshot = cloneTaskMap(taskRows);
      const taskEventRowsSnapshot = cloneRows(taskEventRows);

      try {
        return await callback(db);
      } catch (error) {
        taskRows.clear();
        for (const [key, value] of taskRowsSnapshot.entries()) {
          taskRows.set(key, value);
        }

        taskEventRows.splice(0, taskEventRows.length, ...taskEventRowsSnapshot);
        throw error;
      }
    },
    insert(table: any) {
      return {
        async values(values: Record<string, unknown>) {
          const tableName = table[Symbol.for("drizzle:Name")] ?? "unknown";

          if (tableName === "tasks") {
            taskRows.set(String(values.id), { ...values });
            return;
          }

          if (tableName === "task_events") {
            if (failEventInsert) {
              throw new Error("task_events insert failed");
            }

            taskEventRows.push({ ...values });
          }
        },
      };
    },
    update(table: any) {
      return {
        set(values: Record<string, unknown>) {
          return {
            where(whereClause: unknown) {
              const tableName = table[Symbol.for("drizzle:Name")] ?? "unknown";

              return {
                async returning() {
                  if (tableName !== "tasks") {
                    return [];
                  }

                  const [taskId, expectedStatus] = collectParamValues(whereClause);
                  const existing = taskRows.get(String(taskId));

                  if (!existing || existing.status !== expectedStatus) {
                    return [];
                  }

                  taskRows.set(String(taskId), { ...existing, ...values });
                  return [taskRows.get(String(taskId))];
                },
              };
            },
          };
        },
      };
    },
    select(selection: Record<string, unknown>) {
      return {
        from(table: any) {
          const tableName = table[Symbol.for("drizzle:Name")] ?? "unknown";

          if (tableName === "tasks") {
            return {
              where() {
                const [task] = taskRows.values();

                return {
                  async limit(limitCount: number) {
                    void selection;
                    return task ? [task].slice(0, limitCount) : [];
                  },
                };
              },
            };
          }

          if (tableName === "task_events") {
            return {
              where() {
                const matching = taskEventRows.slice();

                return {
                  orderBy() {
                    return {
                      async limit(limitCount: number) {
                        void selection;
                        return [...matching]
                          .sort((left, right) =>
                            new Date(String(right.createdAt)).getTime() -
                            new Date(String(left.createdAt)).getTime(),
                          )
                          .slice(0, limitCount);
                      },
                    };
                  },
                };
              },
            };
          }

          throw new Error(`Unsupported table in fake select: ${tableName}`);
        },
      };
    },
  };

  return {
    db,
    taskRows,
    taskEventRows,
    setFailEventInsert(value: boolean) {
      failEventInsert = value;
    },
  };
}

test("legal status transitions append task events and update the task snapshot", async () => {
  const fake = createFakeDb();
  const createdAt = new Date("2026-05-25T01:00:00.000Z");
  const queuedAt = new Date("2026-05-25T01:05:00.000Z");

  fake.taskRows.set("task_1", {
    id: "task_1",
    status: "created",
    createdAt,
    updatedAt: createdAt,
  });

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_transition_ok",
    }),
    async () => {
      await DatabaseContext.run(fake.db as never, async () => {
        await transitionTaskStatus({
          taskId: "task_1",
          fromStatus: "created",
          toStatus: "queued",
          eventType: "task.queued",
          createdAt: queuedAt,
          payload: {
            queueName: "default",
          },
        });
      });
    },
  );

  assert.equal(fake.taskRows.get("task_1")?.status, "queued");
  assert.equal(fake.taskEventRows.length, 1);
  assert.equal(fake.taskEventRows[0]?.fromStatus, "created");
  assert.equal(fake.taskEventRows[0]?.toStatus, "queued");
  assert.equal(fake.taskEventRows[0]?.eventType, "task.queued");
  assert.deepEqual(fake.taskEventRows[0]?.payload, {
    queueName: "default",
  });

  const snapshot = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_snapshot_ok",
    }),
    async () =>
      DatabaseContext.run(fake.db as never, async () =>
        getTaskLifecycleSnapshot("task_1"),
      ),
  );

  assert.equal(snapshot?.task.id, "task_1");
  assert.equal(snapshot?.task.status, "queued");
  assert.equal(snapshot?.latestEvent?.eventType, "task.queued");
});

test("illegal status transitions are rejected and do not append events", async () => {
  const fake = createFakeDb();
  const createdAt = new Date("2026-05-25T02:00:00.000Z");

  fake.taskRows.set("task_2", {
    id: "task_2",
    status: "created",
    createdAt,
    updatedAt: createdAt,
  });

  await assert.rejects(
    runWithRequestContext(
      createRequestContext({
        "x-request-id": "req_transition_blocked",
      }),
      async () =>
        DatabaseContext.run(fake.db as never, async () =>
          transitionTaskStatus({
            taskId: "task_2",
            fromStatus: "created",
            toStatus: "completed",
            eventType: "task.completed",
            createdAt: new Date("2026-05-25T02:05:00.000Z"),
          }),
        ),
    ),
    /Invalid task status transition/,
  );

  assert.equal(fake.taskRows.get("task_2")?.status, "created");
  assert.equal(fake.taskEventRows.length, 0);
});

test("status transitions only apply when the stored status matches the expected from status", async () => {
  const fake = createFakeDb();
  const createdAt = new Date("2026-05-25T02:30:00.000Z");

  fake.taskRows.set("task_2b", {
    id: "task_2b",
    status: "processing",
    createdAt,
    updatedAt: createdAt,
  });

  await assert.rejects(
    runWithRequestContext(
      createRequestContext({
        "x-request-id": "req_transition_stale",
      }),
      async () =>
        DatabaseContext.run(fake.db as never, async () =>
          transitionTaskStatus({
            taskId: "task_2b",
            fromStatus: "created",
            toStatus: "queued",
            eventType: "task.queued",
            createdAt: new Date("2026-05-25T02:35:00.000Z"),
          }),
        ),
    ),
    /Task status changed before transition could be applied/,
  );

  assert.equal(fake.taskRows.get("task_2b")?.status, "processing");
  assert.equal(fake.taskEventRows.length, 0);
});

test("event write failures roll back the task status update", async () => {
  const fake = createFakeDb();
  const createdAt = new Date("2026-05-25T04:00:00.000Z");

  fake.taskRows.set("task_4", {
    id: "task_4",
    status: "created",
    createdAt,
    updatedAt: createdAt,
  });
  fake.setFailEventInsert(true);

  await assert.rejects(
    runWithRequestContext(
      createRequestContext({
        "x-request-id": "req_transition_atomic",
      }),
      async () =>
        DatabaseContext.run(fake.db as never, async () =>
          transitionTaskStatus({
            taskId: "task_4",
            fromStatus: "created",
            toStatus: "queued",
            eventType: "task.queued",
            createdAt: new Date("2026-05-25T04:05:00.000Z"),
          }),
        ),
    ),
    /task_events insert failed/,
  );

  assert.equal(fake.taskRows.get("task_4")?.status, "created");
  assert.equal(fake.taskEventRows.length, 0);
});

test("failure terminal events preserve machine-readable reason_code and request_id", async () => {
  const fake = createFakeDb();
  const createdAt = new Date("2026-05-25T03:00:00.000Z");

  fake.taskRows.set("task_3", {
    id: "task_3",
    status: "processing",
    createdAt,
    updatedAt: createdAt,
  });

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_task_failed",
    }),
    async () => {
      await DatabaseContext.run(fake.db as never, async () => {
        await appendTaskEvent({
          taskId: "task_3",
          eventType: "task.failed",
          fromStatus: "processing",
          toStatus: "failed",
          reasonCode: "provider_timeout",
          requestId: "req_task_failed",
          createdAt: new Date("2026-05-25T03:06:00.000Z"),
          payload: {
            provider: "yakimoji-api",
          },
        });
      });
    },
  );

  assert.equal(fake.taskEventRows.length, 1);
  assert.equal(fake.taskEventRows[0]?.reasonCode, "provider_timeout");
  assert.equal(fake.taskEventRows[0]?.requestId, "req_task_failed");
  assert.equal(fake.taskEventRows[0]?.toStatus, "failed");
});
