import { Form, isRouteErrorResponse, useRouteError } from "react-router";

import type { Route } from "./+types/presets";
import { ChannelPresetWorkbench } from "~/features/presets/components/ChannelPresetWorkbench";
import { loadPresetRouteViewModel } from "~/features/presets/server/preset-routes.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Yakimoji Presets" },
    {
      name: "description",
      content: "查看创作者已维护的频道预设摘要列表。",
    },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  return loadPresetRouteViewModel({
    request,
    context,
  });
}

export default function PresetsRoute({ loaderData }: Route.ComponentProps) {
  return (
    <ChannelPresetWorkbench
      mode="list"
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
              ? "当前账号没有预设列表访问权限"
              : error.status >= 500
                ? "预设列表暂时不可用"
                : "请求失败"}
          </h1>
          <p className="lede">
            {typeof error.data === "object" && error.data && "message" in error.data
              ? String(error.data.message)
              : "预设列表加载失败。"}
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
