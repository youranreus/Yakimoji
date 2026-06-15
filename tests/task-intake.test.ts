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
import { setChannelPresetTestHooks } from "../app/features/presets/server/channel-presets.server";
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
  const taskEventRows: Array<Record<string, unknown>> = [];

  function collectConditionValues(
    input: unknown,
    values: unknown[] = [],
    seen = new WeakSet<object>(),
  ) {
    if (input == null) {
      return values;
    }

    if (Array.isArray(input)) {
      input.forEach((entry) => collectConditionValues(entry, values, seen));
      return values;
    }

    if (typeof input !== "object") {
      values.push(input);
      return values;
    }

    if (seen.has(input)) {
      return values;
    }

    seen.add(input);

    for (const value of Object.values(input)) {
      collectConditionValues(value, values, seen);
    }

    return values;
  }

  function createOrderedResult<T>(rows: T[]) {
    return Object.assign([...rows], {
      async limit() {
        return rows;
      },
    });
  }

  function createWhereChain<T>(rows: T[]) {
    return {
      async limit() {
        return rows;
      },
      orderBy() {
        return createOrderedResult(rows);
      },
    };
  }

  const db = {
    async transaction<T>(callback: (tx: typeof db) => Promise<T>) {
      return callback(db);
    },
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
            return;
          }

          if (tableName === "task_events") {
            taskEventRows.push({ ...values });
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
    update(table: any) {
      return {
        set(values: Record<string, unknown>) {
          return {
            where(whereClause: { right: { value: unknown } }) {
              const tableName = table[Symbol.for("drizzle:Name")] ?? "unknown";

              return {
                async returning() {
                  if (tableName !== "tasks") {
                    return [];
                  }

                  const conditionValues = collectConditionValues(whereClause);
                  const taskId = conditionValues.find(
                    (value) =>
                      typeof value === "string" &&
                      taskRows.some((row) => row.id === value),
                  );
                  const fromStatus = conditionValues.find(
                    (value) =>
                      typeof value === "string" &&
                      taskRows.some((row) => row.status === value),
                  );
                  const existing = taskRows.find(
                    (row) =>
                      (taskId == null || row.id === taskId) &&
                      (fromStatus == null || row.status === fromStatus),
                  );

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
    select(selection: Record<string, unknown>) {
      return {
        from(table: any) {
          const tableName = table[Symbol.for("drizzle:Name")] ?? "unknown";

          if (tableName === "task_intake_drafts") {
            return {
              where() {
                return {
                  async limit() {
                    void selection;
                    const [firstDraft] = draftRows.values();

                    return firstDraft ? [firstDraft] : [];
                  },
                };
              },
            };
          }

          if (tableName === "tasks") {
            return {
              where() {
                void selection;
                return createWhereChain(
                  taskRows.map((row) => ({
                    id: row.id,
                    creatorUserId: row.creatorUserId,
                    intakeMethod: row.intakeMethod,
                    sourceUrl: row.sourceUrl,
                    sourceIdentifier: row.sourceIdentifier,
                    sourceSnapshot: row.sourceSnapshot,
                    processingBaselineSnapshot: row.processingBaselineSnapshot,
                    presetId: row.presetId,
                    presetSnapshot: row.presetSnapshot,
                    uploadStorageKey: row.uploadStorageKey,
                    status: row.status,
                    createdAt: row.createdAt,
                    updatedAt: row.updatedAt,
                  })),
                );
              },
            };
          }

          if (tableName === "task_events") {
            return {
              where() {
                void selection;
                return createWhereChain([...taskEventRows]);
              },
            };
          }

          throw new Error(`Unsupported table in fake select: ${tableName}`);
        },
      };
    },
  };

  return {
    draftRows,
    taskRows,
    taskEventRows,
    db,
  };
}

test.beforeEach(() => {
  setTaskIntakeTestHooks({
    findChannelPresetForSourceImpl: async () => null,
  });
  setChannelPresetTestHooks({});
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
        assert.equal(response.presetMatch.status, "unresolved");
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
        formData.set("intent", "confirm_continue_without_preset");
        formData.set("draftToken", preview.draftToken);

        const created = await confirmTaskCreation(42, formData);

        assert.equal(created.mode, "created");
        assert.equal(created.requestId, "req_confirm_task");
        assert.equal(created.task.status, "created");
        assert.equal(created.task.presetMatch.status, "continue_without_preset");
        assert.equal(fake.taskRows.length, 1);
        assert.equal(fake.taskEventRows.length, 1);
        assert.equal(fake.taskRows[0]?.creatorUserId, 42);
        assert.equal(fake.taskRows[0]?.sourceIdentifier, "youtube:KurzgesagtCN");
        assert.equal(fake.taskRows[0]?.presetId, null);
        assert.equal(
          (fake.taskRows[0]?.presetSnapshot as { status?: string })?.status,
          "continue_without_preset",
        );
        assert.equal(fake.taskEventRows[0]?.eventType, "task.created");
        assert.equal(fake.taskEventRows[0]?.toStatus, "created");
        assert.equal(fake.taskEventRows[0]?.requestId, "req_confirm_task");
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

test("continue without preset rejects task-level subtitle overrides and keeps the draft context", async () => {
  const fake = createFakeDb();

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_continue_without_preset_override",
    }),
    async () => {
      await DatabaseContext.run(fake.db as never, async () => {
        const preview = await handleTaskIntakeAction(
          42,
          makeUrlEncodedRequest({
            intent: "preview_youtube",
            sourceUrl: "https://www.youtube.com/watch?v=abc123&ab_channel=UnknownChannel",
          }, "req_continue_without_preset_override"),
        );

        assert.equal(preview.presetMatch.status, "unresolved");

        const formData = new FormData();
        formData.set("intent", "confirm_continue_without_preset");
        formData.set("draftToken", preview.draftToken);
        formData.set("subtitleTemplateOverride", "高对比模板");

        await assert.rejects(confirmTaskCreation(42, formData), (error: any) => {
          assert.equal(error.constructor?.name, "DataWithResponseInit");
          assert.equal(error.data.code, "manual_resolution_invalid");
          assert.equal(error.data.field, "subtitleTemplateOverride");
          return true;
        });

        assert.equal(fake.draftRows.size, 1);
        assert.equal(fake.taskRows.length, 0);
      });
    },
  );
});

test("familiar source preview applies a matched channel preset baseline and persists the preset snapshot", async () => {
  const fake = createFakeDb();

  setTaskIntakeTestHooks({
    findChannelPresetForSourceImpl: async () => ({
      id: "preset_kurz",
      sourceIdentifier: "youtube:KurzgesagtCN",
      displayName: "Kurzgesagt 中文频道",
      summary: "英译中字幕 / 科普模板 / mp4 + srt",
      defaults: {
        translationMode: "英译中字幕",
        subtitleTemplate: "科普模板",
        outputPackage: "mp4 + srt",
      },
      notes: null,
      previewStyle: {
        fontSize: 52,
        theme: "cinema",
      },
      createdAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T00:00:00.000Z",
    }),
  });

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_preset_match",
    }),
    async () => {
      await DatabaseContext.run(fake.db as never, async () => {
        const preview = await handleTaskIntakeAction(
          42,
          makeUrlEncodedRequest({
            intent: "preview_youtube",
            sourceUrl: "https://www.youtube.com/watch?v=abc123&ab_channel=KurzgesagtCN",
          }, "req_preset_match"),
        );

        assert.equal(preview.mode, "preview");
        assert.equal(preview.presetMatch.status, "matched");
        assert.equal(preview.baseline.translationMode, "英译中字幕");
        assert.deepEqual(Object.keys(preview.baseline).sort(), [
          "outputPackage",
          "subtitleTemplate",
          "translationMode",
        ]);

        const formData = new FormData();
        formData.set("intent", "confirm");
        formData.set("draftToken", preview.draftToken);

        const created = await confirmTaskCreation(42, formData);

        assert.equal(created.task.presetMatch.status, "matched");
        assert.equal(fake.taskRows[0]?.presetId, "preset_kurz");
        assert.deepEqual(fake.taskRows[0]?.processingBaselineSnapshot, {
          translationMode: "英译中字幕",
          subtitleTemplate: "科普模板",
          outputPackage: "mp4 + srt",
        });
        assert.equal(
          Object.prototype.hasOwnProperty.call(
            fake.taskRows[0]?.processingBaselineSnapshot ?? {},
            "previewStyle",
          ),
          false,
        );
      });
    },
  );
});

test("matched preset flow applies a task-level subtitle template override without mutating preset defaults", async () => {
  const fake = createFakeDb();

  setTaskIntakeTestHooks({
    findChannelPresetForSourceImpl: async () => ({
      id: "preset_kurz",
      sourceIdentifier: "youtube:KurzgesagtCN",
      displayName: "Kurzgesagt 中文频道",
      summary: "英译中字幕 / 科普模板 / mp4 + srt",
      defaults: {
        translationMode: "英译中字幕",
        subtitleTemplate: "科普模板",
        outputPackage: "mp4 + srt",
      },
      notes: null,
      createdAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T00:00:00.000Z",
    }),
  });

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_task_override_match",
    }),
    async () => {
      await DatabaseContext.run(fake.db as never, async () => {
        const preview = await handleTaskIntakeAction(
          42,
          makeUrlEncodedRequest({
            intent: "preview_youtube",
            sourceUrl: "https://www.youtube.com/watch?v=abc123&ab_channel=KurzgesagtCN",
          }, "req_task_override_match"),
        );

        assert.equal(preview.presetMatch.status, "matched");

        const formData = new FormData();
        formData.set("intent", "confirm");
        formData.set("draftToken", preview.draftToken);
        formData.set("subtitleTemplateOverride", "高对比模板");

        const created = await confirmTaskCreation(42, formData);

        assert.equal(created.task.presetMatch.status, "matched");
        assert.deepEqual(fake.taskRows[0]?.processingBaselineSnapshot, {
          translationMode: "英译中字幕",
          subtitleTemplate: "高对比模板",
          outputPackage: "mp4 + srt",
        });
        assert.equal(
          (
            fake.taskRows[0]?.sourceSnapshot as {
              taskLevelOverrides?: { subtitleTemplate?: string };
            }
          )?.taskLevelOverrides?.subtitleTemplate,
          "高对比模板",
        );
        assert.equal(
          (
            fake.taskRows[0]?.presetSnapshot as {
              defaults?: { subtitleTemplate?: string };
            }
          )?.defaults?.subtitleTemplate,
          "科普模板",
        );
      });
    },
  );
});

