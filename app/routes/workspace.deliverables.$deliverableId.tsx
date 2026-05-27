import { isRouteErrorResponse, useRouteError } from "react-router";

import type { Route } from "./+types/workspace.deliverables.$deliverableId";
import { requireRole } from "~/features/auth/server/authz.server";
import { requireUserSession } from "~/features/auth/server/session.server";
import { getRequestContext } from "~/features/auth/server/request-context.server";
import {
  sanitizeDownloadFilename,
  streamDeliverableDownload,
} from "~/features/deliverables/server/deliverable-access.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const authenticated = await requireUserSession(request);

  await requireRole(authenticated, "creator", {
    type: "workspace",
    id: "creator-home",
  });

  const { access, fileBuffer } = await streamDeliverableDownload({
    userId: authenticated.user.id,
    deliverableId: params.deliverableId,
  });
  const { requestId } = getRequestContext();
  const safeName = sanitizeDownloadFilename(access.fileName);

  return new Response(fileBuffer, {
    headers: {
      "Content-Type": access.mimeType,
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    },
  });
}

export default function WorkspaceDeliverableRoute() {
  return null;
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
          <p className="eyebrow">交付物下载失败</p>
          <h1>
            {error.status === 403
              ? "当前账号没有访问该交付物的权限"
              : error.status === 410
                ? "交付物已过期"
                : error.status === 404
                  ? "交付物不存在或已失效"
                  : error.status === 500
                    ? "交付物暂时无法读取"
                  : "下载请求失败"}
          </h1>
          <p className="lede">
            {typeof error.data === "object" && error.data && "message" in error.data
              ? String(error.data.message)
              : "交付物下载失败。"}
          </p>
          <div className="request-chip">request_id: {requestId}</div>
        </section>
      </main>
    );
  }

  throw error;
}
