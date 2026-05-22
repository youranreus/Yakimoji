import { auditLogs } from "../../../../database/schema";
import { database } from "../../../../database/context";
import { getRequestContext } from "./request-context.server";

export type AuditEventInput = {
  actorUserId?: number | null;
  actorSessionId?: string | null;
  eventType: string;
  resourceType: string;
  resourceId: string;
  outcome: string;
  detail?: Record<string, unknown>;
};

export async function writeAuditLog(input: AuditEventInput) {
  const db = database();
  const requestContext = getRequestContext();

  await db.insert(auditLogs).values({
    requestId: requestContext.requestId,
    actorUserId: input.actorUserId ?? null,
    actorSessionId: input.actorSessionId ?? null,
    eventType: input.eventType,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    outcome: input.outcome,
    detail: input.detail ?? {},
  });
}
