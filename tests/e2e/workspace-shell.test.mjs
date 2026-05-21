import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { loadTransformedModule } from "../helpers/load-ts-module.mjs";

const repoRoot = process.cwd();

const homeModulePromise = loadTransformedModule("app/routes/home.tsx", [
  [/import type { Route } from "\.\/\+types\/home";\n/, ""],
  [/import { WorkspaceShell } from "~\/shared\/ui\/WorkspaceShell";\n/, ""],
  [/export function meta\(\{\}: Route\.MetaArgs\)/, "export function meta()"],
  [
    /export async function loader\(\{ context \}: Route\.LoaderArgs\)/,
    "export async function loader({ context })",
  ],
  [/export default function Home\([\s\S]*$/, ""],
]);

function readText(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

test("workspace landing flow exposes the approved metadata and baseline loader payload", async () => {
  const homeModule = await homeModulePromise;

  assert.deepEqual(homeModule.meta(), [
    { title: "Yakimoji Workspace" },
    {
      name: "description",
      content:
        "Minimal React Router workspace shell aligned to the approved node-postgres starter.",
    },
  ]);

  const payload = await homeModule.loader({
    context: {
      releaseStage: "test",
      serviceName: "yakimoji",
    },
  });

  assert.equal(payload.runtime, "test");
  assert.equal(payload.serviceName, "yakimoji");
  assert.deepEqual(payload.pendingDomains, [
    "Creator login and protected workspace shell",
    "Manual task intake and source recognition",
    "Preset management and matching",
    "Review queue and deliverable access",
  ]);
  assert.equal(payload.boundaries.length, 3);
  assert.match(payload.boundaries[0], /Route-first application shell/);
  assert.match(payload.boundaries[1], /session, SSO, secrets and signed-download logic/);
  assert.match(payload.boundaries[2], /PostgreSQL \+ Drizzle migration chain configured/);
});

test("workspace shell copy exposes the visible dashboard affordances for the user journey", () => {
  const workspaceShell = readText("app/shared/ui/WorkspaceShell.tsx");

  assert.match(workspaceShell, /Workspace Baseline/);
  assert.match(workspaceShell, /Ready Boundaries/);
  assert.match(workspaceShell, /Pending Domains/);
  assert.match(workspaceShell, /Health path: \/health/);
  assert.match(workspaceShell, /Minimal dashboard shell aligned to the approved React Router/);
  assert.match(
    workspaceShell,
    /auth,\s+task orchestration, presets, review, and deliverables/,
  );
});

test("root document and error boundary preserve the baseline error experience", () => {
  const root = readText("app/root.tsx");
  const routes = readText("app/routes.ts");

  assert.match(root, /<html lang="zh-CN">/);
  assert.match(root, /Yakimoji workspace error/);
  assert.match(root, /The requested route does not exist\./);
  assert.match(routes, /index\("routes\/home\.tsx"\)/);
  assert.match(routes, /route\("health", "routes\/health\.tsx"\)/);
});
