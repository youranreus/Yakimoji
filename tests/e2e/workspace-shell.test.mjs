import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { loadTransformedModule } from "../helpers/load-ts-module.mjs";

const repoRoot = process.cwd();

const homeModulePromise = loadTransformedModule("app/routes/home.tsx", [
  [/import type { Route } from "\.\/\+types\/home";\n/, ""],
  [/import { getOptionalUserSession } from "~\/features\/auth\/server\/session\.server";\n/, "const getOptionalUserSession = async () => null;\n"],
  [
    /export async function loader\(\{ request \}: Route\.LoaderArgs\)/,
    "export async function loader({ request })",
  ],
  [/export default function Home\([\s\S]*$/, ""],
]);

function readText(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

test("workspace landing flow redirects anonymous users into the protected login entry", async () => {
  const homeModule = await homeModulePromise;
  const response = await homeModule.loader({
    request: new Request("http://localhost:3000/"),
  });

  assert.ok(response instanceof Response);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), "http://localhost:3000/login");
});

test("workspace shell copy exposes the visible dashboard affordances for the user journey", () => {
  const workspaceShell = readText("app/shared/ui/WorkspaceShell.tsx");

  assert.match(workspaceShell, /Protected Workspace/);
  assert.match(workspaceShell, /Global Navigation/);
  assert.match(workspaceShell, /Main Content/);
  assert.match(workspaceShell, /任务导入/);
  assert.match(workspaceShell, /YouTube Link/);
  assert.match(workspaceShell, /Video Upload/);
  assert.match(workspaceShell, /最近创建任务/);
  assert.match(workspaceShell, /request_id:/);
  assert.match(workspaceShell, /HttpOnly 的 Yakimoji session cookie/);
  assert.match(workspaceShell, /SSO 只负责身份认证/);
});

test("root document and error boundary preserve the baseline error experience", () => {
  const root = readText("app/root.tsx");
  const routes = readText("app/routes.ts");

  assert.match(root, /<html lang="zh-CN">/);
  assert.match(root, /Yakimoji workspace error/);
  assert.match(root, /The requested route does not exist\./);
  assert.match(routes, /route\("login", "routes\/login\.tsx"\)/);
  assert.match(routes, /route\("workspace", "routes\/workspace\.tsx"\)/);
  assert.match(routes, /route\("health", "routes\/health\.tsx"\)/);
});
