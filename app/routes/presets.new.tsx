import { Form, isRouteErrorResponse, useRouteError } from "react-router";

import type { Route } from "./+types/presets.new";
import { ChannelPresetWorkbench } from "~/features/presets/components/ChannelPresetWorkbench";
import {
  handlePresetRouteAction,
  loadPresetRouteViewModel,
} from "~/features/presets/server/preset-routes.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Yakimoji New Preset" },
    {
      name: "description",
      content: "为来源频道创建最小可复用预设。",
    },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  return loadPresetRouteViewModel({
    request,
    context,
  });
}

export async function action({ request }: Route.ActionArgs) {
  return handlePresetRouteAction(request);
}

export default function NewPresetRoute({ loaderData }: Route.ComponentProps) {
  return (
    <ChannelPresetWorkbench
      mode="create"
      presets={loaderData.channelPresets}
    />
  );
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
              ? "当前账号没有创建预设权限"
              : error.status >= 500
                ? "预设创建页面暂时不可用"
                : "请求失败"}
          </h1>
          <p className="lede">
            {typeof error.data === "object" && error.data && "message" in error.data
              ? String(error.data.message)
              : "预设创建流程加载失败。"}
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
