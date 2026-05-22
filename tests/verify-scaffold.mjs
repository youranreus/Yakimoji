import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const requiredFiles = [
  "package.json",
  ".env.example",
  "react-router.config.ts",
  "drizzle.config.ts",
  "server.js",
  "server/app.ts",
  "app/root.tsx",
  "app/routes.ts",
  "app/routes/home.tsx",
  "app/routes/login.tsx",
  "app/routes/auth.callback.tsx",
  "app/routes/logout.tsx",
  "app/routes/workspace.tsx",
  "app/routes/health.tsx",
  "app/server/env.server.ts",
  "app/features/auth/server/auth-flow.server.ts",
  "app/features/auth/server/authz.server.ts",
  "app/features/auth/server/request-context.server.ts",
  "app/features/auth/server/sso-adapter.server.ts",
  "database/context.ts",
  "database/schema/index.ts",
  "database/schema/auth.ts",
  "database/schema/health.ts",
];

const missingFiles = requiredFiles.filter(
  (filePath) => !fs.existsSync(path.join(repoRoot, filePath)),
);

if (missingFiles.length > 0) {
  console.error("Missing scaffold files:");
  for (const filePath of missingFiles) {
    console.error(`- ${filePath}`);
  }
  process.exit(1);
}

console.log("Yakimoji starter scaffold verification passed.");
console.log("Validated files:");
for (const filePath of requiredFiles) {
  console.log(`- ${filePath}`);
}
