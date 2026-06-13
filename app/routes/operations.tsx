import { Form, isRouteErrorResponse, useRouteError } from "react-router";

import type { Route } from "./+types/operations";
import { OperationsDashboardScreen } from "~/features/operations/components/OperationsDashboardScreen";
import { loadOperationsDashboardViewModel } from "~/features/operations/server/operations-dashboard.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Yakimoji Operations" },
    {
      name: "description",
      content: "查看预设复用、关键耗时与流程摩擦点的运营判断台。",
    },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  return loadOperationsDashboardViewModel({
    request,
    context,
  });
}

export default function OperationsRoute({
  loaderData,
}: Route.ComponentProps) {
  return <OperationsDashboardScreen loaderData={loaderData} />;
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <main className="app-shell auth-shell">
        <section className="shell-panel auth-card">
          <p className="eyebrow">访问受限</p>
          <h1>
            {error.status === 403
              ? "当前账号没有运营面板访问权限"
              : error.status >= 500
                ? "运营面板暂时不可用"
                : "请求失败"}
          </h1>
          <p className="lede">
            {typeof error.data === "object" && error.data && "message" in error.data
              ? String(error.data.message)
              : "运营可见性页面加载失败。"}
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
