import assert from "node:assert/strict";
import test from "node:test";

import {
  getDeliverableAccess,
  setDeliverableQueryTestHooks,
  listDeliverablesForTaskDetail,
} from "../app/features/deliverables/server/deliverable-query.server";
import {
  authorizeDeliverableDownload,
  sanitizeDownloadFilename,
  setDeliverableAccessTestHooks,
  streamDeliverableDownload,
} from "../app/features/deliverables/server/deliverable-access.server";
import { createRequestContext, runWithRequestContext } from "../app/features/auth/server/request-context.server";

function makeDeliverable(overrides: Record<string, unknown> = {}) {
  return {
    id: "deliverable_1",
    taskId: "task_1",
    kind: "video",
    fileName: "final.mp4",
    storageKey: "deliverables/task_1/final.mp4",
    mimeType: "video/mp4",
    fileSizeBytes: 1024 * 1024,
    status: "ready",
    availableAt: new Date("2026-05-26T01:00:00.000Z"),
    expiresAt: new Date("2026-05-27T01:00:00.000Z"),
    metadata: {},
    createdAt: new Date("2026-05-26T01:00:00.000Z"),
    updatedAt: new Date("2026-05-26T01:00:00.000Z"),
    ...overrides,
  };
}

function makeDownloadAccess(overrides: Record<string, unknown> = {}) {
  return {
    ok: true as const,
    mode: "stream" as const,
    taskId: "task_1",
    storageKey: "deliverables/task_1/final.mp4",
    deliverable: {
      id: "deliverable_1",
      taskId: "task_1",
      kind: "video",
      kindLabel: "成品视频",
      fileName: "final.mp4",
      mimeType: "video/mp4",
      fileSizeLabel: "1 MB",
      status: "ready",
      statusLabel: "可下载",
      canDownload: true,
      availableAt: new Date("2026-05-26T01:00:00.000Z").toISOString(),
      expiresAt: new Date("2026-05-27T01:00:00.000Z").toISOString(),
      downloadAction: "/workspace/deliverables/deliverable_1",
    },
    fileName: "final.mp4",
    mimeType: "video/mp4",
    ...overrides,
  };
}

test.beforeEach(() => {
  setDeliverableQueryTestHooks({});
  setDeliverableAccessTestHooks({});
});

test("task detail deliverable read model exposes ready result status and downloadable files", async () => {
  setDeliverableQueryTestHooks({
    getTaskRowForUserImpl: async () => ({ id: "task_1", creatorUserId: 7 }),
    getTaskRowByIdImpl: async () => ({ id: "task_1", creatorUserId: 7 }),
    listDeliverablesForTaskImpl: async () => [makeDeliverable()],
  });

  const deliverables = await runWithRequestContext(
    createRequestContext({ "x-request-id": "req_deliverables_ready" }),
    async () => listDeliverablesForTaskDetail(7, "task_1"),
  );

  assert.equal(deliverables.length, 1);
  assert.equal(deliverables[0]?.kindLabel, "成品视频");
  assert.equal(deliverables[0]?.statusLabel, "可下载");
  assert.equal(deliverables[0]?.canDownload, true);
  assert.equal(deliverables[0]?.downloadAction, "/workspace/deliverables/deliverable_1");
});

test("deliverable access rejects expired files with a terminal response", async () => {
  setDeliverableQueryTestHooks({
    getDeliverableRowForUserImpl: async () =>
      makeDeliverable({
        status: "expired",
        expiresAt: new Date("2026-05-25T01:00:00.000Z"),
      }),
  });

  const outcome = await getDeliverableAccess(7, "deliverable_1");

  assert.equal(outcome.ok, false);
  assert.equal(outcome.status, 410);
  assert.equal(outcome.code, "deliverable_expired");
});

