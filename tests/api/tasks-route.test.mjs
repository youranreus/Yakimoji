import test from "node:test";
import assert from "node:assert/strict";

import { action } from "../../app/routes/api.tasks.ts";
import {
  hashApiCredentialSecret,
  setApiCredentialTestHooks,
} from "../../app/features/api-credentials/server/api-credential-auth.server";
import { setApiTaskCreateTestHooks } from "../../app/features/tasks/server/api-task-create.server";
import { setChannelPresetTestHooks } from "../../app/features/presets/server/channel-presets.server";
import { createRequestContext, runWithRequestContext } from "../../app/features/auth/server/request-context.server";
import { DatabaseContext } from "../../database/context";

const tableNameSymbol = Symbol.for("drizzle:Name");
const originalEnv = { ...process.env };

function createFakeDb() {
  const taskRows = [];
  const taskEventRows = [];

  const db = {
    async transaction(callback) {
      return callback(db);
    },
    insert(table) {
      return {
        async values(values) {
          const tableName = table[tableNameSymbol] ?? "unknown";

          if (tableName === "tasks") {
            taskRows.push({ ...values });
            return;
          }

          if (tableName === "task_events") {
            taskEventRows.push({ ...values });
          }
        },
      };
    },
    update(table) {
      return {
        set(values) {
          return {
            where() {
              const tableName = table[tableNameSymbol] ?? "unknown";

              return {
                async returning() {
                  if (tableName !== "tasks") {
                    return [];
                  }

                  const existing = taskRows.at(-1);

                  if (!existing) {
                    return [];
                  }

                  Object.assign(existing, values);
                  return [existing];
                },
              };
            },
          };
        },
      };
    },
  };

  return {
    db,
    taskRows,
    taskEventRows,
  };
}

