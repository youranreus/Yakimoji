import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTaskStageTimeline,
  getTaskStatusPresentation,
} from "../app/features/tasks/server/task-status.server";
import {
  getTaskDetailForUser,
  listPaginatedTasksForUser,
  setTaskQueryTestHooks,
} from "../app/features/tasks/server/task-query.server";
import { createRequestContext, runWithRequestContext } from "../app/features/auth/server/request-context.server";

function makeTask(index: number, overrides: Record<string, unknown> = {}) {
  const createdAt = new Date(`2026-05-26T0${Math.min(index, 9)}:00:00.000Z`);
  const updatedAt = new Date(`2026-05-26T1${Math.min(index, 9)}:00:00.000Z`);

  return {
    id: `task_${index}`,
    creatorUserId: 7,
    intakeMethod: "youtube_link",
    sourceIdentifier: `youtube:channel_${index}`,
    sourceSnapshot: {
      title: `Task ${index}`,
    },
    processingBaselineSnapshot: {
      translationMode: "中译中",
      subtitleTemplate: "标准模板",
      outputPackage: "SRT",
    },
    status: "processing",
    createdAt,
    updatedAt,
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
    requestId: "req_task_query_test",
    actorUserId: 7,
    payload: {},
    createdAt: new Date(createdAt),
    ...overrides,
  };
}

test.beforeEach(() => {
  setTaskQueryTestHooks({});
  setTaskQueryTestHooks({
    listDeliverablesForTaskDetailImpl: async () => [],
  });
});

test("paginated task list returns only the requested page and pagination metadata", async () => {
  const taskRows = Array.from({ length: 12 }, (_, index) => makeTask(index + 1));
  const latestEvents = new Map(
    taskRows.map((task, index) => [
      task.id,
      makeEvent(
        String(task.id),
        index % 2 === 0 ? "task.processing" : "task.queued",
        `2026-05-26T1${index % 10}:30:00.000Z`,
      ),
    ]),
  );

  setTaskQueryTestHooks({
    countTasksForUserImpl: async () => taskRows.length,
    listTaskPageRowsForUserImpl: async (_userId, { limit, offset }) =>
      taskRows.slice(offset, offset + limit),
    getLatestTaskEventForTaskImpl: async (taskId) => latestEvents.get(taskId) ?? null,
  });

  const result = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_page_query",
    }),
    async () =>
      listPaginatedTasksForUser(7, {
        page: 2,
        pageSize: 5,
      }),
  );

  assert.equal(result.data.length, 5);
  assert.deepEqual(
    result.data.map((task) => task.id),
    ["task_6", "task_7", "task_8", "task_9", "task_10"],
  );
  assert.equal(result.meta.pagination.page, 2);
  assert.equal(result.meta.pagination.pageSize, 5);
  assert.equal(result.meta.pagination.total, 12);
  assert.equal(result.meta.pagination.totalPages, 3);
  assert.equal(result.meta.pagination.hasNextPage, true);
  assert.equal(result.meta.pagination.hasPreviousPage, true);
  assert.match(
    result.data[0]?.latestProgressLabel ?? "",
    /处理中|排队|进入处理队列/,
  );
});

test("task detail returns an oldest-to-newest event ledger and readable status semantics", async () => {
  const task = makeTask(1, {
    status: "awaiting_human_review",
  });
  const events = [
    makeEvent("task_1", "task.created", "2026-05-26T01:00:00.000Z", {
      fromStatus: "created",
      toStatus: "created",
    }),
    makeEvent("task_1", "task.processing", "2026-05-26T01:10:00.000Z", {
      fromStatus: "queued",
      toStatus: "processing",
    }),
    makeEvent("task_1", "task.human_review_requested", "2026-05-26T01:20:00.000Z", {
      fromStatus: "processing",
      toStatus: "awaiting_human_review",
      payload: {
        note: "低置信度片段等待人工确认",
      },
    }),
  ];

  setTaskQueryTestHooks({
    getTaskRowForUserImpl: async () => task,
    getTaskEventLedgerImpl: async () => events,
    getLatestTaskEventForTaskImpl: async () => events.at(-1) ?? null,
    listDeliverablesForTaskDetailImpl: async () => [],
  });

  const detail = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_detail_query",
    }),
    async () => getTaskDetailForUser(7, "task_1"),
  );

  assert.equal(detail.id, "task_1");
  assert.equal(detail.currentStageLabel, "等待人工复核");
  assert.equal(detail.latestProgressLabel, "已进入人工复核队列");
  assert.deepEqual(
    detail.events.map((event) => event.eventType),
    ["task.created", "task.processing", "task.human_review_requested"],
  );
  assert.equal(detail.events[0]?.stageState, "completed");
  assert.equal(detail.events.at(-1)?.stageState, "attention");
});

