import { Form, isRouteErrorResponse, useRouteError } from "react-router";

import type { Route } from "./+types/workspace";
import {
  CreatorWorkspaceScreen,
} from "~/features/tasks/components/CreatorWorkspaceScreen";
import { requireRole } from "~/features/auth/server/authz.server";
import { requireUserSession } from "~/features/auth/server/session.server";
import { handleChannelPresetAction } from "~/features/presets/server/channel-presets.server";
import {
  handleTaskIntakeAction,
} from "~/features/tasks/server/task-intake.server";
import { loadWorkspaceViewModel } from "~/features/tasks/server/workspace-view.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Yakimoji Workspace" },
    {
      name: "description",
      content: "受保护的创作者工作台壳层，承载登录态、导航和主内容区。",
    },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  return loadWorkspaceViewModel({
    request,
    context,
  });
}

export async function action({ request }: Route.ActionArgs) {
  const authenticated = await requireUserSession(request);

  await requireRole(authenticated, "creator", {
    type: "workspace",
    id: "creator-home",
  });

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    const formData = await request.clone().formData();
    const intent = formData.get("intent");

    if (
      intent === "create_channel_preset" ||
      intent === "update_channel_preset"
    ) {
      return handleChannelPresetAction(authenticated.user.id, formData);
    }
  }

  return handleTaskIntakeAction(authenticated.user.id, request);
}

export default function WorkspaceRoute({ loaderData }: Route.ComponentProps) {
  return <CreatorWorkspaceScreen loaderData={loaderData} />;
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    const requestId =
      typeof error.data === "object" &&
      error.data &&
      "request_id" in error.data &&
      typeof error.data.request_id === "string"
        ? error.data.request_id
        : "req_unavailable";

    return (
      <main className="app-shell auth-shell">
        <section className="shell-panel auth-card">
          <p className="eyebrow">访问受限</p>
          <h1>
            {error.status === 403
              ? "当前账号没有访问权限"
              : error.status >= 500
                ? "认证服务暂时不可用"
                : "请求失败"}
          </h1>
          <p className="lede">
            {typeof error.data === "object" && error.data && "message" in error.data
              ? String(error.data.message)
              : "受保护工作台加载失败。"}
          </p>
          {error.status === 403 ? (
            <Form method="post" action="/logout">
              <button className="secondary-action" type="submit">
                退出当前账号并重新登录
              </button>
            </Form>
          ) : null}
          <div className="request-chip">request_id: {requestId}</div>
        </section>
      </main>
    );
  }

  throw error;
}