test("manual preset reuse applies the selected preset without pretending it was an automatic match", async () => {
  const fake = createFakeDb();

  setTaskIntakeTestHooks({
    findChannelPresetForSourceImpl: async () => null,
    getChannelPresetByIdForUserImpl: async (_ownerUserId, presetId) =>
      presetId === "preset_reuse"
        ? {
            id: "preset_reuse",
            sourceIdentifier: "youtube:ReusablePreset",
            displayName: "复用科普模板",
            summary: "英译中字幕 / 科普模板 / mp4 + srt",
            defaults: {
              translationMode: "英译中字幕",
              subtitleTemplate: "科普模板",
              outputPackage: "mp4 + srt",
            },
            notes: null,
            createdAt: "2026-05-27T00:00:00.000Z",
            updatedAt: "2026-05-27T00:00:00.000Z",
          }
        : null,
  });

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_manual_reuse",
    }),
    async () => {
      await DatabaseContext.run(fake.db as never, async () => {
        const preview = await handleTaskIntakeAction(
          42,
          makeUrlEncodedRequest({
            intent: "preview_youtube",
            sourceUrl: "https://www.youtube.com/watch?v=abc123&ab_channel=UnknownChannel",
          }, "req_manual_reuse"),
        );

        assert.equal(preview.mode, "preview");
        assert.equal(preview.presetMatch.status, "unresolved");

        const formData = new FormData();
        formData.set("intent", "confirm_manual_reuse");
        formData.set("draftToken", preview.draftToken);
        formData.set("presetId", "preset_reuse");
        formData.set("subtitleTemplateOverride", "双语模板");

        const created = await confirmTaskCreation(42, formData);

        assert.equal(created.task.presetMatch.status, "manual_reuse");
        assert.equal(fake.taskRows[0]?.presetId, "preset_reuse");
        assert.equal(
          (fake.taskRows[0]?.presetSnapshot as { status?: string })?.status,
          "manual_reuse",
        );
        assert.deepEqual(fake.taskRows[0]?.processingBaselineSnapshot, {
          translationMode: "英译中字幕",
          subtitleTemplate: "双语模板",
          outputPackage: "mp4 + srt",
        });
      });
    },
  );
});

