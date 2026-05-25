import assert from "node:assert/strict";
import test from "node:test";

import { FileUpload, MaxFileSizeExceededError } from "@remix-run/form-data-parser";

import {
  confirmTaskCreation,
  handleTaskIntakeAction,
  listRecentTasksForUser,
  setTaskIntakeTestHooks,
} from "../app/features/tasks/server/task-intake.server";
import { createRequestContext, runWithRequestContext } from "../app/features/auth/server/request-context.server";
import { DatabaseContext } from "../database/context";

function makeUrlEncodedRequest(body: Record<string, string>, requestId = "req_task_test") {
  return new Request("http://localhost:3000/workspace", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      "x-request-id": requestId,
    },
    body: new URLSearchParams(body),
  });
}

function createFakeDb() {
  const draftRows = new Map<string, Record<string, unknown>>();
  const taskRows: Array<Record<string, unknown>> = [];

  return {
    draftRows,
    taskRows,
    db: {
      insert(table: any) {
        return {
          async values(values: Record<string, unknown>) {
            const tableName = table[Symbol.for("drizzle:Name")] ?? "unknown";

            if (tableName === "task_intake_drafts") {
              draftRows.set(String(values.token), { ...values });
              return;
            }

            if (tableName === "tasks") {
              taskRows.push({ ...values });
            }
          },
        };
      },
      delete(table: any) {
        const tableName = table[Symbol.for("drizzle:Name")] ?? "unknown";

        return {
          where() {
            return {
              async returning(selection: Record<string, unknown>) {
                if (tableName === "task_intake_drafts") {
                  if ("uploadStorageKey" in selection && Object.keys(selection).length === 1) {
                    return [];
                  }

                  const [firstEntry] = draftRows.entries();

                  if (!firstEntry) {
                    return [];
                  }

                  draftRows.delete(firstEntry[0]);
                  return [firstEntry[1]];
                }

                return [];
              },
            };
          },
        };
      },
      select(selection: Record<string, unknown>) {
        return {
          from() {
            return {
              where() {
                return {
                  orderBy() {
                    return {
                      async limit() {
                        void selection;
                        return taskRows.map((row) => ({
                          id: row.id,
                          status: row.status,
                          intakeMethod: row.intakeMethod,
                          sourceIdentifier: row.sourceIdentifier,
                          sourceSnapshot: row.sourceSnapshot,
                          processingBaselineSnapshot: row.processingBaselineSnapshot,
                          createdAt: row.createdAt,
                        }));
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
  };
}

test.beforeEach(() => {
  setTaskIntakeTestHooks({});
});

test("valid YouTube link creates a preview context with baseline summary inputs", async () => {
  const fake = createFakeDb();

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_preview_youtube",
    }),
    async () => {
      await DatabaseContext.run(fake.db as never, async () => {
        const response = await handleTaskIntakeAction(
          7,
          makeUrlEncodedRequest({
            intent: "preview_youtube",
            sourceUrl: "https://www.youtube.com/watch?v=abc123&ab_channel=KurzgesagtCN",
          }, "req_preview_youtube"),
        );

        assert.equal(response.ok, true);
        assert.equal(response.mode, "preview");
        assert.equal(response.intakeMethod, "youtube_link");
        assert.equal(response.requestId, "req_preview_youtube");
        assert.equal(response.status, "resolving_source");
        assert.equal(response.source.identifier, "youtube:KurzgesagtCN");
        assert.match(response.baseline.translationMode, /中译中/);
        assert.ok(response.draftToken.startsWith("draft_"));
        assert.equal(fake.draftRows.size, 1);
      });
    },
  );
});

test("fake youtube-looking hosts are rejected", async () => {
  const fake = createFakeDb();

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_fake_host",
    }),
    async () => {
      await DatabaseContext.run(fake.db as never, async () => {
        await assert.rejects(
          handleTaskIntakeAction(
            7,
            makeUrlEncodedRequest({
              intent: "preview_youtube",
              sourceUrl: "https://notyoutube.com/watch?v=abc123",
            }, "req_fake_host"),
          ),
          (error: any) => {
            assert.equal(error.constructor?.name, "DataWithResponseInit");
            assert.equal(error.data.code, "invalid_youtube_url");
            return true;
          },
        );
      });
    },
  );
});

test("confirm creation persists a real task record and consumes the draft atomically", async () => {
  const fake = createFakeDb();

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_confirm_task",
    }),
    async () => {
      await DatabaseContext.run(fake.db as never, async () => {
        const preview = await handleTaskIntakeAction(
          42,
          makeUrlEncodedRequest({
            intent: "preview_youtube",
            sourceUrl: "https://www.youtube.com/watch?v=abc123&ab_channel=KurzgesagtCN",
          }, "req_confirm_task"),
        );

        assert.equal(preview.mode, "preview");

        const formData = new FormData();
        formData.set("intent", "confirm");
        formData.set("draftToken", preview.draftToken);

        const created = await confirmTaskCreation(42, formData);

        assert.equal(created.mode, "created");
        assert.equal(created.requestId, "req_confirm_task");
        assert.equal(created.task.status, "created");
        assert.equal(fake.taskRows.length, 1);
        assert.equal(fake.taskRows[0]?.creatorUserId, 42);
        assert.equal(fake.taskRows[0]?.sourceIdentifier, "youtube:KurzgesagtCN");
        assert.equal(fake.draftRows.size, 0);

        await assert.rejects(confirmTaskCreation(42, formData), (error: any) => {
          assert.equal(error.constructor?.name, "DataWithResponseInit");
          assert.equal(error.data.code, "confirmation_failed");
          return true;
        });

        const recent = await listRecentTasksForUser(42);
        assert.equal(recent.length, 1);
        assert.equal(recent[0]?.id, created.task.id);
      });
    },
  );
});

test("upload parser failures preserve request_id in structured inline errors", async () => {
  const fake = createFakeDb();

  setTaskIntakeTestHooks({
    parseFormDataImpl: async () => {
      throw new MaxFileSizeExceededError(10);
    },
  });

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_upload_fail",
    }),
    async () => {
      await DatabaseContext.run(fake.db as never, async () => {
        const request = new Request("http://localhost:3000/workspace", {
          method: "POST",
          headers: {
            "content-type": "multipart/form-data; boundary=test",
            "x-request-id": "req_upload_fail",
          },
        });

        await assert.rejects(handleTaskIntakeAction(7, request), (error: any) => {
          assert.equal(error.constructor?.name, "DataWithResponseInit");
          assert.equal(error.data.code, "invalid_upload");
          assert.equal(error.data.request_id, "req_upload_fail");
          return true;
        });
      });
    },
  );
});

