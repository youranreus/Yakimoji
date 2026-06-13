import { eq } from "drizzle-orm";
import { data } from "react-router";

import { userRoleAssignments, type AllowedRole } from "../../../../database/schema";
import { database } from "../../../../database/context";
import { getRequestContext } from "./request-context.server";
import { writeAuditLog } from "./audit.server";
import type { AuthenticatedSession } from "./session.server";

export let getUserRolesImpl: typeof getUserRoles = getUserRoles;
export let writeAuditLogImpl: typeof writeAuditLog = writeAuditLog;

export function setAuthzTestHooks(hooks: {
  getUserRolesImpl?: typeof getUserRoles;
  writeAuditLogImpl?: typeof writeAuditLog;
}) {
  getUserRolesImpl = hooks.getUserRolesImpl ?? getUserRoles;
  writeAuditLogImpl = hooks.writeAuditLogImpl ?? writeAuditLog;
}

export async function getUserRoles(userId: number): Promise<AllowedRole[]> {
  const db = database();
  const records = await db
    .select({ role: userRoleAssignments.role })
    .from(userRoleAssignments)
    .where(eq(userRoleAssignments.userId, userId));

  return records.map((record) => record.role as AllowedRole);
}

export async function requireRole(
  authenticatedSession: AuthenticatedSession,
  role: AllowedRole,
  resource: { type: string; id: string },
) {
  const roles = await getUserRolesImpl(authenticatedSession.user.id);

  if (roles.includes(role)) {
    return roles;
  }

  const { requestId } = getRequestContext();

  await writeAuditLogImpl({
    actorUserId: authenticatedSession.user.id,
    actorSessionId: authenticatedSession.session.id,
    eventType: "authorization.denied",
    resourceType: resource.type,
    resourceId: resource.id,
    outcome: "forbidden",
    detail: {
      requiredRole: role,
      actualRoles: roles,
    },
  });

  throw data(
    {
      code: "forbidden",
      message: "当前账号没有访问该工作区的权限。",
      request_id: requestId,
    },
    {
      status: 403,
      headers: {
        "X-Request-Id": requestId,
      },
    },
  );
}

export async function requireAnyRole(
  authenticatedSession: AuthenticatedSession,
  rolesToAllow: AllowedRole[],
  resource: { type: string; id: string },
) {
  const roles = await getUserRolesImpl(authenticatedSession.user.id);

  if (rolesToAllow.some((role) => roles.includes(role))) {
    return roles;
  }

  const { requestId } = getRequestContext();

  await writeAuditLogImpl({
    actorUserId: authenticatedSession.user.id,
    actorSessionId: authenticatedSession.session.id,
    eventType: "authorization.denied",
    resourceType: resource.type,
    resourceId: resource.id,
    outcome: "forbidden",
    detail: {
      requiredAnyRole: rolesToAllow,
      actualRoles: roles,
    },
  });

  throw data(
    {
      code: "forbidden",
      message: "当前账号没有访问该工作区的权限。",
      request_id: requestId,
    },
    {
      status: 403,
      headers: {
        "X-Request-Id": requestId,
      },
    },
  );
}
