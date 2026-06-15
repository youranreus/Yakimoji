import { Form, isRouteErrorResponse, useRouteError } from "react-router";

import type { Route } from "./+types/presets.$presetId";
import { PresetDetailScreen } from "~/features/presets/components/ChannelPresetDetailScreens";
import { loadPresetDetailRouteViewModel } from "~/features/presets/server/preset-routes.server";

export function meta({ data }: Route.MetaArgs) {
  const title = data?.preset?.displayName
    ? `${data.preset.displayName} | Yakimoji Preset Detail`
    : "Yakimoji Preset Detail";

  return [
    { title },
    {
      name: "description",
      content: "查看频道预设详情与只读字幕预览。",
    },
  ];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  return loadPresetDetailRouteViewModel({
    request,
    context,
    presetId: params.presetId,
  });
}

export default function PresetDetailRoute({ loaderData }: Route.ComponentProps) {
  return <PresetDetailScreen loaderData={loaderData} />;
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <main className="app-shell auth-shell">
        <section className="shell-panel auth-card">
          <p className="eyebrow">预设详情不可用</p>
          <h1>
            {error.status === 403
              ? "当前账号没有访问该预设详情的权限"
              : error.status >= 500
                ? "预设详情暂时不可用"
                : "请求失败"}
          </h1>
          <p className="lede">
            {typeof error.data === "object" && error.data && "message" in error.data
              ? String(error.data.message)
              : "预设详情加载失败。"}
          </p>
          {typeof error.data === "object" && error.data && "request_id" in error.data ? (
            <p className="field-hint">request_id: {String(error.data.request_id)}</p>
          ) : null}
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
