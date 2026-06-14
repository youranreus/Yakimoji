import assert from "node:assert/strict";
import test from "node:test";

import { createRequestContext, runWithRequestContext } from "../app/features/auth/server/request-context.server";
import {
  loadTaskAuditViewModel,
  setTaskAuditTestHooks,
} from "../app/features/tasks/server/task-audit.server";

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task_audit_1",
    creatorUserId: 7,
    sourceIdentifier: "youtube:source_1",
    sourceSnapshot: {
      title: "来源标题",
    },
    presetSnapshot: {
      status: "matched",
      summary: "命中预设",
    },
    status: "completed",
    createdAt: new Date("2026-05-26T01:00:00.000Z"),
    updatedAt: new Date("2026-05-26T04:00:00.000Z"),
    ...overrides,
  };
}

test.beforeEach(() => {
  setTaskAuditTestHooks({});
});

test("task audit model returns a structured minimum record and unified timeline", async () => {
  const task = makeTask({
    sourceSnapshot: {
      title: "来源标题",
      attempt: {
        attemptNumber: 2,
        originTaskId: "task_origin",
        retryOfTaskId: "task_prev",
      },
    },
  });

  setTaskAuditTestHooks({
    getTaskRowByIdImpl: async () => task,
    getTaskEventLedgerImpl: async () => [
      {
        id: "event_created",
        taskId: task.id,
        eventType: "task.created",
        fromStatus: "created",
        toStatus: "created",
        reasonCode: null,
        requestId: "req_audit_1",
        actorUserId: null,
        payload: {},
        createdAt: new Date("2026-05-26T01:00:00.000Z"),
      },
      {
        id: "event_retry",
        taskId: task.id,
        eventType: "task.retry_requested",
        fromStatus: "failed",
        toStatus: "queued",
        reasonCode: "worker_timeout",
        requestId: "req_audit_2",
        actorUserId: 7,
        payload: {},
        createdAt: new Date("2026-05-26T02:00:00.000Z"),
      },
    ],
    listAuditLogEntriesImpl: async () => [
      {
        id: 1,
        requestId: "req_download_1",
        actorUserId: 7,
        eventType: "deliverable.download",
        resourceType: "deliverable",
        resourceId: "deliverable_1",
        outcome: "success",
        detail: {
          taskId: task.id,
          fileName: "final.mp4",
        },
        occurredAt: new Date("2026-05-26T03:00:00.000Z"),
      },
    ],
  });

  const model = await runWithRequestContext(
    createRequestContext({ "x-request-id": "req_model_audit" }),
    async () =>
      loadTaskAuditViewModel({
        request: new Request("http://localhost/tasks/task_audit_1/audit"),
        taskId: task.id,
      }),
  );

  assert.equal(model.taskId, task.id);
  assert.equal(model.sourceIdentifier, "youtube:source_1");
  assert.equal(model.attemptNumber, 2);
  assert.equal(model.originTaskId, "task_origin");
  assert.ok(model.timeline.some((item) => item.label === "任务已创建"));
  assert.ok(model.timeline.some((item) => item.label === "预设已应用"));
  assert.ok(model.timeline.some((item) => item.label === "已请求恢复重试"));
  assert.ok(model.timeline.some((item) => item.label === "交付物已访问"));
  assert.equal(model.accessLogs[0]?.requestId, "req_download_1");
  assert.equal(model.accessLogs[0]?.detail, "文件：final.mp4");
});

test("task audit model keeps failure, review and retention messaging available", async () => {
  setTaskAuditTestHooks({
    getTaskRowByIdImpl: async () =>
      makeTask({
        status: "failed",
      }),
    getTaskEventLedgerImpl: async () => [
      {
        id: "event_failure",
        taskId: "task_audit_1",
        eventType: "task.failed",
        fromStatus: "processing",
        toStatus: "failed",
        reasonCode: "worker_timeout",
        requestId: "req_failure",
        actorUserId: null,
        payload: {
          failureStage: "字幕生成",
          failureMessage: "处理节点超时。",
          diagnosticTraceId: "trace_1",
          retryable: true,
        },
        createdAt: new Date("2026-05-26T02:00:00.000Z"),
      },
      {
        id: "event_review",
        taskId: "task_audit_1",
        eventType: "task.review_required",
        fromStatus: "processing",
        toStatus: "awaiting_human_review",
        reasonCode: null,
        requestId: "req_review",
        actorUserId: 7,
        payload: {
          reviewId: "review_1",
          items: [{ snippet: "片段一" }],
        },
        createdAt: new Date("2026-05-26T01:30:00.000Z"),
      },
    ],
    listAuditLogEntriesImpl: async () => [],
  });

  const model = await runWithRequestContext(
    createRequestContext({ "x-request-id": "req_model_audit_2" }),
    async () =>
      loadTaskAuditViewModel({
        request: new Request("http://localhost/tasks/task_audit_1/audit"),
        taskId: "task_audit_1",
      }),
  );

  assert.equal(model.failureSummary?.reasonCode, "worker_timeout");
  assert.equal(model.reviewSummary?.reviewId, "review_1");
  assert.match(model.retentionNote, /30 天/);
});

test("task audit model marks partial history and keeps sensitive access audits visible", async () => {
  setTaskAuditTestHooks({
    getTaskRowByIdImpl: async () =>
      makeTask({
        createdAt: new Date("2026-04-01T01:00:00.000Z"),
        updatedAt: new Date("2026-06-14T02:00:00.000Z"),
      }),
    getTaskEventLedgerImpl: async () => [
      {
        id: "event_manual",
        taskId: "task_audit_1",
        eventType: "task.manual_intervention",
        fromStatus: "processing",
        toStatus: "processing",
        reasonCode: null,
        requestId: "req_manual",
        actorUserId: 9,
        payload: {
          note: "人工补充来源信息",
        },
        createdAt: new Date("2026-06-14T01:30:00.000Z"),
      },
    ],
    listAuditLogEntriesImpl: async () => [
      {
        id: 2,
        requestId: "req_forbidden",
        actorUserId: 9,
        eventType: "authorization.denied",
        resourceType: "task-audit",
        resourceId: "task_audit_1",
        outcome: "forbidden",
        detail: {
          requiredAnyRole: ["support", "ops", "admin"],
        },
        occurredAt: new Date("2026-06-14T01:40:00.000Z"),
      },
      {
        id: 3,
        requestId: "req_api_query",
        actorUserId: 12,
        eventType: "task.api_query",
        resourceType: "task",
        resourceId: "task_audit_1",
        outcome: "success",
        detail: {
          apiCredentialId: "cred_1",
        },
        occurredAt: new Date("2026-06-14T01:50:00.000Z"),
      },
    ],
  });

  const model = await runWithRequestContext(
    createRequestContext({ "x-request-id": "req_model_audit_3" }),
    async () =>
      loadTaskAuditViewModel({
        request: new Request("http://localhost/tasks/task_audit_1/audit"),
        taskId: "task_audit_1",
      }),
  );

  assert.equal(model.partialHistory, true);
  assert.match(model.retentionNote, /早于 30 天保留窗口/);
  assert.ok(model.timeline.some((item) => item.label === "已记录人工介入"));
  assert.ok(model.accessLogs.some((item) => item.label === "越权访问拒绝"));
  assert.ok(model.accessLogs.some((item) => item.label === "任务读取审计"));
});
