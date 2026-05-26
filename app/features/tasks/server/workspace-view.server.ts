import type { AllowedRole } from "../../../../database/schema";
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
};

export const workspaceViewTestHooks = {
  requireUserSessionImpl: requireUserSession,
  getCurrentUserRolesImpl: getCurrentUserRoles,
  requireRoleImpl: requireRole,
  listPaginatedTasksForUserImpl: listPaginatedTasksForUser,
  getTaskDetailForUserImpl: getTaskDetailForUser,
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
    { label: "预设", href: "#", state: "coming-soon" as const },
    { label: "Review", href: "#", state: "coming-soon" as const },
    { label: "交付", href: "#", state: "coming-soon" as const },
  ];
}

function buildPanels() {
  return [
    {
      title: "任务状态原则",
      body: "任务列表只读取分页摘要，任务详情才加载完整阶段账本，避免列表页预取完整事件历史。",
    },
    {
      title: "状态可读性",
      body: "顶层状态、最近关键进展和阶段时间线都来自统一状态真源，不在前端拼第二套伪状态。",
    },
    {
      title: "支持追踪",
      body: "异常与拒绝响应会保留 request_id，便于支持与审计闭环。",
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
  };
}