test("manual preset creation can apply a task-level subtitle override while keeping the new preset default intact", async () => {
  const fake = createFakeDb();

  setChannelPresetTestHooks({
    findRowBySourceImpl: async () => null,
    insertRowImpl: async (_ownerUserId, input) => ({
      id: "preset_new",
      ownerUserId: 42,
      sourceIdentifier: String(input.sourceIdentifier),
      displayName: String(input.displayName),
      translationMode: String(input.translationMode),
      subtitleTemplate: String(input.subtitleTemplate),
      outputPackage: String(input.outputPackage),
      notes: input.notes ?? null,
      metadata: {
        subtitleStylePreview: {
          fontSize: input.previewFontSize,
          theme: input.previewTheme,
        },
      },
      createdAt: new Date("2026-06-02T00:00:00.000Z"),
      updatedAt: new Date("2026-06-02T00:00:00.000Z"),
    }),
  });

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_manual_create_override",
    }),
    async () => {
      await DatabaseContext.run(fake.db as never, async () => {
        const preview = await handleTaskIntakeAction(
          42,
          makeUrlEncodedRequest({
            intent: "preview_youtube",
            sourceUrl: "https://www.youtube.com/watch?v=abc123&ab_channel=UnknownChannel",
          }, "req_manual_create_override"),
        );

        assert.equal(preview.presetMatch.status, "unresolved");

        const formData = new FormData();
        formData.set("intent", "confirm_manual_create");
        formData.set("draftToken", preview.draftToken);
        formData.set("displayName", "Unknown Channel");
        formData.set("translationMode", "英译中字幕");
        formData.set("subtitleTemplate", "科普模板");
        formData.set("outputPackage", "mp4 + srt");
        formData.set("subtitleTemplateOverride", "高对比模板");

        const created = await confirmTaskCreation(42, formData);

        assert.equal(created.task.presetMatch.status, "manual_create");
        assert.equal(fake.taskRows[0]?.presetId, "preset_new");
        assert.deepEqual(fake.taskRows[0]?.processingBaselineSnapshot, {
          translationMode: "英译中字幕",
          subtitleTemplate: "高对比模板",
          outputPackage: "mp4 + srt",
        });
        assert.equal(
          (
            fake.taskRows[0]?.presetSnapshot as {
              defaults?: { subtitleTemplate?: string };
            }
          )?.defaults?.subtitleTemplate,
          "科普模板",
        );
        assert.equal(
          (
            fake.taskRows[0]?.presetSnapshot as {
              defaults?: { subtitleTemplate?: string };
              displayName?: string;
            }
          )?.displayName,
          "Unknown Channel",
        );
      });
    },
  );
});

