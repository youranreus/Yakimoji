import type { AllowedRole } from "../../../../database/schema";
import {
  listChannelPresetsForUser,
  type ChannelPresetView,
} from "../../presets/server/channel-presets.server";
import { requireRole } from "../../auth/server/authz.server";
import {
  getCurrentUserRoles,
  requireUserSession,
  type AuthenticatedSession,
} from "../../auth/server/session.server";

import {
  getTaskDetailForUser,
  listPaginatedTasksForUser,
  type PaginatedTaskList,
  type TaskDetailView,
} from "./task-query.server";

type WorkspaceContext = {
  requestId: string;
  releaseStage: string;
  serviceName: string;
};

export type WorkspaceViewModel = {
  requestId: string;
  runtime: string;
  serviceName: string;
  user: {
    id: number;
    displayName: string;
    email: string;
  };
  roles: AllowedRole[];
  navigation: Array<{
    label: string;
    href: string;
    state: "active" | "coming-soon";
  }>;
  panels: Array<{
    title: string;
    body: string;
  }>;
  taskList: PaginatedTaskList;
  selectedTask: TaskDetailView | null;
  channelPresets: ChannelPresetView[];
};

export const workspaceViewTestHooks = {
  requireUserSessionImpl: requireUserSession,
  getCurrentUserRolesImpl: getCurrentUserRoles,
  requireRoleImpl: requireRole,
  listPaginatedTasksForUserImpl: listPaginatedTasksForUser,
  getTaskDetailForUserImpl: getTaskDetailForUser,
  listChannelPresetsForUserImpl: listChannelPresetsForUser,
};

export function setWorkspaceViewTestHooks(
  hooks: Partial<typeof workspaceViewTestHooks>,
) {
  workspaceViewTestHooks.requireUserSessionImpl =
    hooks.requireUserSessionImpl ?? requireUserSession;
  workspaceViewTestHooks.getCurrentUserRolesImpl =
    hooks.getCurrentUserRolesImpl ?? getCurrentUserRoles;
  workspaceViewTestHooks.requireRoleImpl =
    hooks.requireRoleImpl ?? requireRole;
  workspaceViewTestHooks.listPaginatedTasksForUserImpl =
    hooks.listPaginatedTasksForUserImpl ?? listPaginatedTasksForUser;
  workspaceViewTestHooks.getTaskDetailForUserImpl =
    hooks.getTaskDetailForUserImpl ?? getTaskDetailForUser;
  workspaceViewTestHooks.listChannelPresetsForUserImpl =
    hooks.listChannelPresetsForUserImpl ?? listChannelPresetsForUser;
}

function parsePage(url: string) {
  const page = Number(new URL(url).searchParams.get("page") ?? "1");

  if (Number.isNaN(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

function buildNavigation() {
  return [
    { label: "工作台总览", href: "/workspace", state: "active" as const },
    { label: "任务导入", href: "/workspace", state: "active" as const },
    { label: "预设", href: "/presets", state: "active" as const },
    { label: "Review", href: "#", state: "coming-soon" as const },
    { label: "交付", href: "#", state: "coming-soon" as const },
  ];
}

function buildPanels() {
  return [
    {
      title: "查看重点",
      body: "先确认任务当前阶段，再根据最近进展判断是否需要继续跟进。",
    },
    {
      title: "处理顺序",
      body: "优先处理最影响交付的任务，再回看历史记录补充判断。",
    },
    {
      title: "协作建议",
      body: "如需进一步协作，可根据任务状态、失败说明和处理建议同步相关同事。",
    },
  ];
}

export async function loadWorkspaceViewModel(args: {
  request: Request;
  context: WorkspaceContext;
  taskId?: string;
}): Promise<WorkspaceViewModel> {
  const authenticated = (await workspaceViewTestHooks.requireUserSessionImpl(
    args.request,
  )) as AuthenticatedSession;
  const roles = await workspaceViewTestHooks.getCurrentUserRolesImpl(
    authenticated.user.id,
  );
  await workspaceViewTestHooks.requireRoleImpl(authenticated, "creator", {
    type: "workspace",
    id: "creator-home",
  });

  const page = parsePage(args.request.url);
  const taskList = await workspaceViewTestHooks.listPaginatedTasksForUserImpl(
    authenticated.user.id,
    {
      page,
    },
  );
  const selectedTask = args.taskId
    ? await workspaceViewTestHooks.getTaskDetailForUserImpl(
        authenticated.user.id,
        args.taskId,
      )
    : null;
  const channelPresets =
    await workspaceViewTestHooks.listChannelPresetsForUserImpl(
      authenticated.user.id,
    );

  return {
    requestId: args.context.requestId,
    runtime: args.context.releaseStage,
    serviceName: args.context.serviceName,
    user: {
      id: authenticated.user.id,
      displayName: authenticated.user.displayName,
      email: authenticated.user.email,
    },
    roles,
    navigation: buildNavigation(),
    panels: buildPanels(),
    taskList,
    selectedTask,
    channelPresets,
  };
}