test("task detail maps time-expired ready deliverables to expired status", async () => {
  setDeliverableQueryTestHooks({
    getTaskRowForUserImpl: async () => ({ id: "task_1", creatorUserId: 7 }),
    getTaskRowByIdImpl: async () => ({ id: "task_1", creatorUserId: 7 }),
    listDeliverablesForTaskImpl: async () =>
      [
        makeDeliverable({
          status: "ready",
          expiresAt: new Date("2026-05-25T01:00:00.000Z"),
        }),
      ],
  });

  const deliverables = await runWithRequestContext(
    createRequestContext({ "x-request-id": "req_deliverables_expired" }),
    async () => listDeliverablesForTaskDetail(7, "task_1"),
  );

  assert.equal(deliverables[0]?.status, "expired");
  assert.equal(deliverables[0]?.statusLabel, "已过期");
  assert.equal(deliverables[0]?.canDownload, false);
});

test("streamed deliverable download reads from storageKey and records task-linked success audit", async () => {
  const auditCalls: Array<Record<string, unknown>> = [];
  const readPaths: string[] = [];

  setDeliverableAccessTestHooks({
    getDeliverableAccessImpl: async () => makeDownloadAccess(),
    writeAuditLogImpl: async (payload) => {
      auditCalls.push(payload);
    },
    readFileImpl: async (filePath) => {
      readPaths.push(String(filePath));
      return new Uint8Array([1, 2, 3]);
    },
  });

  const download = await runWithRequestContext(
    createRequestContext({ "x-request-id": "req_download_ok" }),
    async () =>
      streamDeliverableDownload({
        userId: 7,
        deliverableId: "deliverable_1",
      }),
  );

  assert.deepEqual(Array.from(download.fileBuffer), [1, 2, 3]);
  assert.match(readPaths[0] ?? "", /\.local-share\/deliverables\/task_1\/final\.mp4$/);
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0]?.outcome, "success");
  assert.equal(auditCalls[0]?.detail?.taskId, "task_1");
});

test("download authorization audits denied access with task id when available", async () => {
  const auditCalls: Array<Record<string, unknown>> = [];

  setDeliverableAccessTestHooks({
    getDeliverableAccessImpl: async () => ({
      ok: false,
      status: 403,
      code: "deliverable_forbidden",
      message: "当前账号无权访问该交付物。",
      taskId: "task_9",
    }),
    writeAuditLogImpl: async (payload) => {
      auditCalls.push(payload);
    },
  });

  await assert.rejects(
    runWithRequestContext(
      createRequestContext({ "x-request-id": "req_download_forbidden" }),
      async () =>
        authorizeDeliverableDownload({
          userId: 7,
          deliverableId: "deliverable_9",
        }),
    ),
  );

  assert.equal(auditCalls[0]?.detail?.taskId, "task_9");
  assert.equal(auditCalls[0]?.outcome, "deliverable_forbidden");
});

test("streamed deliverable download audits file read failures before returning a structured 500", async () => {
  const auditCalls: Array<Record<string, unknown>> = [];

  setDeliverableAccessTestHooks({
    getDeliverableAccessImpl: async () => makeDownloadAccess(),
    writeAuditLogImpl: async (payload) => {
      auditCalls.push(payload);
    },
    readFileImpl: async () => {
      throw new Error("missing file");
    },
  });

  await assert.rejects(
    runWithRequestContext(
      createRequestContext({ "x-request-id": "req_download_read_fail" }),
      async () =>
        streamDeliverableDownload({
          userId: 7,
          deliverableId: "deliverable_1",
        }),
    ),
    (error: any) => {
      assert.equal(error.constructor?.name, "DataWithResponseInit");
      assert.equal(error.data.code, "deliverable_download_failed");
      assert.equal(error.init.status, 500);
      assert.equal(error.data.request_id, "req_download_read_fail");
      return true;
    },
  );

  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0]?.outcome, "deliverable_read_failed");
  assert.equal(auditCalls[0]?.detail?.taskId, "task_1");
});

test("download filename sanitization strips header-breaking characters", () => {
  assert.equal(
    sanitizeDownloadFilename('final"\r\nInjected: true.mp4'),
    "final___Injected: true.mp4",
  );
});
