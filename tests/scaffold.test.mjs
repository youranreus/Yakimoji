import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, filePath), "utf8"));
}

function readText(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

test("package.json aligns to the approved node-postgres starter baseline", () => {
  const pkg = readJson("package.json");

  assert.equal(pkg.private, true);
  assert.equal(pkg.type, "module");
  assert.equal(pkg.scripts.build, "react-router build");
  assert.equal(pkg.scripts["db:generate"], "dotenv -- drizzle-kit generate");
  assert.equal(pkg.scripts["db:migrate"], "dotenv -- drizzle-kit migrate");
  assert.equal(pkg.scripts.dev, "dotenv -- node server.js");
  assert.ok(pkg.dependencies["react-router"]);
  assert.ok(pkg.dependencies["postgres"]);
  assert.ok(pkg.dependencies["drizzle-orm"]);
  assert.ok(pkg.devDependencies["drizzle-kit"]);
  assert.ok(pkg.devDependencies["@react-router/dev"]);
});

test("route and server-only boundaries exist for the workspace shell", () => {
  const routes = readText("app/routes.ts");

  assert.match(routes, /index\("routes\/home\.tsx"\)/);
  assert.match(routes, /route\("health", "routes\/health\.tsx"\)/);
  assert.ok(fs.existsSync(path.join(repoRoot, "app/server/env.server.ts")));
  assert.ok(
    fs.existsSync(path.join(repoRoot, "app/features/auth/server/session.server.ts")),
  );
});

test("drizzle scaffold and feature boundaries are present without business implementation", () => {
  assert.ok(fs.existsSync(path.join(repoRoot, "drizzle.config.ts")));
  assert.ok(fs.existsSync(path.join(repoRoot, "database/context.ts")));
  assert.ok(fs.existsSync(path.join(repoRoot, "database/schema/index.ts")));
  assert.ok(fs.existsSync(path.join(repoRoot, "app/features/tasks/.gitkeep")));
  assert.ok(fs.existsSync(path.join(repoRoot, "app/features/presets/.gitkeep")));
  assert.ok(fs.existsSync(path.join(repoRoot, "app/features/reviews/.gitkeep")));
  assert.ok(fs.existsSync(path.join(repoRoot, "app/features/deliverables/.gitkeep")));
});

test("gitignore keeps build caches out of git without hiding drizzle migration artifacts", () => {
  const gitignore = readText(".gitignore");

  assert.match(gitignore, /^\.react-router$/m);
  assert.doesNotMatch(gitignore, /^\/drizzle\/\*\.sql$/m);
  assert.doesNotMatch(gitignore, /^\/drizzle\/meta$/m);
});
