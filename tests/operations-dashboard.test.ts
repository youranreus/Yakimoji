import assert from "node:assert/strict";
import test from "node:test";

import {
  loadOperationsDashboardViewModel,
  setOperationsDashboardTestHooks,
} from "../app/features/operations/server/operations-dashboard.server";
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
  setOperationsDashboardTestHooks({});
});

test("operations dashboard builds official 6.1 KPI cards and preset outcome drill-downs", async () => {
  let capturedTaskLimit: number | undefined;
  const taskRows = [
    makeTask("matched_1", {
      presetSnapshot: { status: "matched", summary: "自动命中已有预设" },
      status: "completed",
      updatedAt: new Date("2026-06-10T03:00:00.000Z"),
    }),
    makeTask("manual_reuse_1", {
      presetSnapshot: { status: "manual_reuse", summary: "手动复用已有预设" },
      status: "processing",
      updatedAt: new Date("2026-06-10T04:00:00.000Z"),
    }),
    makeTask("manual_create_1", {
      presetSnapshot: { status: "manual_create", summary: "新建最小预设后继续" },
      status: "processing",
      updatedAt: new Date("2026-06-10T05:00:00.000Z"),
    }),
    makeTask("continue_1", {
      presetSnapshot: { status: "continue_without_preset", summary: "未使用预设继续" },
      status: "awaiting_preset_decision",
      updatedAt: new Date("2026-06-10T06:00:00.000Z"),
    }),
    makeTask("failed_1", {
      presetSnapshot: { status: "matched", summary: "自动命中已有预设" },
      status: "failed",
      updatedAt: new Date("2026-06-10T07:00:00.000Z"),
    }),
  ];

  const events = [
    makeEvent("matched_1", "task.queued", "2026-06-10T00:10:00.000Z", {
      toStatus: "queued",
    }),
    makeEvent("matched_1", "task.completed", "2026-06-10T01:10:00.000Z", {
      fromStatus: "processing",
      toStatus: "completed",
    }),
    makeEvent("manual_reuse_1", "task.processing", "2026-06-10T00:20:00.000Z"),
    makeEvent("manual_create_1", "task.processing", "2026-06-10T00:50:00.000Z"),
    makeEvent(
      "continue_1",
      "task.preset_decision_requested",
      "2026-06-10T00:05:00.000Z",
      {
        toStatus: "awaiting_preset_decision",
      },
    ),
    makeEvent("failed_1", "task.queued", "2026-06-10T00:15:00.000Z", {
      toStatus: "queued",
    }),
    makeEvent("failed_1", "task.failed", "2026-06-10T00:40:00.000Z", {
      fromStatus: "processing",
      toStatus: "failed",
      reasonCode: "worker_timeout",
    }),
  ];

  setOperationsDashboardTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 7,
        displayName: "运营同学",
        email: "ops@example.com",
      },
      session: {
        id: "sess_ops_1",
      },
    }),
    getCurrentUserRolesImpl: async () => ["ops"],
    requireAnyRoleImpl: async () => ["ops"],
    listOperationTasksImpl: async (limit?: number) => {
      capturedTaskLimit = limit;

      return taskRows;
    },
    listOperationTaskEventsImpl: async () => events,
  });

  const model = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_operations_dashboard",
    }),
    async () =>
      loadOperationsDashboardViewModel({
        request: new Request("http://localhost:3000/operations"),
        context: {
          requestId: "req_operations_dashboard",
          releaseStage: "test",
          serviceName: "yakimoji",
        },
      }),
  );

  assert.equal(capturedTaskLimit, 200);
  assert.equal(model.metricCards.length, 5);
  assert.equal(model.metricCards[0]?.title, "预设命中率");
  assert.equal(
    model.metricCards[0]?.drilldownHref,
    "/operations?filter=metric_scope&metricScope=matched_existing_preset",
  );
  assert.match(model.metricCards[0]?.value ?? "", /40%/);
  assert.equal(model.metricCards[1]?.title, "预设复用率");
  assert.match(model.metricCards[1]?.value ?? "", /60%/);
  assert.match(model.metricCards[1]?.explanation ?? "", /不把“新建预设后继续”/);
  assert.equal(model.metricCards[2]?.title, "导入到进入处理耗时");
  assert.match(model.metricCards[2]?.value ?? "", /中位/);
  assert.match(model.metricCards[2]?.supportingText ?? "", /完成耗时/);
  assert.equal(model.metricCards[3]?.title, "人工介入任务占比");
  assert.match(model.metricCards[3]?.value ?? "", /20%/);
  assert.equal(model.metricCards[4]?.title, "失败或中断任务占比");
  assert.match(model.metricCards[4]?.value ?? "", /20%/);

  assert.equal(model.pathBreakdown.length, 5);
  assert.equal(model.pathBreakdown[0]?.label, "自动命中已有预设");
  assert.equal(model.pathBreakdown[0]?.count, 2);
  assert.equal(
    model.pathBreakdown[3]?.drilldownHref,
    "/operations?filter=preset_path&presetPath=continue_without_preset",
  );

  assert.equal(model.drilldown.taskList.data.length, 5);
  assert.equal(model.drilldown.taskList.data[0]?.id, "matched_1");
  assert.equal(model.drilldown.taskList.data[0]?.presetOutcomeLabel, "自动命中已有预设");
  assert.ok(model.drilldown.taskList.data[0]?.enteredProcessingAt);
  assert.ok(model.drilldown.taskList.data[0]?.completedAt);
});

