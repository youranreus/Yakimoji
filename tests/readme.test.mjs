import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const readme = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf8");

test("README documents startup, migrations, env vars, and out-of-scope business areas", () => {
  assert.match(readme, /## Quick Start/);
  assert.match(readme, /## Database and Migrations/);
  assert.match(readme, /## Environment Variables/);
  assert.match(readme, /## Story 1\.1 Scope Boundaries/);
  assert.match(readme, /pnpm build/);
  assert.match(readme, /pnpm db:generate/);
  assert.match(readme, /pnpm db:migrate/);
  assert.match(readme, /pnpm start/);
  assert.match(readme, /外部模板抓取失败/);
  assert.doesNotMatch(readme, /GitHub 模板抓取阶段返回了 `403`/);
  assert.match(readme, /auth/i);
  assert.match(readme, /deliverable/i);
});
