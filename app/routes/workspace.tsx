import { Form, isRouteErrorResponse, useActionData, useRouteError } from "react-router";

import type { Route } from "./+types/workspace";
import { requireRole } from "~/features/auth/server/authz.server";
import {
  getCurrentUserRoles,
  requireUserSession,
} from "~/features/auth/server/session.server";
import {
  handleTaskIntakeAction,
  type TaskIntakeActionResult,
  listRecentTasksForUser,
} from "~/features/tasks/server/task-intake.server";
import { WorkspaceShell } from "~/shared/ui/WorkspaceShell";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Yakimoji Workspace" },
    {
      name: "description",
      content: "受保护的创作者工作台壳层，承载登录态、导航和主内容区。",
    },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const authenticated = await requireUserSession(request);
  const roles = await getCurrentUserRoles(authenticated.user.id);

  await requireRole(authenticated, "creator", {
    type: "workspace",
    id: "creator-home",
  });

  const recentTasks = await listRecentTasksForUser(authenticated.user.id);

  return {
    requestId: context.requestId,
    runtime: context.releaseStage,
    serviceName: context.serviceName,
    user: {
      id: authenticated.user.id,
      displayName: authenticated.user.displayName,
      email: authenticated.user.email,
    },
    roles,
    navigation: [
      { label: "工作台总览", href: "/workspace", state: "active" as const },
      { label: "任务导入", href: "/workspace", state: "active" as const },
      { label: "预设", href: "#", state: "coming-soon" as const },
      { label: "Review", href: "#", state: "coming-soon" as const },
      { label: "交付", href: "#", state: "coming-soon" as const },
    ],
    panels: [
      {
        title: "登录态上下文",
        body: "当前请求已经与 Yakimoji 本地 session、用户主体和本地 RBAC 绑定。",
      },
      {
        title: "后续能力边界",
        body: "任务列表、预设、低置信度 review 和交付访问将在后续 story 接入此壳层。",
      },
      {
        title: "支持追踪",
        body: "关键错误和拒绝响应会带 request_id，便于支持与审计闭环。",
      },
    ],
    recentTasks,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const authenticated = await requireUserSession(request);

  await requireRole(authenticated, "creator", {
    type: "workspace",
    id: "creator-home",
  });

  return handleTaskIntakeAction(authenticated.user.id, request);
}

export default function WorkspaceRoute({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<TaskIntakeActionResult>();

  return (
    <WorkspaceShell
      runtime={loaderData.runtime}
      serviceName={loaderData.serviceName}
      requestId={loaderData.requestId}
      user={loaderData.user}
      roles={loaderData.roles}
      navigation={loaderData.navigation}
      panels={loaderData.panels}
      recentTasks={loaderData.recentTasks}
      actionData={actionData ?? null}
      logoutForm={
        <Form method="post" action="/logout">
          <button className="secondary-action" type="submit">
            退出登录
          </button>
        </Form>
      }
    />
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    const requestId =
      typeof error.data === "object" &&
      error.data &&
      "request_id" in error.data &&
      typeof error.data.request_id === "string"
        ? error.data.request_id
        : "req_unavailable";

    return (
      <main className="app-shell auth-shell">
        <section className="shell-panel auth-card">
          <p className="eyebrow">访问受限</p>
          <h1>
            {error.status === 403
              ? "当前账号没有访问权限"
              : error.status >= 500
                ? "认证服务暂时不可用"
                : "请求失败"}
          </h1>
          <p className="lede">
            {typeof error.data === "object" && error.data && "message" in error.data
              ? String(error.data.message)
              : "受保护工作台加载失败。"}
          </p>
          <div className="request-chip">request_id: {requestId}</div>
        </section>
      </main>
    );
  }

  throw error;
}
