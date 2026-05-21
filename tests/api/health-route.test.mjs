import test from "node:test";
import assert from "node:assert/strict";

import { loadTransformedModule } from "../helpers/load-ts-module.mjs";

const healthModulePromise = loadTransformedModule("app/routes/health.tsx", [
  [/export default function HealthRoute\(\) {[\s\S]*$/, ""],
]);

const envModulePromise = loadTransformedModule("app/server/env.server.ts", [
  [/type RuntimeEnvironment = {[\s\S]*?};\n\n/, ""],
  [/function getRequiredEnv\(name: string\)/, "function getRequiredEnv(name)"],
  [
    /export function getRuntimeEnvironment\(\): RuntimeEnvironment/,
    "export function getRuntimeEnvironment()",
  ],
  [/export function getDatabaseUrl\(\)/, "export function getDatabaseUrl()"],
]);

test("health API returns the starter baseline contract when the database URL is configured", async () => {
  const healthModule = await healthModulePromise;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/yakimoji";

  try {
    const response = await healthModule.loader();
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, {
      status: "ok",
      service: "yakimoji",
      databaseUrlConfigured: true,
      migrationDirectory: "drizzle",
    });
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  }
});

test("health API reports the missing database configuration without crashing the route", async () => {
  const healthModule = await healthModulePromise;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  delete process.env.DATABASE_URL;

  try {
    const response = await healthModule.loader();
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.databaseUrlConfigured, false);
    assert.equal(payload.status, "ok");
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
