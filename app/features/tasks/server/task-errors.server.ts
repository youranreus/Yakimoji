import { data } from "react-router";

import { getRequestContext } from "../../auth/server/request-context.server";

export type TaskErrorCode =
  | "invalid_intake"
  | "invalid_youtube_url"
  | "invalid_upload"
  | "unsupported_media_type"
  | "upload_failed"
  | "source_recognition_failed"
  | "manual_resolution_invalid"
  | "confirmation_failed"
  | "review_submission_invalid"
  | "retry_unavailable";

export type TaskActionError = {
  ok: false;
  code: TaskErrorCode;
  message: string;
  field?: string;
  retryable?: boolean;
  request_id: string;
};

export function createTaskActionError(
  code: TaskErrorCode,
  message: string,
  options: {
    field?: string;
    retryable?: boolean;
    status?: number;
  } = {},
) {
  const { requestId } = getRequestContext();

  const payload: TaskActionError = {
    ok: false,
    code,
    message,
    field: options.field,
    retryable: options.retryable ?? false,
    request_id: requestId,
  };

  return data(payload, {
    status: options.status ?? 400,
    headers: {
      "X-Request-Id": requestId,
    },
  });
}
