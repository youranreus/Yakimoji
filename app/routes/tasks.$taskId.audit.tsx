import { Form, isRouteErrorResponse, useRouteError } from "react-router";

import type { Route } from "./+types/tasks.$taskId.audit";
import { TaskAuditScreen } from "~/features/tasks/components/TaskAuditScreen";
import { requireUserSession } from "~/features/auth/server/session.server";
import { loadTaskAuditForAuthorizedRole } from "~/features/tasks/server/task-audit.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Yakimoji Task Audit" },
    {
      name: "description",
      content: "按任务 ID 查看最小审计记录和关键生命周期历史。",
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const authenticated = await requireUserSession(request);

  return loadTaskAuditForAuthorizedRole({
    request,
    taskId: params.taskId,
    authenticatedSession: authenticated,
  });
}

export default function TaskAuditRoute({ loaderData }: Route.ComponentProps) {
  return <TaskAuditScreen loaderData={loaderData} />;
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <main className="app-shell auth-shell">
        <section className="shell-panel auth-card">
          <p className="eyebrow">审计记录不可用</p>
          <h1>
            {error.status === 403
              ? "当前账号没有审计记录访问权限"
              : error.status === 404
                ? "当前任务不存在或链接已失效"
                : error.status >= 500
                  ? "审计服务暂时不可用"
                  : "请求失败"}
          </h1>
          <p className="lede">
            {typeof error.data === "object" && error.data && "message" in error.data
              ? String(error.data.message)
              : "审计记录加载失败。"}
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
