import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTaskStageTimeline,
  getTaskStatusPresentation,
} from "../app/features/tasks/server/task-status.server";
import {
  getTaskDetailForSupport,
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
    presetSnapshot: {
      status: "none",
      summary: "未命中频道预设，将使用当前默认处理基线。",
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
    presetSnapshot: {
      status: "manual_reuse",
      summary: "手动复用预设「复用科普模板」继续当前任务：英译中字幕 / 科普模板 / mp4 + srt",
      defaults: {
        subtitleTemplate: "科普模板",
      },
    },
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
  assert.equal(detail.presetContextLabel, "手动复用已有预设");
  assert.match(detail.presetContextSummary, /手动复用预设/);
  assert.equal(detail.baselineSummary, "中译中 / 标准模板 / SRT");
  assert.equal(detail.subtitleTemplateContextLabel, "沿用预设默认模板");
  assert.match(detail.subtitleTemplateContextSummary, /科普模板/);
  assert.equal(detail.currentStageLabel, "等待人工复核");
  assert.equal(detail.latestProgressLabel, "已进入人工复核队列");
  assert.equal(detail.attempt.attemptNumber, 1);
  assert.equal(detail.reviewQueue?.items.length, 0);
  assert.equal(detail.failureContext, null);
  assert.deepEqual(
    detail.events.map((event) => event.eventType),
    ["task.created", "task.processing", "task.human_review_requested"],
  );
  assert.equal(detail.events[0]?.stageState, "completed");
  assert.equal(detail.events.at(-1)?.stageState, "attention");
});

test("task detail surfaces readable semantics for manual_create decisions", async () => {
  const task = makeTask(6, {
    status: "processing",
    presetSnapshot: {
      status: "manual_create",
      summary: "已为当前来源创建最小预设「新频道模板」并继续当前任务：英译中字幕 / 新频道模板 / mp4 + srt",
      defaults: {
        subtitleTemplate: "新频道模板",
      },
    },
    processingBaselineSnapshot: {
      translationMode: "英译中字幕",
      subtitleTemplate: "新频道模板",
      outputPackage: "mp4 + srt",
    },
  });

  setTaskQueryTestHooks({
    getTaskRowForUserImpl: async () => task,
    getTaskEventLedgerImpl: async () => [],
    getLatestTaskEventForTaskImpl: async () => null,
    listDeliverablesForTaskDetailImpl: async () => [],
  });

  const detail = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_detail_manual_create",
    }),
    async () => getTaskDetailForUser(7, "task_6"),
  );

  assert.equal(detail.presetContextLabel, "新建最小预设后继续");
  assert.match(detail.presetContextSummary, /创建最小预设/);
  assert.equal(detail.subtitleTemplateContextLabel, "沿用预设默认模板");
  assert.match(detail.subtitleTemplateContextSummary, /新频道模板/);
});

test("task detail surfaces readable semantics for continue_without_preset decisions", async () => {
  const task = makeTask(7, {
    status: "queued",
    presetSnapshot: {
      status: "continue_without_preset",
      summary: "未保存频道预设，继续使用当前默认处理基线：中译中 / 标准模板 / SRT",
    },
  });

  setTaskQueryTestHooks({
    getTaskRowForUserImpl: async () => task,
    getTaskEventLedgerImpl: async () => [],
    getLatestTaskEventForTaskImpl: async () => null,
    listDeliverablesForTaskDetailImpl: async () => [],
  });

  const detail = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_detail_continue_without_preset",
    }),
    async () => getTaskDetailForUser(7, "task_7"),
  );

  assert.equal(detail.presetContextLabel, "未保存预设继续");
  assert.match(detail.presetContextSummary, /未保存频道预设/);
  assert.equal(detail.subtitleTemplateContextLabel, "使用当前处理基线");
  assert.match(detail.subtitleTemplateContextSummary, /标准模板/);
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

test("task detail distinguishes task-level subtitle overrides from preset defaults", async () => {
  const task = makeTask(3, {
    sourceSnapshot: {
      title: "Task 3",
      taskLevelOverrides: {
        subtitleTemplate: "高对比模板",
      },
    },
    presetSnapshot: {
      status: "matched",
      summary: "英译中字幕 / 科普模板 / mp4 + srt",
      defaults: {
        subtitleTemplate: "科普模板",
      },
    },
    processingBaselineSnapshot: {
      translationMode: "英译中字幕",
      subtitleTemplate: "高对比模板",
      outputPackage: "mp4 + srt",
    },
    status: "processing",
  });

  setTaskQueryTestHooks({
    getTaskRowForUserImpl: async () => task,
    getTaskEventLedgerImpl: async () => [],
    getLatestTaskEventForTaskImpl: async () => null,
    listDeliverablesForTaskDetailImpl: async () => [],
  });

  const detail = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_detail_override",
    }),
    async () => getTaskDetailForUser(7, "task_3"),
  );

  assert.equal(detail.subtitleTemplateContextLabel, "任务级字幕模板覆盖");
  assert.match(detail.subtitleTemplateContextSummary, /高对比模板/);
  assert.match(detail.subtitleTemplateContextSummary, /科普模板/);
});

