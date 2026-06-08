import test from "node:test";
import assert from "node:assert/strict";

import { loader as statusLoader } from "../../app/routes/api.tasks.$taskId.ts";
import { loader as resultLoader } from "../../app/routes/api.tasks.$taskId.result.ts";
import { loader as downloadLoader } from "../../app/routes/api.tasks.$taskId.result.deliverables.$deliverableId.download.ts";
import {
  hashApiCredentialSecret,
  setApiCredentialTestHooks,
} from "../../app/features/api-credentials/server/api-credential-auth.server";
import { setApiTaskQueryTestHooks } from "../../app/features/tasks/server/api-task-query.server";
import { createRequestContext, runWithRequestContext } from "../../app/features/auth/server/request-context.server";

const originalEnv = { ...process.env };

function makeCredential(overrides = {}) {
  const now = new Date("2026-06-08T10:00:00.000Z");
  const id = "cred_status";
  const secret = "secret-token";

  return {
    id,
    ownerUserId: 7,
    label: "Status Credential",
    secretHash: hashApiCredentialSecret(id, secret),
    status: "active",
    expiresAt: null,
    lastUsedAt: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    rawSecret: secret,
    ...overrides,
  };
}

function makeTaskDetail(overrides = {}) {
  return {
    id: "task_api_1",
    sourceIdentifier: "youtube:KurzgesagtCN",
    sourceTitle: "YouTube 视频 abc123",
    status: "processing",
    statusLabel: "正在处理",
    statusTone: "info",
    presetContextLabel: "已命中预设",
    presetContextSummary: "英译中字幕 / 科普模板 / mp4 + srt",
    baselineSummary: "英译中字幕 / 科普模板 / mp4 + srt",
    subtitleTemplateContextLabel: "预设模板",
    subtitleTemplateContextSummary: "科普模板",
    currentStageLabel: "处理中",
    latestProgressLabel: "正在处理内容",
    requestId: "req_status_detail",
    createdAt: "2026-06-08T10:00:00.000Z",
    updatedAt: "2026-06-08T10:05:00.000Z",
    nextStepLabel: "请等待处理完成",
    resultStatus: {
      label: "处理中",
      description: "任务尚未完成",
      tone: "info",
    },
    accessMode: "creator",
    attempt: {
      originTaskId: "task_api_1",
      attemptNumber: 1,
      retryOfTaskId: null,
    },
    reviewQueue: null,
    failureContext: null,
    supportDiagnostics: null,
    deliverables: [],
    stages: [],
    events: [],
    ...overrides,
  };
}

async function runLoader(loader, request, params) {
  return runWithRequestContext(
    createRequestContext(Object.fromEntries(request.headers.entries())),
    async () => loader({ request, params }),
  );
}

test.before(() => {
  process.env.API_CREDENTIAL_PEPPER = "pepper-for-tests";
});

test.beforeEach(() => {
  setApiCredentialTestHooks({});
  setApiTaskQueryTestHooks({});
});

test.after(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

test("GET /tasks/:taskId returns the unified status contract for an owned task", async () => {
  const credential = makeCredential();

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async () => credential,
    updateCredentialLastUsedAtImpl: async () => {},
    writeAuditLogImpl: async () => {},
  });
  setApiTaskQueryTestHooks({
    getOwnedTaskImpl: async () => ({
      id: "task_api_1",
      creatorUserId: 7,
      apiCredentialId: credential.id,
      presetSnapshot: { status: "matched" },
      status: "processing",
    }),
    getTaskDetailForUserImpl: async () => makeTaskDetail(),
    writeAuditLogImpl: async () => {},
  });

  const request = new Request("http://localhost/tasks/task_api_1", {
    headers: {
      authorization: `Bearer ${credential.id}.${credential.rawSecret}`,
      "x-request-id": "req_api_status",
    },
  });

  const response = await runLoader(statusLoader, request, {
    taskId: "task_api_1",
  });

  assert.equal(response.init?.status, 200);
  assert.equal(response.data.data.taskId, "task_api_1");
  assert.equal(response.data.data.status, "processing");
  assert.equal(response.data.data.resultState, "not_ready");
  assert.equal(response.data.data.reviewState, "none");
  assert.equal(response.data.data.presetResolution.status, "matched");
});

