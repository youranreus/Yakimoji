import { createRequestHandler } from "@react-router/express";
import { drizzle } from "drizzle-orm/postgres-js";
import express from "express";
import postgres from "postgres";
import "react-router";

import { getDatabaseUrl, getRuntimeEnvironment } from "~/server/env.server";
import { DatabaseContext } from "~/database/context";
import * as schema from "~/database/schema/index";

declare module "react-router" {
  interface AppLoadContext {
    releaseStage: string;
    serviceName: string;
  }
}

export const app = express();

const runtimeEnvironment = getRuntimeEnvironment();
const db = runtimeEnvironment.databaseUrl
  ? drizzle(postgres(getDatabaseUrl()), { schema })
  : null;

if (db) {
  app.use((_, __, next) => DatabaseContext.run(db, next));
}
app.use(
  createRequestHandler({
    build: () => import("virtual:react-router/server-build"),
    getLoadContext() {
      return {
        releaseStage: runtimeEnvironment.nodeEnv,
        serviceName: "yakimoji",
      };
    },
  }),
);