test("upload preview returns a retryable inline error and cleans up temporary upload", async () => {
  const fake = createFakeDb();
  const deletedKeys: string[] = [];
  const mockFile = new File(["fake"], "clip.mp4", { type: "" }) as FileUpload;

  Object.defineProperty(mockFile, "fieldName", {
    value: "videoFile",
  });

  setTaskIntakeTestHooks({
    parseFormDataImpl: async (_request, _options, uploadHandler) => {
      const formData = new FormData();
      formData.set("intent", "preview_upload");

      if (uploadHandler) {
        const stored = await uploadHandler(mockFile);

        if (stored != null) {
          formData.set("videoFile", stored);
        }
      }

      return formData;
    },
    persistUploadedVideoImpl: async () => ({
      storageKey: "tasks/tmp-upload.mp4",
      originalFileName: "clip.mp4",
      contentType: "video/mp4",
      size: 4,
    }),
    deleteStoredUploadImpl: async (storageKey) => {
      deletedKeys.push(storageKey);
    },
  });

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_upload_retryable",
    }),
    async () => {
      await DatabaseContext.run(fake.db as never, async () => {
        const request = new Request("http://localhost:3000/workspace", {
          method: "POST",
          headers: {
            "content-type": "multipart/form-data; boundary=test",
            "x-request-id": "req_upload_retryable",
          },
        });

        const response = await handleTaskIntakeAction(7, request);

        assert.equal(response.ok, false);
        assert.equal(response.code, "source_recognition_failed");
        assert.equal(response.retryable, true);
        assert.equal(response.request_id, "req_upload_retryable");
      });
    },
  );

  assert.deepEqual(deletedKeys, ["tasks/tmp-upload.mp4"]);
});

test("upload requests without multipart encoding return an upload-specific inline error", async () => {
  const fake = createFakeDb();

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_missing_multipart",
    }),
    async () => {
      await DatabaseContext.run(fake.db as never, async () => {
        const response = await handleTaskIntakeAction(
          7,
          makeUrlEncodedRequest({
            intent: "preview_upload",
          }, "req_missing_multipart"),
        );

        assert.equal(response.ok, false);
        assert.equal(response.code, "invalid_upload");
        assert.equal(response.field, "videoFile");
        assert.equal(response.request_id, "req_missing_multipart");
      });
    },
  );
});