test("operations dashboard drill-down keeps timing samples only and surfaces empty copy when events are missing", async () => {
  const taskRows = [
    makeTask("t1", {
      presetSnapshot: { status: "continue_without_preset", summary: "未使用预设继续" },
      sourceIdentifier: "youtube:no-events",
      sourceSnapshot: { title: "No Events Channel" },
      status: "created",
    }),
  ];

  setOperationsDashboardTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 8,
        displayName: "运营同学",
        email: "ops@example.com",
      },
      session: {
        id: "sess_ops_2",
      },
    }),
    getCurrentUserRolesImpl: async () => ["ops"],
    requireAnyRoleImpl: async () => ["ops"],
    listOperationTasksImpl: async () => taskRows,
    listOperationTaskEventsImpl: async () => [],
  });

  const model = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_operations_filter",
    }),
    async () =>
      loadOperationsDashboardViewModel({
        request: new Request(
          "http://localhost:3000/operations?filter=metric_scope&metricScope=timing_samples",
        ),
        context: {
          requestId: "req_operations_filter",
          releaseStage: "test",
          serviceName: "yakimoji",
        },
      }),
  );

  assert.match(model.metricCards[2]?.value ?? "", /暂无足够数据/);
  assert.equal(model.drilldown.taskList.data.length, 0);
  assert.match(model.drilldown.activeLabel, /关键耗时样本/);
});

test("operations dashboard supports preset-path drill-down and clamps out-of-range pages", async () => {
  const taskRows = [
    makeTask("reuse_1", {
      presetSnapshot: { status: "manual_reuse", summary: "手动复用已有预设" },
      updatedAt: new Date("2026-06-10T05:00:00.000Z"),
    }),
    makeTask("reuse_2", {
      presetSnapshot: { status: "manual_reuse", summary: "手动复用已有预设" },
      updatedAt: new Date("2026-06-10T04:00:00.000Z"),
    }),
  ];
  const events = [
    makeEvent("reuse_1", "task.processing", "2026-06-10T00:30:00.000Z"),
    makeEvent("reuse_2", "task.processing", "2026-06-10T00:20:00.000Z"),
  ];

  setOperationsDashboardTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 9,
        displayName: "运营同学",
        email: "ops@example.com",
      },
      session: {
        id: "sess_ops_3",
      },
    }),
    getCurrentUserRolesImpl: async () => ["ops"],
    requireAnyRoleImpl: async () => ["ops"],
    listOperationTasksImpl: async () => taskRows,
    listOperationTaskEventsImpl: async () => events,
  });

  const model = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_operations_reuse",
    }),
    async () =>
      loadOperationsDashboardViewModel({
        request: new Request(
          "http://localhost:3000/operations?filter=preset_path&presetPath=manual_reuse&page=999",
        ),
        context: {
          requestId: "req_operations_reuse",
          releaseStage: "test",
          serviceName: "yakimoji",
        },
      }),
  );

  assert.equal(model.drilldown.taskList.data.length, 2);
  assert.equal(model.drilldown.taskList.data[0]?.presetOutcomeLabel, "手动复用已有预设");
  assert.match(model.drilldown.activeLabel, /手动复用已有预设/);
  assert.equal(model.drilldown.taskList.meta.pagination.page, 1);
  assert.equal(model.drilldown.taskList.meta.pagination.totalPages, 1);
});