test("completed task with time-expired ready deliverables surfaces expired result semantics", async () => {
  const task = makeTask(2, {
    status: "completed",
  });

  setTaskQueryTestHooks({
    getTaskRowForUserImpl: async () => task,
    getTaskEventLedgerImpl: async () => [],
    getLatestTaskEventForTaskImpl: async () => null,
    listDeliverablesForTaskDetailImpl: async () => [
      {
        id: "deliverable_2",
        taskId: "task_2",
        kind: "video",
        kindLabel: "成品视频",
        fileName: "final.mp4",
        mimeType: "video/mp4",
        fileSizeLabel: "12 MB",
        status: "expired",
        statusLabel: "已过期",
        canDownload: false,
        availableAt: "2026-05-25T01:00:00.000Z",
        expiresAt: "2026-05-26T01:00:00.000Z",
        downloadAction: null,
      },
    ],
  });

  const detail = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_detail_expired_result",
    }),
    async () => getTaskDetailForUser(7, "task_2"),
  );

  assert.equal(detail.resultStatus.label, "结果已过期");
  assert.equal(detail.resultStatus.tone, "danger");
  assert.equal(detail.deliverables[0]?.statusLabel, "已过期");
});

test("failed task without a last active event keeps the terminal timeline ambiguous instead of fabricating processing", () => {
  const timeline = buildTaskStageTimeline("failed");

  assert.equal(timeline.at(-1)?.state, "terminal");
  assert.equal(timeline.filter((stage) => stage.state === "completed").length, 0);
  assert.equal(timeline.filter((stage) => stage.state === "current").length, 0);
});

test("non-owner task detail access is rejected with a structured request-scoped error", async () => {
  setTaskQueryTestHooks({
    getTaskRowForUserImpl: async () => null,
    getTaskRowByIdImpl: async () => null,
  });

  await assert.rejects(
    runWithRequestContext(
      createRequestContext({
        "x-request-id": "req_forbidden_task_detail",
      }),
      async () => getTaskDetailForUser(7, "task_404"),
    ),
    (error: any) => {
      assert.equal(error.constructor?.name, "DataWithResponseInit");
      assert.equal(error.data.code, "task_not_found");
      assert.equal(error.init.status, 404);
      assert.equal(error.data.request_id, "req_forbidden_task_detail");
      return true;
    },
  );
});

test("existing task owned by someone else still returns forbidden instead of not found", async () => {
  setTaskQueryTestHooks({
    getTaskRowForUserImpl: async () => null,
    getTaskRowByIdImpl: async () =>
      makeTask(99, {
        creatorUserId: 42,
      }),
  });

  await assert.rejects(
    runWithRequestContext(
      createRequestContext({
        "x-request-id": "req_existing_forbidden_task_detail",
      }),
      async () => getTaskDetailForUser(7, "task_99"),
    ),
    (error: any) => {
      assert.equal(error.constructor?.name, "DataWithResponseInit");
      assert.equal(error.data.code, "task_forbidden");
      assert.equal(error.init.status, 403);
      assert.equal(error.data.request_id, "req_existing_forbidden_task_detail");
      return true;
    },
  );
});

test("status mapping helpers keep the unified task status contract readable", () => {
  const presentation = getTaskStatusPresentation("failed");
  const timeline = buildTaskStageTimeline("awaiting_human_review");
  const presetDecisionTimeline = buildTaskStageTimeline("awaiting_preset_decision");

  assert.equal(presentation.label, "处理失败");
  assert.equal(presentation.tone, "danger");
  assert.equal(timeline.at(-2)?.state, "attention");
  assert.equal(timeline.at(-1)?.state, "upcoming");
  assert.equal(presetDecisionTimeline.at(2)?.state, "attention");
});