test("GET /tasks/:taskId maps awaiting_human_review tasks into the public review state contract", async () => {
  const credential = makeCredential();

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async () => credential,
    updateCredentialLastUsedAtImpl: async () => {},
    writeAuditLogImpl: async () => {},
  });
  setApiTaskQueryTestHooks({
    getOwnedTaskImpl: async () => ({
      id: "task_api_review",
      creatorUserId: 7,
      apiCredentialId: credential.id,
      presetSnapshot: { status: "manual_reuse" },
      status: "awaiting_human_review",
    }),
    getTaskDetailForUserImpl: async () =>
      makeTaskDetail({
        id: "task_api_review",
        status: "awaiting_human_review",
        statusLabel: "等待人工复核",
        reviewQueue: {
          totalItems: 1,
          items: [
            {
              clipId: "clip_1",
              sourceText: "hello",
              suggestedText: "你好",
              confidence: 0.42,
              reason: "low_confidence",
            },
          ],
        },
      }),
    writeAuditLogImpl: async () => {},
  });

  const request = new Request("http://localhost/tasks/task_api_review", {
    headers: {
      authorization: `Bearer ${credential.id}.${credential.rawSecret}`,
      "x-request-id": "req_api_review_state",
    },
  });

  const response = await runLoader(statusLoader, request, {
    taskId: "task_api_review",
  });

  assert.equal(response.init?.status, 200);
  assert.equal(response.data.data.status, "awaiting_human_review");
  assert.equal(response.data.data.reviewState, "required");
  assert.equal(response.data.data.resultState, "not_ready");
  assert.equal(response.data.data.presetResolution.status, "manual_reuse");
});

test("GET /tasks/:taskId returns structured non-match semantics for unresolved preset decisions", async () => {
  const credential = makeCredential();

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async () => credential,
    updateCredentialLastUsedAtImpl: async () => {},
    writeAuditLogImpl: async () => {},
  });
  setApiTaskQueryTestHooks({
    getOwnedTaskImpl: async () => ({
      id: "task_api_non_match",
      creatorUserId: 7,
      apiCredentialId: credential.id,
      presetSnapshot: { status: "unresolved" },
      status: "awaiting_preset_decision",
    }),
    getTaskDetailForUserImpl: async () =>
      makeTaskDetail({
        id: "task_api_non_match",
        status: "awaiting_preset_decision",
        statusLabel: "等待预设决策",
      }),
    writeAuditLogImpl: async () => {},
  });

  const request = new Request("http://localhost/tasks/task_api_non_match", {
    headers: {
      authorization: `Bearer ${credential.id}.${credential.rawSecret}`,
      "x-request-id": "req_api_non_match",
    },
  });

  const response = await runLoader(statusLoader, request, {
    taskId: "task_api_non_match",
  });

  assert.equal(response.init?.status, 200);
  assert.equal(response.data.data.status, "awaiting_preset_decision");
  assert.equal(response.data.data.presetResolution.status, "unresolved");
  assert.equal(
    response.data.data.presetResolution.nextAction,
    "manual_resolution_required",
  );
  assert.equal(
    response.data.data.presetResolution.message,
    "No matching preset was found for this source.",
  );
  assert.equal(response.data.data.failure, null);
});