test("manual preset creation keeps the draft context when validation fails", async () => {
  const fake = createFakeDb();

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_manual_create_invalid",
    }),
    async () => {
      await DatabaseContext.run(fake.db as never, async () => {
        const preview = await handleTaskIntakeAction(
          42,
          makeUrlEncodedRequest({
            intent: "preview_youtube",
            sourceUrl: "https://www.youtube.com/watch?v=abc123&ab_channel=UnknownChannel",
          }, "req_manual_create_invalid"),
        );

        assert.equal(preview.presetMatch.status, "unresolved");

        const formData = new FormData();
        formData.set("intent", "confirm_manual_create");
        formData.set("draftToken", preview.draftToken);
        formData.set("displayName", "");
        formData.set("translationMode", "英译中字幕");
        formData.set("subtitleTemplate", "科普模板");
        formData.set("outputPackage", "mp4 + srt");

        await assert.rejects(confirmTaskCreation(42, formData), (error: any) => {
          assert.equal(error.constructor?.name, "DataWithResponseInit");
          assert.equal(error.data.code, "manual_resolution_invalid");
          assert.equal(error.data.field, "displayName");
          return true;
        });

        assert.equal(fake.draftRows.size, 1);
        assert.equal(fake.taskRows.length, 0);
      });
    },
  );
});

