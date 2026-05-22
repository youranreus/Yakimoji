import { randomUUID } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";
import { createCookie, redirect } from "react-router";

import {
  sessions,
  ssoAccounts,
  userRoleAssignments,
  users,
  type AllowedRole,
} from "../../../../database/schema";
import { database } from "../../../../database/context";
import { getAuthEnvironment } from "../../../server/env.server";
import { getRequestContext } from "./request-context.server";
import { writeAuditLog } from "./audit.server";
import type { SsoUser } from "./sso-adapter.server";

const SESSION_COOKIE_NAME = "__Host-yakimoji_session";
const SSO_STATE_COOKIE_NAME = "__Host-yakimoji_sso";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12;

type SessionCookiePayload = {
  sessionId: string;
};

type SsoStatePayload = {
  state: string;
  verifier: string;
};

type UserRecord = typeof users.$inferSelect;
type SessionRecord = typeof sessions.$inferSelect;

export type AuthenticatedSession = {
  user: UserRecord;
  session: SessionRecord;
};

export const sessionTestHooks = {
  getOptionalUserSessionImpl: getOptionalUserSession,
  destroySessionImpl: destroySession,
  writeAuditLogImpl: writeAuditLog,
};

export function setSessionTestHooks(
  hooks: Partial<typeof sessionTestHooks>,
) {
  Object.assign(sessionTestHooks, hooks);
}

function secureCookie() {
  return getAuthEnvironment().cookieSecure;
}

function getSessionCookie() {
  return createCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: "lax",
    path: "/",
    secrets: [getAuthEnvironment().sessionSecret],
  });
}

function getSsoStateCookie() {
  return createCookie(SSO_STATE_COOKIE_NAME, {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: "lax",
    path: "/",
    secrets: [getAuthEnvironment().sessionSecret],
    maxAge: 60 * 10,
  });
}

function expirationDate() {
  return new Date(Date.now() + SESSION_DURATION_MS);
}

export async function createSsoStateCookie(payload: SsoStatePayload) {
  return getSsoStateCookie().serialize(payload);
}

export async function readSsoStateCookie(request: Request): Promise<SsoStatePayload | null> {
  return (await getSsoStateCookie().parse(request.headers.get("Cookie"))) ?? null;
}

export async function clearSsoStateCookie() {
  return getSsoStateCookie().serialize("", { maxAge: 0 });
}

export async function createAuthenticatedSession(userId: number) {
  const db = database();
  const requestContext = getRequestContext();
  const sessionId = `sess_${randomUUID().replace(/-/g, "")}`;
  const expiresAt = expirationDate();

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
    ipAddress: requestContext.ipAddress,
    userAgent: requestContext.userAgent,
  });

  return sessionId;
}

export async function commitSession(sessionId: string) {
  return getSessionCookie().serialize({ sessionId } satisfies SessionCookiePayload, {
    expires: expirationDate(),
  });
}

export async function destroySession(request: Request) {
  const payload = await getSessionCookie().parse(
    request.headers.get("Cookie"),
  ) as SessionCookiePayload | null;

  if (payload?.sessionId) {
    await invalidateSessionById(payload.sessionId);
  }

  return getSessionCookie().serialize("", { maxAge: 0 });
}

export async function readSessionIdFromRequest(request: Request) {
  const payload = (await getSessionCookie().parse(
    request.headers.get("Cookie"),
  )) as SessionCookiePayload | null;

  return payload?.sessionId ?? null;
}

export async function invalidateSessionById(sessionId: string) {
  const db = database();

  await db
    .update(sessions)
    .set({
      invalidatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));
}

export async function getOptionalUserSession(
  request: Request,
): Promise<AuthenticatedSession | null> {
  const sessionId = await readSessionIdFromRequest(request);

  if (!sessionId) {
    return null;
  }

  const db = database();

  const [record] = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, sessionId),
        isNull(sessions.invalidatedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!record) {
    return null;
  }

  await db
    .update(sessions)
    .set({
      lastSeenAt: new Date(),
      expiresAt: expirationDate(),
    })
    .where(eq(sessions.id, sessionId));

  return record;
}