test("GET /tasks/:taskId returns structured failure details with normalized stage values", async () => {
  const credential = makeCredential();

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async () => credential,
    updateCredentialLastUsedAtImpl: async () => {},
    writeAuditLogImpl: async () => {},
  });
  setApiTaskQueryTestHooks({
    getOwnedTaskImpl: async () => ({
      id: "task_api_failed",
      creatorUserId: 7,
      apiCredentialId: credential.id,
      presetSnapshot: { status: "matched" },
      status: "failed",
    }),
    getTaskDetailForUserImpl: async () =>
      makeTaskDetail({
        id: "task_api_failed",
        status: "failed",
        statusLabel: "处理失败",
        failureContext: {
          stage: "字幕生成",
          message: "处理节点超时。",
          reasonCode: "worker_timeout",
          diagnosticTraceId: "trace_failure_1",
          retryable: true,
          recommendedAction: "创建新的恢复 attempt。",
          supportCategory: null,
        },
      }),
    writeAuditLogImpl: async () => {},
  });

  const request = new Request("http://localhost/tasks/task_api_failed", {
    headers: {
      authorization: `Bearer ${credential.id}.${credential.rawSecret}`,
      "x-request-id": "req_api_failure",
    },
  });

  const response = await runLoader(statusLoader, request, {
    taskId: "task_api_failed",
  });

  assert.equal(response.init?.status, 200);
  assert.equal(response.data.data.status, "failed");
  assert.equal(response.data.data.resultState, "failed");
  assert.equal(response.data.data.failure.reasonCode, "worker_timeout");
  assert.equal(response.data.data.failure.stage, "subtitle_generation");
  assert.equal(response.data.data.failure.message, "处理节点超时。");
  assert.equal(response.data.data.failure.diagnosticTraceId, "trace_failure_1");
  assert.equal(response.data.data.failure.retryable, true);
  assert.equal(
    response.data.data.failure.recommendedAction,
    "retry_with_new_attempt",
  );
});

test("GET /tasks/:taskId ignores stale failure context once the task has recovered", async () => {
  const credential = makeCredential();

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async () => credential,
    updateCredentialLastUsedAtImpl: async () => {},
    writeAuditLogImpl: async () => {},
  });
  setApiTaskQueryTestHooks({
    getOwnedTaskImpl: async () => ({
      id: "task_api_recovered",
      creatorUserId: 7,
      apiCredentialId: credential.id,
      presetSnapshot: { status: "matched" },
      status: "processing",
    }),
    getTaskDetailForUserImpl: async () =>
      makeTaskDetail({
        id: "task_api_recovered",
        status: "processing",
        failureContext: {
          stage: "字幕生成",
          message: "旧失败",
          reasonCode: "worker_timeout",
          diagnosticTraceId: "trace_old",
          retryable: true,
          recommendedAction: "创建新的恢复 attempt。",
          supportCategory: null,
        },
      }),
    writeAuditLogImpl: async () => {},
  });

  const request = new Request("http://localhost/tasks/task_api_recovered", {
    headers: {
      authorization: `Bearer ${credential.id}.${credential.rawSecret}`,
      "x-request-id": "req_api_recovered",
    },
  });

  const response = await runLoader(statusLoader, request, {
    taskId: "task_api_recovered",
  });

  assert.equal(response.init?.status, 200);
  assert.equal(response.data.data.status, "processing");
  assert.equal(response.data.data.failure, null);
});

test("GET /tasks/:taskId/result returns ready deliverables with controlled download links", async () => {
  const credential = makeCredential();

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async () => credential,
    updateCredentialLastUsedAtImpl: async () => {},
    writeAuditLogImpl: async () => {},
  });
  setApiTaskQueryTestHooks({
    getOwnedTaskImpl: async () => ({
      id: "task_api_1",
      creatorUserId: 7,
      apiCredentialId: credential.id,
      presetSnapshot: { status: "matched" },
      status: "completed",
    }),
    getTaskDetailForUserImpl: async () =>
      makeTaskDetail({
        status: "completed",
        statusLabel: "已完成",
        deliverables: [
          {
            id: "deliverable_1",
            taskId: "task_api_1",
            kind: "video",
            kindLabel: "成品视频",
            fileName: "final.mp4",
            mimeType: "video/mp4",
            fileSizeLabel: "1 MB",
            status: "ready",
            statusLabel: "可下载",
            canDownload: true,
            availableAt: "2026-06-08T10:00:00.000Z",
            expiresAt: "2026-06-15T10:00:00.000Z",
            downloadAction: "/workspace/deliverables/deliverable_1",
          },
        ],
      }),
    writeAuditLogImpl: async () => {},
  });

  const request = new Request("http://localhost/tasks/task_api_1/result", {
    headers: {
      authorization: `Bearer ${credential.id}.${credential.rawSecret}`,
      "x-request-id": "req_api_result",
    },
  });

  const response = await runLoader(resultLoader, request, {
    taskId: "task_api_1",
  });

  assert.equal(response.init?.status, 200);
  assert.equal(response.data.data.result.state, "ready");
  assert.equal(response.data.data.result.deliverables[0]?.download?.method, "GET");
  assert.equal(
    response.data.data.result.deliverables[0]?.download?.href,
    "/tasks/task_api_1/result/deliverables/deliverable_1/download",
  );
});

