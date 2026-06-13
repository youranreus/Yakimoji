import assert from "node:assert/strict";
import test from "node:test";

import {
  loadOperationsDashboardViewModel,
  setOperationsDashboardTestHooks,
} from "../app/features/operations/server/operations-dashboard.server";
import { createRequestContext, runWithRequestContext } from "../app/features/auth/server/request-context.server";

function makeTask(
  id: string,
  overrides: Record<string, unknown> = {},
) {
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

test("operations dashboard aggregates preset paths, repeat misses, timings and friction into readable cards", async () => {
  let capturedTaskLimit: number | undefined;
  const taskRows = [
    makeTask("matched_1", {
      presetSnapshot: { status: "matched", summary: "自动命中已有预设" },
      status: "completed",
      updatedAt: new Date("2026-06-10T03:00:00.000Z"),
    }),
    makeTask("manual_reuse_1", {
      presetSnapshot: { status: "manual_reuse", summary: "手动复用已有预设" },
      updatedAt: new Date("2026-06-10T04:00:00.000Z"),
    }),
    makeTask("miss_1", {
      sourceIdentifier: "youtube:repeat-channel",
      sourceSnapshot: { title: "Repeat Channel" },
      presetSnapshot: { status: "continue_without_preset", summary: "未命中后继续" },
      updatedAt: new Date("2026-06-10T05:00:00.000Z"),
    }),
    makeTask("miss_2", {
      sourceIdentifier: "youtube:repeat-channel",
      sourceSnapshot: { title: "Repeat Channel" },
      presetSnapshot: { status: "unresolved", summary: "仍待预设决策" },
      updatedAt: new Date("2026-06-10T06:00:00.000Z"),
    }),
  ];

  const events = [
    makeEvent("matched_1", "task.queued", "2026-06-10T00:10:00.000Z"),
    makeEvent("matched_1", "task.completed", "2026-06-10T01:10:00.000Z", {
      toStatus: "completed",
    }),
    makeEvent("manual_reuse_1", "task.processing", "2026-06-10T00:20:00.000Z"),
    makeEvent("manual_reuse_1", "task.retry_requested", "2026-06-10T01:20:00.000Z"),
    makeEvent("miss_1", "task.preset_decision_requested", "2026-06-10T00:05:00.000Z", {
      toStatus: "awaiting_preset_decision",
    }),
    makeEvent("miss_1", "task.failed", "2026-06-10T00:30:00.000Z", {
      toStatus: "failed",
      reasonCode: "worker_timeout",
    }),
    makeEvent("miss_2", "task.review_required", "2026-06-10T00:25:00.000Z", {
      toStatus: "awaiting_human_review",
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

  assert.equal(model.metricCards.length, 5);
  assert.equal(capturedTaskLimit, 200);
  assert.equal(model.metricCards[0]?.title, "自动命中与复用占比");
  assert.match(model.metricCards[0]?.value ?? "", /50%/);
  assert.equal(
    model.metricCards[0]?.drilldownHref,
    "/operations?filter=preset_group&presetGroup=resolved",
  );
  assert.equal(model.metricCards[1]?.title, "反复未命中来源");
  assert.match(model.metricCards[1]?.value ?? "", /1 个来源/);
  assert.equal(
    model.metricCards[1]?.drilldownHref,
    "/operations?filter=preset_group&presetGroup=missed",
  );
  assert.match(model.metricCards[2]?.explanation ?? "", /queued\/processing/);
  assert.match(model.metricCards[3]?.supportingText ?? "", /completed 事件/);
  assert.match(model.metricCards[4]?.value ?? "", /等待预设决策|人工确认|处理失败|恢复重试/);
  assert.equal(
    model.metricCards[4]?.drilldownHref,
    "/operations?filter=abnormal_type&abnormalType=preset_decision",
  );
  assert.equal(model.topMissSources[0]?.sourceIdentifier, "youtube:repeat-channel");
  assert.equal(model.topMissSources[0]?.missCount, 2);
  assert.equal(model.drilldown.taskList.data.length, 4);
  assert.match(model.drilldown.taskList.data[2]?.presetPathLabel ?? "", /未命中/);
});

test("operations dashboard drill-down filters the task list and keeps readable empty states when no samples are computable", async () => {
  const taskRows = [
    makeTask("t1", {
      presetSnapshot: { status: "continue_without_preset", summary: "未命中后继续" },
      sourceIdentifier: "youtube:no-preset",
      sourceSnapshot: { title: "No Preset Channel" },
    }),
  ];
  const events = [
    makeEvent("t1", "task.preset_decision_requested", "2026-06-10T00:05:00.000Z", {
      toStatus: "awaiting_preset_decision",
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
    listOperationTaskEventsImpl: async () => events,
  });

  const model = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_operations_filter",
    }),
    async () =>
      loadOperationsDashboardViewModel({
        request: new Request(
          "http://localhost:3000/operations?filter=source&source=youtube:no-preset",
        ),
        context: {
          requestId: "req_operations_filter",
          releaseStage: "test",
          serviceName: "yakimoji",
        },
      }),
  );

  assert.match(model.metricCards[2]?.value ?? "", /暂无足够数据/);
  assert.match(model.metricCards[3]?.value ?? "", /暂无足够数据/);
  assert.equal(model.drilldown.taskList.data.length, 1);
  assert.match(model.drilldown.activeLabel, /youtube:no-preset/);
  assert.match(model.drilldown.taskList.data[0]?.operationsInsight ?? "", /等待预设决策/);
});

test("operations dashboard supports abnormal type drill-down and clamps out-of-range pages", async () => {
  const taskRows = [
    makeTask("failed_1", {
      status: "failed",
      updatedAt: new Date("2026-06-10T05:00:00.000Z"),
    }),
    makeTask("retry_1", {
      updatedAt: new Date("2026-06-10T04:00:00.000Z"),
    }),
  ];
  const events = [
    makeEvent("failed_1", "task.failed", "2026-06-10T00:30:00.000Z", {
      toStatus: "failed",
      reasonCode: "worker_timeout",
    }),
    makeEvent("retry_1", "task.retry_requested", "2026-06-10T00:20:00.000Z"),
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
      "x-request-id": "req_operations_abnormal",
    }),
    async () =>
      loadOperationsDashboardViewModel({
        request: new Request(
          "http://localhost:3000/operations?filter=abnormal_type&abnormalType=failed&page=999",
        ),
        context: {
          requestId: "req_operations_abnormal",
          releaseStage: "test",
          serviceName: "yakimoji",
        },
      }),
  );

  assert.equal(model.drilldown.taskList.data.length, 1);
  assert.equal(model.drilldown.taskList.data[0]?.id, "failed_1");
  assert.match(model.drilldown.activeLabel, /异常类型筛选：处理失败/);
  assert.equal(model.drilldown.taskList.meta.pagination.page, 1);
  assert.equal(model.drilldown.taskList.meta.pagination.totalPages, 1);
});
