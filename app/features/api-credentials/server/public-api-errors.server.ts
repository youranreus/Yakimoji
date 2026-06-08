import { data } from "react-router";

import { getRequestContext } from "../../auth/server/request-context.server";

export type PublicApiErrorPayload = {
  request_id: string;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
};

export function createPublicApiError(
  code: string,
  message: string,
  options: {
    status: number;
    details?: Record<string, unknown>;
  },
) {
  const { requestId } = getRequestContext();

  return data(
    {
      request_id: requestId,
      error: {
        code,
        message,
        details: options.details ?? {},
      },
    } satisfies PublicApiErrorPayload,
    {
      status: options.status,
      headers: {
        "X-Request-Id": requestId,
      },
    },
  );
}

export function throwPublicApiError(
  code: string,
  message: string,
  options: {
    status: number;
    details?: Record<string, unknown>;
  },
): never {
  throw createPublicApiError(code, message, options);
}
