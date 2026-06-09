import assert from "node:assert/strict";
import test from "node:test";

import {
  commitSession,
  createSsoStateCookie,
  logoutCurrentSession,
  readSsoStateCookie,
  setSessionTestHooks,
  upsertLocalUserFromSso,
} from "../app/features/auth/server/session.server";
import { createRequestContext, runWithRequestContext } from "../app/features/auth/server/request-context.server";
import { DatabaseContext } from "../database/context";

const originalEnv = { ...process.env };

function installAuthEnv() {
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "test-session-secret";
  process.env.SSO_BASE_URL = "https://sso.example.com";
  process.env.SSO_API_BASE_URL = "https://sso-api.example.com";
  process.env.SSO_CLIENT_ID = "yakimoji-web";
  process.env.SSO_CLIENT_SECRET = "super-secret";
  process.env.SSO_CALLBACK_URL = "http://localhost:3000/auth/callback";
}

test.before(() => {
  installAuthEnv();
});

test.after(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

test("session cookie uses secure server-side storage semantics", async () => {
  const setCookie = await commitSession("sess_test_cookie");

  assert.match(setCookie, /yakimoji_session=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\//i);
  assert.doesNotMatch(setCookie, /Secure/i);
  assert.doesNotMatch(setCookie, /access_token/i);
});

test("SSO state cookie round-trips verifier data without exposing it to the page", async () => {
  const setCookie = await createSsoStateCookie({
    state: "state-token",
    verifier: "verifier-token",
  });

  assert.match(setCookie, /yakimoji_sso=/);
  assert.doesNotMatch(setCookie, /__Host-yakimoji_sso=/);

  const request = new Request("http://localhost/login", {
    headers: {
      Cookie: setCookie,
    },
  });

  const payload = await readSsoStateCookie(request);

  assert.deepEqual(payload, {
    state: "state-token",
    verifier: "verifier-token",
  });
});

test("logout invalidates the current session and clears the cookie", async () => {
  const auditCalls: Array<Record<string, unknown>> = [];

  setSessionTestHooks({
    getOptionalUserSessionImpl: async () => ({
      user: {
        id: 7,
        displayName: "Creator",
        email: "creator@example.com",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "sess_7",
        userId: 7,
        expiresAt: new Date(),
        lastSeenAt: new Date(),
        invalidatedAt: null,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
      },
    }),
    destroySessionImpl: async () =>
      "yakimoji_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
    writeAuditLogImpl: async (payload) => {
      auditCalls.push(payload);
    },
  });

  try {
    const header = await logoutCurrentSession(new Request("http://localhost/logout"));

    assert.match(header, /Max-Age=0/);
    assert.equal(auditCalls.length, 1);
    assert.equal(auditCalls[0]?.eventType, "authentication.logout");
  } finally {
    setSessionTestHooks({});
  }
});

test("session cookie creation does not require SSO client environment variables", async () => {
  delete process.env.SSO_BASE_URL;
  delete process.env.SSO_API_BASE_URL;
  delete process.env.SSO_CLIENT_ID;
  delete process.env.SSO_CLIENT_SECRET;
  delete process.env.SSO_CALLBACK_URL;

  try {
    const setCookie = await commitSession("sess_public_route");
    assert.match(setCookie, /yakimoji_session=/);
  } finally {
    installAuthEnv();
  }
});

test("production session cookie uses the __Host- prefix and Secure", async () => {
  const originalNodeEnv = process.env.NODE_ENV;

  process.env.NODE_ENV = "production";

  try {
    const setCookie = await commitSession("sess_prod_cookie");

    assert.match(setCookie, /__Host-yakimoji_session=/);
    assert.match(setCookie, /Secure/i);
  } finally {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }
});

test("new non-admin SSO users are not auto-granted creator access unless bootstrap is explicitly enabled", async () => {
  delete process.env.AUTH_BOOTSTRAP_ROLE;

  const inserts: Array<{ table: string; values: unknown }> = [];
  const tableNameSymbol = Symbol.for("drizzle:Name");
  const fakeDb = {
    select() {
      return {
        from() {
          return {
            innerJoin() {
              return {
                where() {
                  return {
                    limit: async () => [],
                  };
                },
              };
            },
          };
        },
      };
    },
    insert(table: Record<PropertyKey, unknown>) {
      return {
        values(values: unknown) {
          inserts.push({
            table: typeof table[tableNameSymbol] === "string" ? String(table[tableNameSymbol]) : "unknown",
            values,
          });
          return {
            returning: async () => [{ id: 101 }],
          };
        },
      };
    },
  };

  try {
    await runWithRequestContext(createRequestContext({}), async () => {
      await DatabaseContext.run(fakeDb as never, async () => {
        await assert.rejects(
          upsertLocalUserFromSso({
            providerUserId: "sso-user-1",
            email: "creator@example.com",
            displayName: "Creator",
            providerRole: "0",
          }),
          (error: unknown) =>
            error?.constructor?.name === "DataWithResponseInit" &&
            (error as { init?: { status?: number } }).init?.status === 403,
        );
      });
    });
  } finally {
    installAuthEnv();
  }

  assert.equal(inserts.some((entry) => entry.table === "user_role_assignments"), false);
});

test("new admin SSO users inherit creator access from provider role", async () => {
  delete process.env.AUTH_BOOTSTRAP_ROLE;

  const inserts: Array<{ table: string; values: unknown }> = [];
  const tableNameSymbol = Symbol.for("drizzle:Name");
  const fakeDb = {
    select() {
      return {
        from() {
          return {
            innerJoin() {
              return {
                where() {
                  return {
                    limit: async () => [],
                  };
                },
              };
            },
            where() {
              return {
                limit: async () => [],
              };
            },
          };
        },
      };
    },
    insert(table: Record<PropertyKey, unknown>) {
      return {
        values(values: unknown) {
          inserts.push({
            table: typeof table[tableNameSymbol] === "string" ? String(table[tableNameSymbol]) : "unknown",
            values,
          });
          return {
            returning: async () => [{ id: 101 }],
          };
        },
      };
    },
  };

  await runWithRequestContext(createRequestContext({}), async () => {
    await DatabaseContext.run(fakeDb as never, async () => {
      const userId = await upsertLocalUserFromSso({
        providerUserId: "sso-admin-1",
        email: "admin@example.com",
        displayName: "Admin",
        providerRole: "1",
      });

      assert.equal(userId, 101);
    });
  });

  assert.equal(
    inserts.some(
      (entry) =>
        entry.table === "user_role_assignments" &&
        (entry.values as { assignedBy?: string }).assignedBy === "sso-provider-role",
    ),
    true,
  );
});
