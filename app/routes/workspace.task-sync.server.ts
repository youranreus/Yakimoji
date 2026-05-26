import {
  encodeTaskSyncSseEvent,
  getTaskSyncEnvelope,
} from "../features/tasks/server/task-sync.server";
import {
  defaultTaskSyncPollingIntervalMs,
  defaultTaskSyncSseRetryMs,
} from "../features/tasks/task-sync.shared";
import { requireRole } from "../features/auth/server/authz.server";
import { requireUserSession } from "../features/auth/server/session.server";

export const taskSyncRouteTestHooks = {
  requireUserSessionImpl: requireUserSession,
  requireRoleImpl: requireRole,
  getTaskSyncEnvelopeImpl: getTaskSyncEnvelope,
};

export function setTaskSyncRouteTestHooks(
  hooks: Partial<typeof taskSyncRouteTestHooks>,
) {
  taskSyncRouteTestHooks.requireUserSessionImpl =
    hooks.requireUserSessionImpl ?? requireUserSession;
  taskSyncRouteTestHooks.requireRoleImpl =
    hooks.requireRoleImpl ?? requireRole;
  taskSyncRouteTestHooks.getTaskSyncEnvelopeImpl =
    hooks.getTaskSyncEnvelopeImpl ?? getTaskSyncEnvelope;
}

const defaultSseHeartbeatMs = 3_000;
const encoder = new TextEncoder();

function createSseHeaders(requestId: string) {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Request-Id": requestId,
  };
}

function createJsonHeaders(requestId: string) {
  return {
    "Cache-Control": "no-store",
    "X-Request-Id": requestId,
  };
}

function parseTransport(request: Request) {
  const transport =
    new URL(request.url).searchParams.get("transport") ?? "sse";

  return transport === "polling" ? "polling" : "sse";
}

function parseCursor(request: Request) {
  return new URL(request.url).searchParams.get("cursor");
}

function parseSelectedTaskId(request: Request) {
  return new URL(request.url).searchParams.get("taskId");
}

function parsePage(request: Request) {
  const page = Number(new URL(request.url).searchParams.get("page") ?? "1");

  return Number.isNaN(page) || page < 1 ? 1 : Math.floor(page);
}

function parsePageSize(request: Request) {
  const pageSize = Number(
    new URL(request.url).searchParams.get("pageSize") ?? "10",
  );

  return Number.isNaN(pageSize) || pageSize < 1 ? 10 : Math.floor(pageSize);
}

export async function loadTaskSyncResponse({
  request,
  context,
}: {
  request: Request;
  context: { requestId: string };
}) {
  const authenticated = await taskSyncRouteTestHooks.requireUserSessionImpl(
    request,
  );

  await taskSyncRouteTestHooks.requireRoleImpl(authenticated, "creator", {
    type: "workspace",
    id: "creator-home",
  });

  const transport = parseTransport(request);
  const cursor = parseCursor(request);
  const selectedTaskId = parseSelectedTaskId(request);
  const page = parsePage(request);
  const pageSize = parsePageSize(request);

  if (transport === "polling") {
    const payload = await taskSyncRouteTestHooks.getTaskSyncEnvelopeImpl({
      userId: authenticated.user.id,
      selectedTaskId,
      page,
      pageSize,
      cursor,
      transport: "polling",
      pollingIntervalMs: defaultTaskSyncPollingIntervalMs,
    });

    return Response.json(payload, {
      headers: createJsonHeaders(context.requestId),
    });
  }

  const stream = new ReadableStream({
    start(controller) {
      let active = true;
      let currentCursor = cursor;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const close = () => {
        active = false;

        if (timer) {
          clearTimeout(timer);
          timer = null;
        }

        controller.close();
      };

      const pump = async () => {
        if (!active) {
          return;
        }

        const payload = await taskSyncRouteTestHooks.getTaskSyncEnvelopeImpl({
          userId: authenticated.user.id,
          selectedTaskId,
          page,
          pageSize,
          cursor: currentCursor,
          transport: "sse",
          pollingIntervalMs: defaultTaskSyncPollingIntervalMs,
        });

        currentCursor = payload.cursor;

        controller.enqueue(encoder.encode(`retry: ${defaultTaskSyncSseRetryMs}\n`));
        controller.enqueue(
          encoder.encode(`: keep workspace task sync alive\n\n`),
        );

        if (payload.event) {
          controller.enqueue(encoder.encode(encodeTaskSyncSseEvent(payload.event)));
        }

        timer = setTimeout(() => {
          void pump();
        }, defaultSseHeartbeatMs);
      };

      request.signal.addEventListener("abort", close, { once: true });
      void pump().catch((error: unknown) => {
        if (active) {
          controller.error(error);
        }
      });
    },
  });

  return new Response(stream, {
    headers: createSseHeaders(context.requestId),
  });
}
