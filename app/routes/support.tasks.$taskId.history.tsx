import { Form, isRouteErrorResponse, useRouteError } from "react-router";

import type { Route } from "./+types/support.tasks.$taskId.history";
import { requireUserSession } from "~/features/auth/server/session.server";
import { TaskSupportDiagnosticScreen } from "~/features/tasks/components/TaskSupportDiagnosticScreen";
import { loadSupportDiagnosticForAuthorizedRole } from "~/features/tasks/server/task-query.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Yakimoji Support Manual History" },
    {
      name: "description",
      content: "支持侧按任务 ID 查看人工确认与人工介入记录。",
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const authenticated = await requireUserSession(request);

  return loadSupportDiagnosticForAuthorizedRole({
    request,
    taskId: params.taskId,
    authenticatedSession: authenticated,
  });
}

export default function SupportTaskHistoryRoute({
  loaderData,
}: Route.ComponentProps) {
  return <TaskSupportDiagnosticScreen task={loaderData} />;
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <main className="app-shell auth-shell">
        <section className="shell-panel auth-card">
          <p className="eyebrow">人工记录不可用</p>
          <h1>
            {error.status === 403
              ? "当前账号没有访问该人工记录视图的权限"
              : error.status === 404
                ? "当前任务不存在或链接已失效"
                : error.status >= 500
                  ? "人工记录服务暂时不可用"
                  : "请求失败"}
          </h1>
          <p className="lede">
            {typeof error.data === "object" && error.data && "message" in error.data
              ? String(error.data.message)
              : "人工记录加载失败。"}
          </p>
          {error.status === 403 ? (
            <Form method="post" action="/logout">
              <button className="secondary-action" type="submit">
                退出当前账号并重新登录
              </button>
            </Form>
          ) : null}
        </section>
      </main>
    );
  }

  throw error;
}
