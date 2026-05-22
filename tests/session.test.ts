import assert from "node:assert/strict";
import test from "node:test";

import {
  commitSession,
  createSsoStateCookie,
  logoutCurrentSession,
  readSsoStateCookie,
  setSessionTestHooks,
} from "../app/features/auth/server/session.server";

const originalEnv = { ...process.env };

function installAuthEnv() {
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "test-session-secret";
  process.env.SSO_BASE_URL = "https://sso.example.com";
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

  assert.match(setCookie, /__Host-yakimoji_session=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\//i);
  assert.doesNotMatch(setCookie, /access_token/i);
});

test("SSO state cookie round-trips verifier data without exposing it to the page", async () => {
  const setCookie = await createSsoStateCookie({
    state: "state-token",
    verifier: "verifier-token",
  });
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
      "__Host-yakimoji_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
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