test("GET /tasks/:taskId/result returns an expired result state without exposing a live download link", async () => {
  const credential = makeCredential();

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async () => credential,
    updateCredentialLastUsedAtImpl: async () => {},
    writeAuditLogImpl: async () => {},
  });
  setApiTaskQueryTestHooks({
    getOwnedTaskImpl: async () => ({
      id: "task_api_expired",
      creatorUserId: 7,
      apiCredentialId: credential.id,
      presetSnapshot: { status: "matched" },
      status: "completed",
    }),
    getTaskDetailForUserImpl: async () =>
      makeTaskDetail({
        id: "task_api_expired",
        status: "completed",
        statusLabel: "已完成",
        deliverables: [
          {
            id: "deliverable_expired",
            taskId: "task_api_expired",
            kind: "subtitle",
            kindLabel: "字幕文件",
            fileName: "final.srt",
            mimeType: "text/plain",
            fileSizeLabel: "8 KB",
            status: "expired",
            statusLabel: "已过期",
            canDownload: false,
            availableAt: "2026-06-01T10:00:00.000Z",
            expiresAt: "2026-06-02T10:00:00.000Z",
            downloadAction: null,
          },
        ],
      }),
    writeAuditLogImpl: async () => {},
  });

  const request = new Request("http://localhost/tasks/task_api_expired/result", {
    headers: {
      authorization: `Bearer ${credential.id}.${credential.rawSecret}`,
      "x-request-id": "req_api_result_expired",
    },
  });

  const response = await runLoader(resultLoader, request, {
    taskId: "task_api_expired",
  });

  assert.equal(response.init?.status, 200);
  assert.equal(response.data.data.status, "completed");
  assert.equal(response.data.data.result.state, "expired");
  assert.equal(response.data.data.result.deliverables[0]?.download, null);
});

test("GET /tasks/:taskId/result returns a failed result state for terminal task failures", async () => {
  const credential = makeCredential();

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async () => credential,
    updateCredentialLastUsedAtImpl: async () => {},
    writeAuditLogImpl: async () => {},
  });
  setApiTaskQueryTestHooks({
    getOwnedTaskImpl: async () => ({
      id: "task_api_failed",
      creatorUserId: 7,
      apiCredentialId: credential.id,
      presetSnapshot: { status: "matched" },
      status: "failed",
    }),
    getTaskDetailForUserImpl: async () =>
      makeTaskDetail({
        id: "task_api_failed",
        status: "failed",
        statusLabel: "处理失败",
        failureContext: {
          stage: "字幕生成",
          message: "处理节点超时。",
          reasonCode: "worker_timeout",
          diagnosticTraceId: "trace_failure_1",
          retryable: true,
          recommendedAction: "创建新的恢复 attempt。",
          supportCategory: null,
        },
      }),
    writeAuditLogImpl: async () => {},
  });

  const request = new Request("http://localhost/tasks/task_api_failed/result", {
    headers: {
      authorization: `Bearer ${credential.id}.${credential.rawSecret}`,
      "x-request-id": "req_api_result_failed",
    },
  });

  const response = await runLoader(resultLoader, request, {
    taskId: "task_api_failed",
  });

  assert.equal(response.init?.status, 200);
  assert.equal(response.data.data.status, "failed");
  assert.equal(response.data.data.result.state, "failed");
  assert.equal(response.data.data.failure.reasonCode, "worker_timeout");
  assert.equal(response.data.data.failure.stage, "subtitle_generation");
  assert.equal(
    response.data.data.failure.recommendedAction,
    "retry_with_new_attempt",
  );
  assert.deepEqual(response.data.data.result.deliverables, []);
});

