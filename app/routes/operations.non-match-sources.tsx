import { Form, isRouteErrorResponse, useRouteError } from "react-router";

import type { Route } from "./+types/operations.non-match-sources";
import { OperationsNonMatchAnalysisScreen } from "~/features/operations/components/OperationsNonMatchAnalysisScreen";
import { loadOperationsNonMatchAnalysisViewModel } from "~/features/operations/server/operations-non-match-analysis.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Yakimoji Operations Non-match Sources" },
    {
      name: "description",
      content: "查看哪些来源频道反复未命中预设，并下钻到具体任务样本。",
    },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  return loadOperationsNonMatchAnalysisViewModel({
    request,
    context,
  });
}

export default function OperationsNonMatchSourcesRoute({
  loaderData,
}: Route.ComponentProps) {
  return <OperationsNonMatchAnalysisScreen loaderData={loaderData} />;
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
              ? "当前账号没有未命中来源分析访问权限"
              : error.status >= 500
                ? "来源频道未命中分析暂时不可用"
                : "请求失败"}
          </h1>
          <p className="lede">
            {typeof error.data === "object" && error.data && "message" in error.data
              ? String(error.data.message)
              : "来源频道未命中分析页面加载失败。"}
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