test("invalid task-level subtitle template override keeps the preview draft available", async () => {
  const fake = createFakeDb();

  setTaskIntakeTestHooks({
    findChannelPresetForSourceImpl: async () => ({
      id: "preset_kurz",
      sourceIdentifier: "youtube:KurzgesagtCN",
      displayName: "Kurzgesagt 中文频道",
      summary: "英译中字幕 / 科普模板 / mp4 + srt",
      defaults: {
        translationMode: "英译中字幕",
        subtitleTemplate: "科普模板",
        outputPackage: "mp4 + srt",
      },
      notes: null,
      createdAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T00:00:00.000Z",
    }),
  });

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_invalid_subtitle_override",
    }),
    async () => {
      await DatabaseContext.run(fake.db as never, async () => {
        const preview = await handleTaskIntakeAction(
          42,
          makeUrlEncodedRequest({
            intent: "preview_youtube",
            sourceUrl: "https://www.youtube.com/watch?v=abc123&ab_channel=KurzgesagtCN",
          }, "req_invalid_subtitle_override"),
        );

        const formData = new FormData();
        formData.set("intent", "confirm");
        formData.set("draftToken", preview.draftToken);
        formData.set("subtitleTemplateOverride", "不存在的模板");

        await assert.rejects(confirmTaskCreation(42, formData), (error: any) => {
          assert.equal(error.constructor?.name, "DataWithResponseInit");
          assert.equal(error.data.code, "manual_resolution_invalid");
          assert.equal(error.data.field, "subtitleTemplateOverride");
          return true;
        });

        assert.equal(fake.draftRows.size, 1);
        assert.equal(fake.taskRows.length, 0);
      });
    },
  );
});