test("task detail builds low-confidence review queue and preserves creator access mode", async () => {
  const task = makeTask(4, {
    status: "awaiting_human_review",
    sourceSnapshot: {
      title: "Task 4",
      attempt: {
        attemptNumber: 1,
        originTaskId: "task_4",
        retryOfTaskId: null,
      },
    },
  });
  const events = [
    makeEvent("task_4", "task.created", "2026-05-26T03:00:00.000Z", {
      fromStatus: "created",
      toStatus: "created",
    }),
    makeEvent("task_4", "task.review_required", "2026-05-26T03:10:00.000Z", {
      fromStatus: "processing",
      toStatus: "awaiting_human_review",
      payload: {
        reviewId: "review_4",
        summary: "有两个低置信度片段需要人工确认。",
        items: [
          {
            id: "item_1",
            snippet: "第一段字幕",
            contextBefore: "前文 A",
            contextAfter: "后文 A",
            confidenceLabel: "低置信度",
          },
          {
            id: "item_2",
            snippet: "第二段字幕",
            contextBefore: "前文 B",
            contextAfter: "后文 B",
            confidenceLabel: "中低置信度",
          },
        ],
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
      "x-request-id": "req_review_queue",
    }),
    async () => getTaskDetailForUser(7, "task_4"),
  );

  assert.equal(detail.accessMode, "creator");
  assert.equal(detail.reviewQueue?.reviewId, "review_4");
  assert.equal(detail.reviewQueue?.items.length, 2);
  assert.equal(detail.reviewQueue?.pendingCount, 2);
  assert.equal(detail.reviewQueue?.items[0]?.snippet, "第一段字幕");
});

test("support detail exposes diagnostic timeline and hides deliverables", async () => {
  const task = makeTask(5, {
    status: "failed",
    sourceSnapshot: {
      title: "Task 5",
      attempt: {
        attemptNumber: 2,
        originTaskId: "task_1",
        retryOfTaskId: "task_4",
      },
    },
    presetSnapshot: {
      status: "manual_reuse",
      summary: "手动复用预设继续",
    },
  });
  const events = [
    makeEvent("task_5", "task.created", "2026-05-26T04:00:00.000Z", {
      fromStatus: "created",
      toStatus: "created",
    }),
    makeEvent("task_5", "task.preset_decision_requested", "2026-05-26T04:01:00.000Z", {
      fromStatus: "matching_preset",
      toStatus: "awaiting_preset_decision",
      reasonCode: "preset_not_found",
      payload: {
        message: "当前来源未命中现有预设，需要人工决定如何继续。",
      },
    }),
    makeEvent("task_5", "task.retry_spawned", "2026-05-26T04:02:00.000Z", {
      fromStatus: "created",
      toStatus: "queued",
      payload: {
        sourceTaskId: "task_4",
        attemptNumber: 2,
      },
    }),
    makeEvent("task_5", "task.review_required", "2026-05-26T04:05:00.000Z", {
      fromStatus: "processing",
      toStatus: "awaiting_human_review",
      payload: {
        reviewId: "review_5",
        items: [{ id: "item_1", snippet: "待确认片段" }],
      },
    }),
    makeEvent("task_5", "task.review_resolved", "2026-05-26T04:07:00.000Z", {
      fromStatus: "awaiting_human_review",
      toStatus: "queued",
      payload: {
        reviewId: "review_5",
        resolvedItems: [{ itemId: "item_1", decision: "approve" }],
      },
    }),
    makeEvent("task_5", "task.manual_intervention", "2026-05-26T04:09:00.000Z", {
      fromStatus: "queued",
      toStatus: "queued",
      payload: {
        note: "支持人员补充了人工排障记录。",
      },
    }),
    makeEvent("task_5", "task.failed", "2026-05-26T04:12:00.000Z", {
      fromStatus: "processing",
      toStatus: "failed",
      reasonCode: "worker_timeout",
      payload: {
        failureStage: "字幕生成",
        failureMessage: "外部处理节点超时。",
        diagnosticTraceId: "trace_task_5",
        retryable: true,
        recommendedAction: "创建新的恢复 attempt。",
        supportCategory: "worker-timeout",
      },
    }),
  ];

  setTaskQueryTestHooks({
    getTaskRowByIdImpl: async () => task,
    getTaskEventLedgerImpl: async () => events,
    getLatestTaskEventForTaskImpl: async () => events.at(-1) ?? null,
  });

  const detail = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_support_detail",
    }),
    async () => getTaskDetailForSupport("task_5"),
  );

  assert.equal(detail.accessMode, "support");
  assert.equal(detail.failureContext?.reasonCode, "worker_timeout");
  assert.equal(detail.supportDiagnostics?.attemptNumber, 2);
  assert.equal(detail.supportDiagnostics?.originTaskId, "task_1");
  assert.equal(detail.supportDiagnostics?.currentTaskId, "task_5");
  assert.equal(detail.supportDiagnostics?.presetReasonCategory, "preset_not_found");
  assert.match(detail.supportDiagnostics?.presetReason ?? "", /未命中现有预设/);
  assert.equal(detail.supportDiagnostics?.entries.length, 6);
  assert.equal(detail.supportDiagnostics?.manualHistory.length, 3);
  assert.equal(detail.supportDiagnostics?.manualHistory[0]?.label, "人工确认已请求");
  assert.equal(detail.supportDiagnostics?.manualHistory[1]?.label, "人工确认已提交");
  assert.equal(detail.supportDiagnostics?.manualHistory[2]?.label, "人工介入已记录");
  assert.equal(detail.deliverables.length, 0);
  assert.equal(detail.resultStatus.label, "诊断视图");
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