export async function requireUserSession(request: Request) {
  const current = await getOptionalUserSession(request);

  if (current) {
    return current;
  }

  throw redirect("/login");
}

export async function upsertLocalUserFromSso(ssoUser: SsoUser) {
  const db = database();
  const [accountRecord] = await db
    .select({
      user: users,
      account: ssoAccounts,
    })
    .from(ssoAccounts)
    .innerJoin(users, eq(ssoAccounts.userId, users.id))
    .where(
      and(
        eq(ssoAccounts.provider, getAuthEnvironment().ssoProviderName),
        eq(ssoAccounts.providerUserId, ssoUser.providerUserId),
      ),
    )
    .limit(1);

  if (accountRecord) {
    await db
      .update(users)
      .set({
        displayName: ssoUser.displayName,
        email: ssoUser.email,
        updatedAt: new Date(),
      })
      .where(eq(users.id, accountRecord.user.id));

    await db
      .update(ssoAccounts)
      .set({
        providerRole: ssoUser.providerRole ?? null,
        profile: ssoUser.profile ?? {},
        updatedAt: new Date(),
      })
      .where(eq(ssoAccounts.id, accountRecord.account.id));

    return accountRecord.user.id;
  }

  const [insertedUser] = await db
    .insert(users)
    .values({
      displayName: ssoUser.displayName,
      email: ssoUser.email,
    })
    .returning({ id: users.id });

  await db.insert(ssoAccounts).values({
    userId: insertedUser.id,
    provider: getAuthEnvironment().ssoProviderName,
    providerUserId: ssoUser.providerUserId,
    providerRole: ssoUser.providerRole ?? null,
    profile: ssoUser.profile ?? {},
  });

  await db.insert(userRoleAssignments).values({
    userId: insertedUser.id,
    role: "creator",
    scopeType: "global",
    scopeId: "yakimoji",
    assignedBy: "sso-bootstrap",
  });

  await writeAuditLog({
    actorUserId: insertedUser.id,
    eventType: "authentication.provisioned",
    resourceType: "user",
    resourceId: String(insertedUser.id),
    outcome: "created",
    detail: {
      provider: getAuthEnvironment().ssoProviderName,
      providerUserId: ssoUser.providerUserId,
      providerRole: ssoUser.providerRole ?? null,
    },
  });

  return insertedUser.id;
}

export async function completeLoginFromSso(ssoUser: SsoUser) {
  const userId = await upsertLocalUserFromSso(ssoUser);
  const sessionId = await createAuthenticatedSession(userId);

  await writeAuditLog({
    actorUserId: userId,
    actorSessionId: sessionId,
    eventType: "authentication.login",
    resourceType: "session",
    resourceId: sessionId,
    outcome: "success",
    detail: {
      provider: getAuthEnvironment().ssoProviderName,
      providerUserId: ssoUser.providerUserId,
    },
  });

  return {
    sessionId,
    setCookieHeader: await commitSession(sessionId),
  };
}

export async function logoutCurrentSession(request: Request) {
  const current = await sessionTestHooks.getOptionalUserSessionImpl(request);
  const cookie = await sessionTestHooks.destroySessionImpl(request);

  if (current) {
    await sessionTestHooks.writeAuditLogImpl({
      actorUserId: current.user.id,
      actorSessionId: current.session.id,
      eventType: "authentication.logout",
      resourceType: "session",
      resourceId: current.session.id,
      outcome: "success",
      detail: {},
    });
  }

  return cookie;
}

export async function getCurrentUserRoles(userId: number): Promise<AllowedRole[]> {
  const db = database();
  const records = await db
    .select({ role: userRoleAssignments.role })
    .from(userRoleAssignments)
    .where(eq(userRoleAssignments.userId, userId));

  return records.map((record) => record.role as AllowedRole);
}
