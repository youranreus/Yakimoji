import { createRequestHandler } from "@react-router/express";
import { drizzle } from "drizzle-orm/postgres-js";
import express from "express";
import postgres from "postgres";
import "react-router";

import { getDatabaseUrl, getRuntimeEnvironment } from "~/server/env.server";
import { DatabaseContext } from "~/database/context";
import * as schema from "~/database/schema/index";
import {
  createRequestContext,
  getRequestContext,
  runWithRequestContext,
} from "~/features/auth/server/request-context.server";

declare module "react-router" {
  interface AppLoadContext {
    releaseStage: string;
    serviceName: string;
    requestId: string;
  }
}

export const app = express();

const runtimeEnvironment = getRuntimeEnvironment();
const db = runtimeEnvironment.databaseUrl
  ? drizzle(postgres(getDatabaseUrl()), { schema })
  : null;

app.use((req, _res, next) =>
  runWithRequestContext(createRequestContext(req.headers), () => {
    if (!db) {
      next();
      return;
    }

    DatabaseContext.run(db, next);
  }),
);

app.use(
  createRequestHandler({
    build: () => import("virtual:react-router/server-build"),
    getLoadContext() {
      const requestContext = getRequestContext();
      return {
        releaseStage: runtimeEnvironment.nodeEnv,
        serviceName: "yakimoji",
        requestId: requestContext.requestId,
      };
    },
  }),
);