test("GET /tasks/:taskId/result returns fallback failure semantics for cancelled tasks", async () => {
  const credential = makeCredential();

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async () => credential,
    updateCredentialLastUsedAtImpl: async () => {},
    writeAuditLogImpl: async () => {},
  });
  setApiTaskQueryTestHooks({
    getOwnedTaskImpl: async () => ({
      id: "task_api_cancelled",
      creatorUserId: 7,
      apiCredentialId: credential.id,
      presetSnapshot: { status: "matched" },
      status: "cancelled",
    }),
    getTaskDetailForUserImpl: async () =>
      makeTaskDetail({
        id: "task_api_cancelled",
        status: "cancelled",
        statusLabel: "已取消",
        failureContext: null,
      }),
    writeAuditLogImpl: async () => {},
  });

  const request = new Request("http://localhost/tasks/task_api_cancelled/result", {
    headers: {
      authorization: `Bearer ${credential.id}.${credential.rawSecret}`,
      "x-request-id": "req_api_result_cancelled",
    },
  });

  const response = await runLoader(resultLoader, request, {
    taskId: "task_api_cancelled",
  });

  assert.equal(response.init?.status, 200);
  assert.equal(response.data.data.status, "cancelled");
  assert.equal(response.data.data.result.state, "failed");
  assert.equal(response.data.data.failure.reasonCode, "task_cancelled");
  assert.equal(response.data.data.failure.stage, "processing");
  assert.equal(response.data.data.failure.retryable, false);
  assert.equal(
    response.data.data.failure.recommendedAction,
    "create_new_task",
  );
});

test("GET /tasks/:taskId/result/deliverables/:deliverableId/download streams a ready deliverable", async () => {
  const credential = makeCredential();

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async () => credential,
    updateCredentialLastUsedAtImpl: async () => {},
    writeAuditLogImpl: async () => {},
  });
  setApiTaskQueryTestHooks({
    getOwnedTaskImpl: async () => ({
      id: "task_api_1",
      creatorUserId: 7,
      apiCredentialId: credential.id,
      presetSnapshot: { status: "matched" },
      status: "completed",
    }),
    getDeliverableByTaskImpl: async () => ({
      id: "deliverable_1",
      taskId: "task_api_1",
      kind: "video",
      fileName: 'final"\r\nInjected: true.mp4',
      storageKey: "deliverables/task_api_1/final.mp4",
      mimeType: "video/mp4",
      status: "ready",
      availableAt: new Date("2026-06-08T10:00:00.000Z"),
      expiresAt: new Date("2026-06-15T10:00:00.000Z"),
    }),
    readFileImpl: async () => new Uint8Array([1, 2, 3]),
    writeAuditLogImpl: async () => {},
  });

  const request = new Request(
    "http://localhost/tasks/task_api_1/result/deliverables/deliverable_1/download",
    {
      headers: {
        authorization: `Bearer ${credential.id}.${credential.rawSecret}`,
        "x-request-id": "req_api_download",
      },
    },
  );

  const response = await runLoader(downloadLoader, request, {
    taskId: "task_api_1",
    deliverableId: "deliverable_1",
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "video/mp4");
  assert.match(
    response.headers.get("Content-Disposition") ?? "",
    /attachment; filename="final___Injected: true\.mp4"/,
  );
});

