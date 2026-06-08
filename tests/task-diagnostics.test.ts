import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRetryAttemptSnapshot,
  extractFailureContext,
  extractReviewQueue,
} from "../app/features/tasks/server/task-diagnostics.server";

test("extractReviewQueue normalizes low-confidence review payloads", () => {
  const queue = extractReviewQueue([
    {
      id: "event_1",
      eventType: "task.review_required",
      fromStatus: "processing",
      toStatus: "awaiting_human_review",
      reasonCode: null,
      requestId: "req_review_contract",
      createdAt: new Date("2026-05-26T01:00:00.000Z"),
      payload: {
        reviewId: "review_1",
        items: [
          {
            id: "item_1",
            snippet: "片段一",
            contextBefore: "前文一",
            contextAfter: "后文一",
          },
        ],
      },
    },
  ]);

  assert.equal(queue?.reviewId, "review_1");
  assert.equal(queue?.pendingCount, 1);
  assert.equal(queue?.items[0]?.snippet, "片段一");
});

test("extractFailureContext keeps stable failure semantics", () => {
  const failure = extractFailureContext([
    {
      id: "event_failed",
      eventType: "task.failed",
      fromStatus: "processing",
      toStatus: "failed",
      reasonCode: "worker_timeout",
      requestId: "req_failure_contract",
      createdAt: new Date("2026-05-26T02:00:00.000Z"),
      payload: {
        failureStage: "字幕生成",
        failureMessage: "处理节点超时。",
        diagnosticTraceId: "trace_failure_1",
        retryable: true,
        recommendedAction: "创建新的恢复 attempt。",
      },
    },
  ]);

  assert.equal(failure?.stage, "字幕生成");
  assert.equal(failure?.reasonCode, "worker_timeout");
  assert.equal(failure?.diagnosticTraceId, "trace_failure_1");
  assert.equal(failure?.retryable, true);
});

test("buildRetryAttemptSnapshot increments attempt lineage without mutating origin", () => {
  const nextAttempt = buildRetryAttemptSnapshot({
    sourceSnapshot: {
      attempt: {
        attemptNumber: 2,
        originTaskId: "task_origin",
        retryOfTaskId: "task_prev",
      },
    },
    currentTaskId: "task_current",
    nextTaskId: "task_next",
  });

  assert.equal(nextAttempt.attemptNumber, 3);
  assert.equal(nextAttempt.originTaskId, "task_origin");
  assert.equal(nextAttempt.retryOfTaskId, "task_current");
});
