import { redirect } from "react-router";
import { Form, isRouteErrorResponse, useRouteError } from "react-router";

import type { Route } from "./+types/presets.$presetId.edit";
import { PresetEditScreen } from "~/features/presets/components/ChannelPresetDetailScreens";
import {
  handlePresetEditRouteAction,
  loadPresetEditRouteViewModel,
} from "~/features/presets/server/preset-routes.server";

export function meta({ data }: Route.MetaArgs) {
  const title = data?.preset?.displayName
    ? `编辑 ${data.preset.displayName} | Yakimoji Preset Edit`
    : "Yakimoji Preset Edit";

  return [
    { title },
    {
      name: "description",
      content: "编辑频道预设默认值并实时预览字幕样式。",
    },
  ];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  return loadPresetEditRouteViewModel({
    request,
    context,
    presetId: params.presetId,
  });
}

export async function action({ request, params }: Route.ActionArgs) {
  const result = await handlePresetEditRouteAction({
    request,
    presetId: params.presetId,
  });

  if (result.ok) {
    return redirect(`/presets/${result.preset.id}?updated=1`);
  }

  return result;
}

export default function PresetEditRoute({ loaderData }: Route.ComponentProps) {
  return <PresetEditScreen loaderData={loaderData} />;
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <main className="app-shell auth-shell">
        <section className="shell-panel auth-card">
          <p className="eyebrow">预设编辑不可用</p>
          <h1>
            {error.status === 403
              ? "当前账号没有访问该预设编辑页的权限"
              : error.status >= 500
                ? "预设编辑页暂时不可用"
                : "请求失败"}
          </h1>
          <p className="lede">
            {typeof error.data === "object" && error.data && "message" in error.data
              ? String(error.data.message)
              : "预设编辑流程加载失败。"}
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
