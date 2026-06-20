import { Form, isRouteErrorResponse, useRouteError } from "react-router";

import type { Route } from "./+types/support.tasks.$taskId.diagnostics";
import { requireUserSession } from "~/features/auth/server/session.server";
import { TaskSupportDiagnosticScreen } from "~/features/tasks/components/TaskSupportDiagnosticScreen";
import { loadSupportDiagnosticForAuthorizedRole } from "~/features/tasks/server/task-query.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Yakimoji Support Diagnostics" },
    {
      name: "description",
      content: "支持侧任务诊断时间线视图。",
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

export default function SupportTaskDiagnosticsRoute({
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
          <p className="eyebrow">诊断视图不可用</p>
          <h1>
            {error.status === 403
              ? "当前账号没有访问该诊断视图的权限"
              : error.status === 404
                ? "当前任务不存在或链接已失效"
                : error.status >= 500
                  ? "诊断服务暂时不可用"
                  : "请求失败"}
          </h1>
          <p className="lede">
            {typeof error.data === "object" && error.data && "message" in error.data
              ? String(error.data.message)
              : "任务诊断加载失败。"}
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
