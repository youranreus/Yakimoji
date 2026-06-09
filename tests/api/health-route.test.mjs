import test from "node:test";
import assert from "node:assert/strict";

import { loadTransformedModule } from "../helpers/load-ts-module.mjs";

const healthModulePromise = loadTransformedModule("app/routes/health.tsx", [
  [/export default function HealthRoute\(\) {[\s\S]*$/, ""],
]);

const envModulePromise = loadTransformedModule("app/server/env.server.ts", [
  [/type RuntimeEnvironment = {[\s\S]*?};\n\n/, ""],
  [/export type AuthEnvironment = {[\s\S]*?};\n\n/, ""],
  [/export type SessionEnvironment = {[\s\S]*?};\n\n/, ""],
  [/export type ApiCredentialEnvironment = {[\s\S]*?};\n\n/, ""],
  [/function getRequiredEnv\(name: string\)/, "function getRequiredEnv(name)"],
  [
    /export function getRuntimeEnvironment\(\): RuntimeEnvironment/,
    "export function getRuntimeEnvironment()",
  ],
  [/export function getDatabaseUrl\(\)/, "export function getDatabaseUrl()"],
  [/export function getAuthEnvironment\(\): AuthEnvironment/, "export function getAuthEnvironment()"],
  [/export function getSessionEnvironment\(\): SessionEnvironment/, "export function getSessionEnvironment()"],
  [
    /export function getApiCredentialEnvironment\(\): ApiCredentialEnvironment/,
    "export function getApiCredentialEnvironment()",
  ],
]);

test("health API returns the minimal public health contract", async () => {
  const healthModule = await healthModulePromise;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/yakimoji";

  try {
    const response = await healthModule.loader();
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, {
      status: "ok",
    });
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  }
});

test("health API keeps the same minimal response when database configuration is missing", async () => {
  const healthModule = await healthModulePromise;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  delete process.env.DATABASE_URL;

  try {
    const response = await healthModule.loader();
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, {
      status: "ok",
    });
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  }
});

test("server runtime environment loader keeps startup metadata available when DATABASE_URL is missing", async () => {
  const envModule = await envModulePromise;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  delete process.env.DATABASE_URL;
  delete process.env.NODE_ENV;

  try {
    assert.deepEqual(envModule.getRuntimeEnvironment(), {
      nodeEnv: "development",
      databaseUrl: undefined,
    });
    assert.throws(() => envModule.getDatabaseUrl(), /DATABASE_URL is required/);
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }
});

test("server runtime environment loader defaults NODE_ENV to development", async () => {
  const envModule = await envModulePromise;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/yakimoji";
  delete process.env.NODE_ENV;

  try {
    assert.deepEqual(envModule.getRuntimeEnvironment(), {
      nodeEnv: "development",
      databaseUrl: "postgres://postgres:postgres@localhost:5432/yakimoji",
    });
    assert.equal(
      envModule.getDatabaseUrl(),
      "postgres://postgres:postgres@localhost:5432/yakimoji",
    );
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }
});

test("session environment loads without requiring SSO client settings", async () => {
  const envModule = await envModulePromise;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSessionSecret = process.env.SESSION_SECRET;
  const originalSsoBaseUrl = process.env.SSO_BASE_URL;
  const originalSsoClientId = process.env.SSO_CLIENT_ID;
  const originalSsoClientSecret = process.env.SSO_CLIENT_SECRET;
  const originalSsoCallbackUrl = process.env.SSO_CALLBACK_URL;

  process.env.NODE_ENV = "development";
  process.env.SESSION_SECRET = "session-only-secret";
  delete process.env.SSO_BASE_URL;
  delete process.env.SSO_CLIENT_ID;
  delete process.env.SSO_CLIENT_SECRET;
  delete process.env.SSO_CALLBACK_URL;

  try {
    assert.deepEqual(envModule.getSessionEnvironment(), {
      sessionSecret: "session-only-secret",
      cookieSecure: false,
    });
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSessionSecret;
    if (originalSsoBaseUrl === undefined) delete process.env.SSO_BASE_URL;
    else process.env.SSO_BASE_URL = originalSsoBaseUrl;
    if (originalSsoClientId === undefined) delete process.env.SSO_CLIENT_ID;
    else process.env.SSO_CLIENT_ID = originalSsoClientId;
    if (originalSsoClientSecret === undefined) delete process.env.SSO_CLIENT_SECRET;
    else process.env.SSO_CLIENT_SECRET = originalSsoClientSecret;
    if (originalSsoCallbackUrl === undefined) delete process.env.SSO_CALLBACK_URL;
    else process.env.SSO_CALLBACK_URL = originalSsoCallbackUrl;
  }
});

test("auth environment supports a dedicated SSO API base URL and falls back when omitted", async () => {
  const envModule = await envModulePromise;
  const originalSsoBaseUrl = process.env.SSO_BASE_URL;
  const originalSsoApiBaseUrl = process.env.SSO_API_BASE_URL;
  const originalSsoClientId = process.env.SSO_CLIENT_ID;
  const originalSsoClientSecret = process.env.SSO_CLIENT_SECRET;
  const originalSsoCallbackUrl = process.env.SSO_CALLBACK_URL;
  const originalSsoProviderName = process.env.SSO_PROVIDER_NAME;

  process.env.SSO_BASE_URL = "https://sso.example.com";
  process.env.SSO_CLIENT_ID = "yakimoji-web";
  process.env.SSO_CLIENT_SECRET = "super-secret";
  process.env.SSO_CALLBACK_URL = "http://localhost:3000/auth/callback";
  process.env.SSO_PROVIDER_NAME = "yakimoji-sso";
  process.env.SSO_API_BASE_URL = "https://sso-api.example.com";

  try {
    assert.deepEqual(envModule.getAuthEnvironment(), {
      ssoBaseUrl: "https://sso.example.com",
      ssoApiBaseUrl: "https://sso-api.example.com",
      ssoClientId: "yakimoji-web",
      ssoClientSecret: "super-secret",
      ssoCallbackUrl: "http://localhost:3000/auth/callback",
      ssoProviderName: "yakimoji-sso",
    });

    delete process.env.SSO_API_BASE_URL;

    assert.deepEqual(envModule.getAuthEnvironment(), {
      ssoBaseUrl: "https://sso.example.com",
      ssoApiBaseUrl: "https://sso.example.com",
      ssoClientId: "yakimoji-web",
      ssoClientSecret: "super-secret",
      ssoCallbackUrl: "http://localhost:3000/auth/callback",
      ssoProviderName: "yakimoji-sso",
    });
  } finally {
    if (originalSsoBaseUrl === undefined) delete process.env.SSO_BASE_URL;
    else process.env.SSO_BASE_URL = originalSsoBaseUrl;
    if (originalSsoApiBaseUrl === undefined) delete process.env.SSO_API_BASE_URL;
    else process.env.SSO_API_BASE_URL = originalSsoApiBaseUrl;
    if (originalSsoClientId === undefined) delete process.env.SSO_CLIENT_ID;
    else process.env.SSO_CLIENT_ID = originalSsoClientId;
    if (originalSsoClientSecret === undefined) delete process.env.SSO_CLIENT_SECRET;
    else process.env.SSO_CLIENT_SECRET = originalSsoClientSecret;
    if (originalSsoCallbackUrl === undefined) delete process.env.SSO_CALLBACK_URL;
    else process.env.SSO_CALLBACK_URL = originalSsoCallbackUrl;
    if (originalSsoProviderName === undefined) delete process.env.SSO_PROVIDER_NAME;
    else process.env.SSO_PROVIDER_NAME = originalSsoProviderName;
  }
});
