import assert from "node:assert/strict";
import test from "node:test";

import { FileUpload, MaxFileSizeExceededError } from "@remix-run/form-data-parser";

import {
  __resetTaskIntakeDraftsForTests,
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

test.beforeEach(() => {
  __resetTaskIntakeDraftsForTests();
  setTaskIntakeTestHooks({});
});

test("valid YouTube link creates a preview context with baseline summary inputs", async () => {
  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_preview_youtube",
    }),
    async () => {
      const response = await handleTaskIntakeAction(
        7,
        makeUrlEncodedRequest({
          intent: "preview",
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
    },
  );
});

test("invalid YouTube link returns a structured inline error with request_id", async () => {
  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_bad_link",
    }),
    async () => {
      await assert.rejects(
        handleTaskIntakeAction(
          7,
          makeUrlEncodedRequest({
            intent: "preview",
            sourceUrl: "https://vimeo.com/123",
          }, "req_bad_link"),
        ),
        (error: any) => {
          assert.equal(error.constructor?.name, "DataWithResponseInit");
          assert.equal(error.data.code, "invalid_youtube_url");
          assert.equal(error.data.field, "sourceUrl");
          assert.equal(error.data.request_id, "req_bad_link");
          return true;
        },
      );
    },
  );
});

test("confirm creation persists a real task record with the shared initial status", async () => {
  const inserts: Array<Record<string, unknown>> = [];
  const selects: Array<Record<string, unknown>> = [];

  const fakeDb = {
    insert(table: any) {
      return {
        values(values: Record<string, unknown>) {
          inserts.push({
            table: table[Symbol.for("drizzle:Name")] ?? "unknown",
            values,
          });
          return Promise.resolve();
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
                    limit: async () => {
                      selects.push(selection);
                      return [
                        {
                          id: "task_recent_1",
                          status: "created",
                          intakeMethod: "youtube_link",
                          sourceIdentifier: "youtube:KurzgesagtCN",
                          sourceSnapshot: { title: "Kurzgesagt CN" },
                          processingBaselineSnapshot: {
                            translationMode: "中译中字幕",
                            subtitleTemplate: "标准 Shorts 模板",
                            outputPackage: "mp4 + srt",
                          },
                          createdAt: new Date("2026-05-25T08:00:00.000Z"),
                        },
                      ];
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_confirm_task",
    }),
    async () => {
      await DatabaseContext.run(fakeDb as never, async () => {
        const preview = await handleTaskIntakeAction(
          42,
          makeUrlEncodedRequest({
            intent: "preview",
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
        assert.equal(inserts.length, 1);
        assert.equal(inserts[0]?.table, "tasks");
        assert.equal(inserts[0]?.values.status, "created");
        assert.equal(inserts[0]?.values.creatorUserId, 42);
        assert.equal(inserts[0]?.values.sourceIdentifier, "youtube:KurzgesagtCN");

        const recent = await listRecentTasksForUser(42);
        assert.equal(recent.length, 1);
        assert.equal(recent[0]?.id, "task_recent_1");
        assert.match(recent[0]?.baselineSummary ?? "", /标准 Shorts 模板/);
      });
    },
  );

  assert.equal(selects.length, 1);
});

test("upload parser failures preserve request_id in structured errors", async () => {
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
      const request = new Request("http://localhost:3000/workspace", {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=test",
          "x-request-id": "req_upload_fail",
        },
      });

      await assert.rejects(
        handleTaskIntakeAction(7, request),
        (error: any) => {
          assert.equal(error.constructor?.name, "DataWithResponseInit");
          assert.equal(error.data.code, "invalid_upload");
          assert.equal(error.data.request_id, "req_upload_fail");
          return true;
        },
      );
    },
  );
});

test("upload preview validates media type and can produce a retryable recognition failure", async () => {
  const mockFile = new File(["fake"], "notes.txt", { type: "text/plain" }) as FileUpload;

  Object.defineProperty(mockFile, "fieldName", {
    value: "videoFile",
  });

  setTaskIntakeTestHooks({
    parseFormDataImpl: async (_request, _options, uploadHandler) => {
      const formData = new FormData();

      if (uploadHandler) {
        const stored = await uploadHandler(mockFile);

        if (stored != null) {
          formData.set("videoFile", stored);
        }
      }

      return formData;
    },
  });

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_upload_type",
    }),
    async () => {
      const request = new Request("http://localhost:3000/workspace", {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=test",
          "x-request-id": "req_upload_type",
        },
      });

      await assert.rejects(
        handleTaskIntakeAction(7, request),
        (error: any) => {
          assert.equal(error.data.code, "unsupported_media_type");
          assert.equal(error.data.request_id, "req_upload_type");
          return true;
        },
      );
    },
  );
});
