import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { tasks } from "./tasks";

export const taskEvents = pgTable(
  "task_events",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    taskId: varchar("task_id", { length: 64 })
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    fromStatus: varchar("from_status", { length: 32 }).notNull(),
    toStatus: varchar("to_status", { length: 32 }).notNull(),
    reasonCode: varchar("reason_code", { length: 128 }),
    requestId: varchar("request_id", { length: 64 }).notNull(),
    actorUserId: integer("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("task_events_task_id_idx").on(table.taskId),
    index("task_events_event_type_idx").on(table.eventType),
    index("task_events_request_id_idx").on(table.requestId),
    index("task_events_created_at_idx").on(table.createdAt),
  ],
);