function makeCredential(overrides = {}) {
  const now = new Date("2026-06-08T10:00:00.000Z");
  const id = "cred_live";
  const secret = "secret-token";

  return {
    id,
    ownerUserId: 7,
    label: "Yakimoji Integration",
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

function makePresetRow() {
  const now = new Date("2026-06-08T10:00:00.000Z");

  return {
    id: "preset_1",
    ownerUserId: 7,
    sourceIdentifier: "youtube:KurzgesagtCN",
    displayName: "Kurzgesagt 中文频道",
    translationMode: "英译中字幕",
    subtitleTemplate: "科普模板",
    outputPackage: "mp4 + srt",
    notes: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

async function runApiAction(request, db) {
  return runWithRequestContext(
    createRequestContext(Object.fromEntries(request.headers.entries())),
    async () => {
      if (db) {
        return DatabaseContext.run(db, async () => action({ request }));
      }

      return action({ request });
    },
  );
}

test.before(() => {
  process.env.API_CREDENTIAL_PEPPER = "pepper-for-tests";
});

test.beforeEach(() => {
  setApiCredentialTestHooks({});
  setApiTaskCreateTestHooks({});
  setChannelPresetTestHooks({});
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

test("POST /tasks creates a task with a valid API credential and matched preset", async () => {
  const fake = createFakeDb();
  const credential = makeCredential();
  const auditCalls = [];
  let updatedCredentialAt = null;

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async (id) => (id === credential.id ? credential : null),
    updateCredentialLastUsedAtImpl: async (_id, usedAt) => {
      updatedCredentialAt = usedAt;
    },
    writeAuditLogImpl: async (payload) => {
      auditCalls.push(payload);
    },
  });
  setApiTaskCreateTestHooks({
    writeAuditLogImpl: async (payload) => {
      auditCalls.push(payload);
    },
  });
  setChannelPresetTestHooks({
    findRowBySourceImpl: async () => makePresetRow(),
  });

  const request = new Request("http://localhost/tasks", {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential.id}.${credential.rawSecret}`,
      "content-type": "application/json",
      "x-request-id": "req_api_create",
    },
    body: JSON.stringify({
      sourceType: "youtube_link",
      sourceUrl: "https://www.youtube.com/watch?v=abc123&ab_channel=KurzgesagtCN",
      metadata: {
        upstreamJobId: "job_123",
      },
    }),
  });

  const response = await runApiAction(request, fake.db);
  const payload = response.data;

  assert.equal(response.init?.status, 201);
  assert.equal(payload.data.status, "created");
  assert.equal(payload.data.createdBy.credentialId, "cred_live");
  assert.equal(payload.meta.requestId, "req_api_create");
  assert.equal(fake.taskRows.length, 1);
  assert.equal(fake.taskEventRows.length, 1);
  assert.equal(fake.taskRows[0]?.creatorUserId, 7);
  assert.equal(fake.taskRows[0]?.apiCredentialId, "cred_live");
  assert.equal(fake.taskRows[0]?.status, "created");
  assert.equal(fake.taskRows[0]?.sourceSnapshot.createdBy.type, "apiCredential");
  assert.equal(fake.taskRows[0]?.sourceSnapshot.apiRequestMetadata.upstreamJobId, "job_123");
  assert.ok(updatedCredentialAt instanceof Date);
  assert.equal(auditCalls.length, 2);
  assert.equal(auditCalls[0]?.eventType, "api_credential.authenticated");
  assert.equal(auditCalls[1]?.eventType, "task.api_created");
});

test("POST /tasks returns awaiting_preset_decision when no preset matches", async () => {
  const fake = createFakeDb();
  const credential = makeCredential();

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async () => credential,
    updateCredentialLastUsedAtImpl: async () => {},
    writeAuditLogImpl: async () => {},
  });
  setApiTaskCreateTestHooks({
    writeAuditLogImpl: async () => {},
  });
  setChannelPresetTestHooks({
    findRowBySourceImpl: async () => null,
  });

  const request = new Request("http://localhost/tasks", {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential.id}.${credential.rawSecret}`,
      "content-type": "application/json",
      "x-request-id": "req_api_unresolved",
    },
    body: JSON.stringify({
      sourceType: "youtube_link",
      sourceUrl: "https://www.youtube.com/watch?v=abc123&ab_channel=KurzgesagtCN",
    }),
  });

  const response = await runApiAction(request, fake.db);
  const payload = response.data;

  assert.equal(response.init?.status, 201);
  assert.equal(payload.data.status, "awaiting_preset_decision");
  assert.equal(fake.taskRows.length, 1);
  assert.equal(fake.taskRows[0]?.status, "awaiting_preset_decision");
  assert.equal(fake.taskEventRows.length, 2);
  assert.equal(fake.taskEventRows[1]?.eventType, "task.preset_decision_requested");
});

test("POST /tasks rejects requests without an API credential even if cookies are present", async () => {
  setApiCredentialTestHooks({
    writeAuditLogImpl: async () => {},
  });

  const request = new Request("http://localhost/tasks", {
    method: "POST",
    headers: {
      cookie: "__Host-yakimoji_session=session_cookie",
      "content-type": "application/json",
      "x-request-id": "req_api_missing_credential",
    },
    body: JSON.stringify({
      sourceType: "youtube_link",
      sourceUrl: "https://www.youtube.com/watch?v=abc123&ab_channel=KurzgesagtCN",
    }),
  });

  await assert.rejects(
    runApiAction(request),
    (error) => {
      assert.equal(error.constructor?.name, "DataWithResponseInit");
      assert.equal(error.init?.status, 401);
      assert.equal(error.data.error.code, "API_CREDENTIAL_MISSING");
      assert.equal(error.data.request_id, "req_api_missing_credential");
      assert.equal("data" in error.data, false);
      return true;
    },
  );
});

test("POST /tasks rejects expired API credentials with 403", async () => {
  const credential = makeCredential({
    expiresAt: new Date("2026-06-08T09:00:00.000Z"),
  });

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async () => credential,
    writeAuditLogImpl: async () => {},
  });

  const request = new Request("http://localhost/tasks", {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential.id}.${credential.rawSecret}`,
      "content-type": "application/json",
      "x-request-id": "req_api_expired",
    },
    body: JSON.stringify({
      sourceType: "youtube_link",
      sourceUrl: "https://www.youtube.com/watch?v=abc123&ab_channel=KurzgesagtCN",
    }),
  });

  await assert.rejects(
    runApiAction(request),
    (error) => {
      assert.equal(error.constructor?.name, "DataWithResponseInit");
      assert.equal(error.init?.status, 403);
      assert.equal(error.data.error.code, "API_CREDENTIAL_EXPIRED");
      assert.equal("data" in error.data, false);
      return true;
    },
  );
});

test("POST /tasks returns TASK_REQUEST_INVALID with field details for invalid request bodies", async () => {
  const fake = createFakeDb();
  const credential = makeCredential();

  setApiCredentialTestHooks({
    getCredentialByIdImpl: async () => credential,
    updateCredentialLastUsedAtImpl: async () => {},
    writeAuditLogImpl: async () => {},
  });
  setApiTaskCreateTestHooks({
    writeAuditLogImpl: async () => {},
  });

  const request = new Request("http://localhost/tasks", {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential.id}.${credential.rawSecret}`,
      "content-type": "application/json",
      "x-request-id": "req_api_invalid_body",
    },
    body: JSON.stringify({
      sourceType: "youtube_link",
      sourceUrl: "",
    }),
  });

  await assert.rejects(
    runApiAction(request, fake.db),
    (error) => {
      assert.equal(error.constructor?.name, "DataWithResponseInit");
      assert.equal(error.init?.status, 422);
      assert.equal(error.data.error.code, "TASK_REQUEST_INVALID");
      assert.equal(typeof error.data.error.details.fieldErrors.sourceUrl, "string");
      assert.equal("data" in error.data, false);
      return true;
    },
  );
});
