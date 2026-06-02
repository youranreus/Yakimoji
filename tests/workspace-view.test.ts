import assert from "node:assert/strict";
import test from "node:test";

import {
  loadWorkspaceViewModel,
  setWorkspaceViewTestHooks,
} from "../app/features/tasks/server/workspace-view.server";
import { createRequestContext, runWithRequestContext } from "../app/features/auth/server/request-context.server";

test.beforeEach(() => {
  setWorkspaceViewTestHooks({});
});

test("workspace view loader keeps /workspace as the default entry and parses pagination from the URL", async () => {
  let receivedPage = 0;
  const expectedTaskList = {
    data: [],
    meta: {
      pagination: {
        page: 3,
        pageSize: 10,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    },
  };

  setWorkspaceViewTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 7,
        displayName: "季悠然",
        email: "creator@example.com",
      },
      session: {
        id: "sess_1",
      },
    }),
    getCurrentUserRolesImpl: async () => ["creator"],
    requireRoleImpl: async () => ["creator"],
    listPaginatedTasksForUserImpl: async (_userId, options) => {
      receivedPage = options.page;
      return expectedTaskList;
    },
    getTaskDetailForUserImpl: async () => null,
    listChannelPresetsForUserImpl: async () => [],
  });

  const model = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_workspace_page",
    }),
    async () =>
      loadWorkspaceViewModel({
        request: new Request("http://localhost:3000/workspace?page=3"),
        context: {
          requestId: "req_workspace_page",
          releaseStage: "test",
          serviceName: "yakimoji",
        },
      }),
  );

  assert.equal(receivedPage, 3);
  assert.equal(model.navigation[0]?.href, "/workspace");
  assert.equal(model.taskList.meta.pagination.page, 3);
  assert.equal(model.selectedTask, null);
  assert.deepEqual(model.channelPresets, []);
});

test("workspace view loader resolves a direct task detail route through the shared shell model", async () => {
  let receivedTaskId = "";
  let receivedPage = 0;

  setWorkspaceViewTestHooks({
    requireUserSessionImpl: async () => ({
      user: {
        id: 7,
        displayName: "季悠然",
        email: "creator@example.com",
      },
      session: {
        id: "sess_2",
      },
    }),
    getCurrentUserRolesImpl: async () => ["creator"],
    requireRoleImpl: async () => ["creator"],
    listPaginatedTasksForUserImpl: async (_userId, options) => {
      receivedPage = options.page;

      return {
        data: [],
        meta: {
          pagination: {
            page: options.page,
            pageSize: 10,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
      };
    },
    getTaskDetailForUserImpl: async (_userId, taskId) => {
      receivedTaskId = taskId;

      return {
        id: taskId,
        sourceTitle: "Task 1",
        sourceIdentifier: "youtube:task_1",
        status: "processing",
        statusLabel: "正在处理",
        presetContextLabel: "自动命中已有预设",
        presetContextSummary: "中译中字幕 / 标准 Shorts 模板 / mp4 + srt",
        baselineSummary: "中译中字幕 / 标准 Shorts 模板 / mp4 + srt",
        subtitleTemplateContextLabel: "沿用预设默认模板",
        subtitleTemplateContextSummary: "当前任务沿用预设默认模板「标准 Shorts 模板」。",
        currentStageLabel: "处理中",
        latestProgressLabel: "任务处理中",
        requestId: "req_workspace_detail",
        createdAt: "2026-05-26T01:00:00.000Z",
        updatedAt: "2026-05-26T01:10:00.000Z",
        nextStepLabel: "等待处理完成",
        statusTone: "info",
        resultStatus: {
          label: "结果生成中",
          description: "任务仍在处理中，交付物尚未就绪。",
          tone: "info",
        },
        deliverables: [],
        stages: [],
        events: [],
      };
    },
    listChannelPresetsForUserImpl: async () => [
      {
        id: "preset_1",
        sourceIdentifier: "youtube:task_1",
        displayName: "Task 1 Channel",
        summary: "中译中字幕 / 标准 Shorts 模板 / mp4 + srt",
        defaults: {
          translationMode: "中译中字幕",
          subtitleTemplate: "标准 Shorts 模板",
          outputPackage: "mp4 + srt",
        },
        notes: null,
        createdAt: "2026-05-26T01:00:00.000Z",
        updatedAt: "2026-05-26T01:00:00.000Z",
      },
    ],
  });

  const model = await runWithRequestContext(
    createRequestContext({
      "x-request-id": "req_workspace_detail",
    }),
    async () =>
      loadWorkspaceViewModel({
        request: new Request("http://localhost:3000/workspace/tasks/task_1?page=2"),
        context: {
          requestId: "req_workspace_detail",
          releaseStage: "test",
          serviceName: "yakimoji",
        },
        taskId: "task_1",
      }),
  );

  assert.equal(receivedTaskId, "task_1");
  assert.equal(receivedPage, 2);
  assert.equal(model.selectedTask?.id, "task_1");
  assert.equal(model.channelPresets[0]?.displayName, "Task 1 Channel");
  assert.equal(model.taskList.meta.pagination.page, 2);
  assert.equal(model.navigation[0]?.href, "/workspace");
  assert.equal(model.panels[0]?.title, "任务状态原则");
});