test("GET /tasks/:taskId/result/deliverables/:deliverableId/download returns DELIVERABLE_EXPIRED for expired files", async () => {
  const credential = makeCredential();

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async () => credential,
    updateCredentialLastUsedAtImpl: async () => {},
    writeAuditLogImpl: async () => {},
  });
  setApiTaskQueryTestHooks({
    getOwnedTaskImpl: async () => ({
      id: "task_api_1",
      creatorUserId: 7,
      apiCredentialId: credential.id,
      presetSnapshot: { status: "matched" },
      status: "completed",
    }),
    getDeliverableByTaskImpl: async () => ({
      id: "deliverable_expired",
      taskId: "task_api_1",
      kind: "video",
      fileName: "final.mp4",
      storageKey: "deliverables/task_api_1/final.mp4",
      mimeType: "video/mp4",
      status: "ready",
      availableAt: new Date("2026-06-01T10:00:00.000Z"),
      expiresAt: new Date("2026-06-02T10:00:00.000Z"),
    }),
    writeAuditLogImpl: async () => {},
  });

  const request = new Request(
    "http://localhost/tasks/task_api_1/result/deliverables/deliverable_expired/download",
    {
      headers: {
        authorization: `Bearer ${credential.id}.${credential.rawSecret}`,
        "x-request-id": "req_api_download_expired",
      },
    },
  );

  await assert.rejects(
    runLoader(downloadLoader, request, {
      taskId: "task_api_1",
      deliverableId: "deliverable_expired",
    }),
    (error) => {
      assert.equal(error.constructor?.name, "DataWithResponseInit");
      assert.equal(error.init?.status, 410);
      assert.equal(error.data.error.code, "DELIVERABLE_EXPIRED");
      return true;
    },
  );
});

test("GET /tasks/:taskId/result/deliverables/:deliverableId/download returns a public API 500 envelope when the file read fails", async () => {
  const credential = makeCredential();

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async () => credential,
    updateCredentialLastUsedAtImpl: async () => {},
    writeAuditLogImpl: async () => {},
  });
  setApiTaskQueryTestHooks({
    getOwnedTaskImpl: async () => ({
      id: "task_api_1",
      creatorUserId: 7,
      apiCredentialId: credential.id,
      presetSnapshot: { status: "matched" },
      status: "completed",
    }),
    getDeliverableByTaskImpl: async () => ({
      id: "deliverable_1",
      taskId: "task_api_1",
      kind: "video",
      fileName: "final.mp4",
      storageKey: "deliverables/task_api_1/final.mp4",
      mimeType: "video/mp4",
      status: "ready",
      availableAt: new Date("2026-06-08T10:00:00.000Z"),
      expiresAt: new Date("2026-06-15T10:00:00.000Z"),
    }),
    readFileImpl: async () => {
      throw new Error("ENOENT");
    },
    writeAuditLogImpl: async () => {},
  });

  const request = new Request(
    "http://localhost/tasks/task_api_1/result/deliverables/deliverable_1/download",
    {
      headers: {
        authorization: `Bearer ${credential.id}.${credential.rawSecret}`,
        "x-request-id": "req_api_download_read_failed",
      },
    },
  );

  await assert.rejects(
    runLoader(downloadLoader, request, {
      taskId: "task_api_1",
      deliverableId: "deliverable_1",
    }),
    (error) => {
      assert.equal(error.constructor?.name, "DataWithResponseInit");
      assert.equal(error.init?.status, 500);
      assert.equal(error.data.error.code, "DELIVERABLE_DOWNLOAD_FAILED");
      assert.equal(error.data.request_id, "req_api_download_read_failed");
      return true;
    },
  );
});