test("submit review persists resolved decisions and moves the task back to queued", async () => {
  const fake = createFakeDb();
  const now = new Date("2026-06-09T12:00:00.000Z");

  fake.taskRows.push({
    id: "task_review_1",
    creatorUserId: 7,
    intakeMethod: "youtube_link",
    sourceUrl: "https://www.youtube.com/watch?v=abc123",
    sourceIdentifier: "youtube:ReviewChannel",
    sourceSnapshot: {
      title: "Review Channel",
    },
    processingBaselineSnapshot: {
      translationMode: "中译中字幕",
      subtitleTemplate: "标准模板",
      outputPackage: "mp4 + srt",
    },
    presetId: null,
    presetSnapshot: null,
    uploadStorageKey: null,
    status: "awaiting_human_review",
    createdAt: now,
    updatedAt: now,
  });
  fake.taskEventRows.push({
    id: "evt_review_required",
    taskId: "task_review_1",
    eventType: "task.review_required",
    fromStatus: "processing",
    toStatus: "awaiting_human_review",
    reasonCode: null,
    requestId: "req_review_submit",
    payload: {
      reviewId: "review_1",
      summary: "当前任务需要处理 2 个低置信度片段。",
      items: [
        {
          id: "item_1",
          snippet: "第一段字幕",
          contextBefore: "前文一",
          contextAfter: "后文一",
          confidenceLabel: "低置信度",
          suggestedAction: "确认是否可直接沿用。",
        },
        {
          id: "item_2",
          snippet: "第二段字幕",
          contextBefore: "前文二",
          contextAfter: "后文二",
          confidenceLabel: "低置信度",
          suggestedAction: "如需继续关注请标记。",
        },
      ],
    },
    createdAt: now,
  });

  setTaskIntakeTestHooks({
    nowImpl: () => now,
  });

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_review_submit",
    }),
    async () => {
      await DatabaseContext.run(fake.db as never, async () => {
        const response = await handleTaskIntakeAction(
          7,
          makeUrlEncodedRequest({
            intent: "submit_review",
            taskId: "task_review_1",
            "reviewDecision:item_1": "approve",
            "reviewNote:item_1": "可以继续",
            "reviewDecision:item_2": "needs_attention",
            "reviewNote:item_2": "需要继续关注",
          }, "req_review_submit"),
        );

        assert.equal(response.ok, true);
        assert.equal(response.mode, "review_submitted");
        assert.equal(response.resolvedCount, 2);
        assert.equal(fake.taskRows[0]?.status, "queued");
        assert.equal(fake.taskEventRows.at(-1)?.eventType, "task.review_resolved");
        assert.deepEqual(
          (fake.taskEventRows.at(-1)?.payload as { resolvedItems?: unknown[] })?.resolvedItems,
          [
            {
              itemId: "item_1",
              decision: "approve",
              note: "可以继续",
            },
            {
              itemId: "item_2",
              decision: "needs_attention",
              note: "需要继续关注",
            },
          ],
        );
      });
    },
  );
});

test("submit review rejects invalid decisions without mutating the task state", async () => {
  const fake = createFakeDb();
  const now = new Date("2026-06-09T12:30:00.000Z");

  fake.taskRows.push({
    id: "task_review_invalid",
    creatorUserId: 7,
    intakeMethod: "youtube_link",
    sourceUrl: "https://www.youtube.com/watch?v=abc123",
    sourceIdentifier: "youtube:ReviewChannel",
    sourceSnapshot: {
      title: "Review Channel",
    },
    processingBaselineSnapshot: {
      translationMode: "中译中字幕",
      subtitleTemplate: "标准模板",
      outputPackage: "mp4 + srt",
    },
    presetId: null,
    presetSnapshot: null,
    uploadStorageKey: null,
    status: "awaiting_human_review",
    createdAt: now,
    updatedAt: now,
  });
  fake.taskEventRows.push({
    id: "evt_review_required_invalid",
    taskId: "task_review_invalid",
    eventType: "task.review_required",
    fromStatus: "processing",
    toStatus: "awaiting_human_review",
    reasonCode: null,
    requestId: "req_review_invalid",
    payload: {
      reviewId: "review_invalid",
      items: [
        {
          id: "item_invalid",
          snippet: "第一段字幕",
        },
      ],
    },
    createdAt: now,
  });

  await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_review_invalid",
    }),
    async () => {
      await DatabaseContext.run(fake.db as never, async () => {
        await assert.rejects(
          handleTaskIntakeAction(
            7,
            makeUrlEncodedRequest({
              intent: "submit_review",
              taskId: "task_review_invalid",
            }, "req_review_invalid"),
          ),
          (error: any) => {
            assert.equal(error.constructor?.name, "DataWithResponseInit");
            assert.equal(error.data.code, "review_submission_invalid");
            assert.equal(error.data.field, "item_invalid");
            return true;
          },
        );

        assert.equal(fake.taskRows[0]?.status, "awaiting_human_review");
        assert.equal(fake.taskEventRows.length, 1);
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
