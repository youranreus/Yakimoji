import assert from "node:assert/strict";
import test from "node:test";

import { createRequestContext, runWithRequestContext } from "../app/features/auth/server/request-context.server";
import {
  beginSsoLogin,
  handleSsoCallback,
  setAuthFlowTestHooks,
} from "../app/features/auth/server/auth-flow.server";
import {
  requireRole,
  setAuthzTestHooks,
} from "../app/features/auth/server/authz.server";

const originalEnv = { ...process.env };

function installAuthEnv() {
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "test-session-secret";
  process.env.SSO_BASE_URL = "https://sso.example.com";
  process.env.SSO_CLIENT_ID = "yakimoji-web";
  process.env.SSO_CLIENT_SECRET = "super-secret";
  process.env.SSO_CALLBACK_URL = "http://localhost:3000/auth/callback";
  process.env.SSO_PROVIDER_NAME = "yakimoji-sso";
}

function restoreEnv() {
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
}

test.beforeEach(() => {
  installAuthEnv();
});

test.after(() => {
  restoreEnv();
});

test("protected login flow redirects to the upstream authorize endpoint and stores signed SSO state", async () => {
  await runWithRequestContext(createRequestContext({}), async () => {
    try {
      await beginSsoLogin();
      assert.fail("expected redirect");
    } catch (error) {
      assert.ok(error instanceof Response);
      assert.equal(error.status, 302);

      const location = error.headers.get("Location");
      const setCookie = error.headers.get("Set-Cookie");

      assert.ok(location);
      assert.match(location, /^https:\/\/sso\.example\.com\/oauth\/authorize\?/);
      assert.match(location, /client_id=yakimoji-web/);
      assert.match(location, /redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback/);
      assert.ok(setCookie);
      assert.match(setCookie, /__Host-yakimoji_sso=/);
      assert.match(setCookie, /HttpOnly/i);
    }
  });
});

test("SSO callback establishes only Yakimoji session state and redirects into /workspace", async () => {
  installAuthEnv();
  const encodedState = Buffer.from(
    JSON.stringify({
      nonce: "nonce-1",
      requestedAt: new Date().toISOString(),
    }),
    "utf8",
  ).toString("base64url");

  const request = new Request(
    `http://localhost:3000/auth/callback?code=oauth-code&state=${encodedState}`,
    {
      headers: {
        Cookie: "__Host-yakimoji_sso=mocked-cookie",
      },
    },
  );

  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith("/oauth/token")) {
      return Response.json({
        accessToken: "upstream-token",
      });
    }

    if (url.endsWith("/oauth/user")) {
      return Response.json({
        id: "provider-user-1",
        email: "creator@example.com",
        display_name: "Yakimoji Creator",
        role: 1,
      });
    }

    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;

  setAuthFlowTestHooks({
    readSsoStateCookieImpl: async () => ({
      state: encodedState,
      verifier: "verifier-token",
    }),
    completeLoginFromSsoImpl: async (user) => {
      assert.equal(user.email, "creator@example.com");

      return {
        sessionId: "sess_123",
        setCookieHeader:
          "__Host-yakimoji_session=signed-session; Path=/; HttpOnly; SameSite=Lax",
      };
    },
    clearSsoStateCookieImpl: async () =>
      "__Host-yakimoji_sso=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
  });

  try {
    await runWithRequestContext(createRequestContext({}), async () => {
      try {
        await handleSsoCallback(request);
        assert.fail("expected redirect");
      } catch (error) {
        assert.ok(error instanceof Response);
        assert.equal(error.status, 302);
        assert.equal(error.headers.get("Location"), "/workspace");

        const setCookies = error.headers.getSetCookie();
        assert.equal(setCookies.length, 2);
        assert.match(setCookies[0] ?? "", /__Host-yakimoji_session=/);
        assert.match(setCookies[1] ?? "", /__Host-yakimoji_sso=;/);
        assert.doesNotMatch(setCookies.join("\n"), /upstream-token/);
        assert.equal(error.headers.get("X-Request-Id")?.startsWith("req_"), true);
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
    setAuthFlowTestHooks({});
  }
});

test("SSO callback failures return structured responses with request_id", async () => {
  const request = new Request("http://localhost:3000/auth/callback?code=oauth-code&state=bad-state", {
    headers: {
      Cookie: "__Host-yakimoji_sso=mocked-cookie",
      "x-request-id": "req_auth_failure",
    },
  });

  setAuthFlowTestHooks({
    readSsoStateCookieImpl: async () => ({
      state: "different-state",
      verifier: "verifier-token",
    }),
  });

  try {
    await runWithRequestContext(
      createRequestContext({
        "x-request-id": "req_auth_failure",
      }),
      async () => {
        try {
          await handleSsoCallback(request);
          assert.fail("expected callback failure");
        } catch (error) {
          assert.equal(error?.constructor?.name, "DataWithResponseInit");
          assert.equal(error.init.status, 401);
          assert.equal(error.data.request_id, "req_auth_failure");
          assert.match(error.data.message, /state/i);
          assert.equal(error.init.headers["X-Request-Id"], "req_auth_failure");
        }
      },
    );
  } finally {
    setAuthFlowTestHooks({});
  }
});

test("RBAC deny path returns 403 with request_id in the response envelope", async () => {
  const auditCalls: Array<Record<string, unknown>> = [];

  setAuthzTestHooks({
    getUserRolesImpl: async () => ["support"],
    writeAuditLogImpl: async (payload) => {
      auditCalls.push(payload);
    },
  });

  try {
    await runWithRequestContext(
      createRequestContext({
        "x-request-id": "req_test_forbidden",
      }),
      async () => {
        try {
          await requireRole(
            {
              user: {
                id: 42,
                displayName: "No Creator",
                email: "support@example.com",
                status: "active",
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              session: {
                id: "sess_42",
                userId: 42,
                expiresAt: new Date(Date.now() + 1_000),
                lastSeenAt: new Date(),
                invalidatedAt: null,
                ipAddress: null,
                userAgent: null,
                createdAt: new Date(),
              },
            },
            "creator",
            { type: "workspace", id: "creator-home" },
          );
          assert.fail("expected authz denial");
        } catch (error) {
          assert.equal(error?.constructor?.name, "DataWithResponseInit");
          assert.equal(error.init.status, 403);
          assert.equal(error.data.request_id, "req_test_forbidden");
          assert.equal(error.init.headers["X-Request-Id"], "req_test_forbidden");
        }
      },
    );

    assert.equal(auditCalls.length, 1);
    assert.equal(auditCalls[0]?.eventType, "authorization.denied");
  } finally {
    setAuthzTestHooks({});
  }
});