test("GET /tasks/:taskId rejects foreign tasks with TASK_FORBIDDEN", async () => {
  const credential = makeCredential();

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async () => credential,
    updateCredentialLastUsedAtImpl: async () => {},
    writeAuditLogImpl: async () => {},
  });
  setApiTaskQueryTestHooks({
    getOwnedTaskImpl: async () => null,
    getTaskByIdImpl: async () => ({
      id: "task_foreign",
      creatorUserId: 9,
      apiCredentialId: "cred_other",
      presetSnapshot: { status: "matched" },
      status: "processing",
    }),
    writeAuditLogImpl: async () => {},
  });

  const request = new Request("http://localhost/tasks/task_foreign", {
    headers: {
      authorization: `Bearer ${credential.id}.${credential.rawSecret}`,
      "x-request-id": "req_api_forbidden",
    },
  });

  await assert.rejects(
    runLoader(statusLoader, request, { taskId: "task_foreign" }),
    (error) => {
      assert.equal(error.constructor?.name, "DataWithResponseInit");
      assert.equal(error.init?.status, 403);
      assert.equal(error.data.error.code, "TASK_FORBIDDEN");
      return true;
    },
  );
});

test("GET /tasks/:taskId/result returns TASK_NOT_FOUND when the task does not exist", async () => {
  const credential = makeCredential();

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async () => credential,
    updateCredentialLastUsedAtImpl: async () => {},
    writeAuditLogImpl: async () => {},
  });
  setApiTaskQueryTestHooks({
    getOwnedTaskImpl: async () => null,
    getTaskByIdImpl: async () => null,
    writeAuditLogImpl: async () => {},
  });

  const request = new Request("http://localhost/tasks/task_missing/result", {
    headers: {
      authorization: `Bearer ${credential.id}.${credential.rawSecret}`,
      "x-request-id": "req_api_result_missing",
    },
  });

  await assert.rejects(
    runLoader(resultLoader, request, { taskId: "task_missing" }),
    (error) => {
      assert.equal(error.constructor?.name, "DataWithResponseInit");
      assert.equal(error.init?.status, 404);
      assert.equal(error.data.error.code, "TASK_NOT_FOUND");
      return true;
    },
  );
});

test("GET /tasks/:taskId returns 401 when the API credential is missing", async () => {
  setApiCredentialTestHooks({
    writeAuditLogImpl: async () => {},
  });

  const request = new Request("http://localhost/tasks/task_api_1", {
    headers: {
      "x-request-id": "req_api_missing_status",
    },
  });

  await assert.rejects(
    runLoader(statusLoader, request, { taskId: "task_api_1" }),
    (error) => {
      assert.equal(error.constructor?.name, "DataWithResponseInit");
      assert.equal(error.init?.status, 401);
      assert.equal(error.data.error.code, "API_CREDENTIAL_MISSING");
      return true;
    },
  );
});

test("GET /tasks/:taskId returns 401 when the API credential secret is invalid", async () => {
  const credential = makeCredential();

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async () => credential,
    writeAuditLogImpl: async () => {},
  });

  const request = new Request("http://localhost/tasks/task_api_1", {
    headers: {
      authorization: `Bearer ${credential.id}.wrong-secret`,
      "x-request-id": "req_api_invalid_status",
    },
  });

  await assert.rejects(
    runLoader(statusLoader, request, { taskId: "task_api_1" }),
    (error) => {
      assert.equal(error.constructor?.name, "DataWithResponseInit");
      assert.equal(error.init?.status, 401);
      assert.equal(error.data.error.code, "API_CREDENTIAL_INVALID");
      return true;
    },
  );
});

test("GET /tasks/:taskId/result returns 403 when the API credential is expired", async () => {
  const credential = makeCredential({
    expiresAt: new Date("2026-06-01T10:00:00.000Z"),
  });

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async () => credential,
    writeAuditLogImpl: async () => {},
  });

  const request = new Request("http://localhost/tasks/task_api_1/result", {
    headers: {
      authorization: `Bearer ${credential.id}.${credential.rawSecret}`,
      "x-request-id": "req_api_result_expired_credential",
      cookie: "yakimoji_session=fake-session",
    },
  });

  await assert.rejects(
    runLoader(resultLoader, request, { taskId: "task_api_1" }),
    (error) => {
      assert.equal(error.constructor?.name, "DataWithResponseInit");
      assert.equal(error.init?.status, 403);
      assert.equal(error.data.error.code, "API_CREDENTIAL_EXPIRED");
      return true;
    },
  );
});
