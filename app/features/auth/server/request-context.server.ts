import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type RequestContextValue = {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
};

const RequestContext = new AsyncLocalStorage<RequestContextValue>();

function getHeader(
  value: string | string[] | undefined,
): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function createRequestContext(headers: Record<string, string | string[] | undefined>) {
  return {
    requestId: getHeader(headers["x-request-id"]) ?? `req_${randomUUID().replace(/-/g, "")}`,
    ipAddress:
      getHeader(headers["x-forwarded-for"])?.split(",")[0]?.trim() ??
      getHeader(headers["x-real-ip"]) ??
      null,
    userAgent: getHeader(headers["user-agent"]),
  } satisfies RequestContextValue;
}

export function runWithRequestContext<T>(
  value: RequestContextValue,
  callback: () => T,
) {
  return RequestContext.run(value, callback);
}

export function getRequestContext() {
  const context = RequestContext.getStore();

  if (!context) {
    throw new Error("RequestContext not set");
  }

  return context;
}
