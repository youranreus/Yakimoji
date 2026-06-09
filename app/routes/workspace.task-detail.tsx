import { isRouteErrorResponse, useRouteError } from "react-router";

import type { Route } from "./+types/workspace.task-detail";
import { CreatorWorkspaceScreen } from "~/features/tasks/components/CreatorWorkspaceScreen";
import { requireRole } from "~/features/auth/server/authz.server";
import { requireUserSession } from "~/features/auth/server/session.server";
import { handleTaskIntakeAction } from "~/features/tasks/server/task-intake.server";
import { loadWorkspaceViewModel } from "~/features/tasks/server/workspace-view.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Yakimoji Task Detail" },
    {
      name: "description",
      content: "查看任务进度、结果和处理记录。",
    },
  ];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  return loadWorkspaceViewModel({
    request,
    context,
    taskId: params.taskId,
  });
}

export async function action({ request }: Route.ActionArgs) {
  const authenticated = await requireUserSession(request);

  await requireRole(authenticated, "creator", {
    type: "workspace",
    id: "creator-home",
  });

  return handleTaskIntakeAction(authenticated.user.id, request);
}

export default function WorkspaceTaskDetailRoute({
  loaderData,
}: Route.ComponentProps) {
  return <CreatorWorkspaceScreen loaderData={loaderData} />;
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <main className="app-shell auth-shell">
        <section className="shell-panel auth-card">
          <p className="eyebrow">任务详情不可用</p>
          <h1>
            {error.status === 403
              ? "当前账号没有访问该任务的权限"
              : error.status === 404
                ? "当前任务不存在或链接已失效"
              : error.status >= 500
                ? "任务详情服务暂时不可用"
                : "请求失败"}
          </h1>
          <p className="lede">
            {typeof error.data === "object" && error.data && "message" in error.data
              ? String(error.data.message)
              : "任务详情加载失败。"}
          </p>
        </section>
      </main>
    );
  }

  throw error;
}
