import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { tasks } from "./tasks";

export const deliverables = pgTable(
  "deliverables",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    taskId: varchar("task_id", { length: 64 })
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 32 }).notNull(),
    fileName: varchar("file_name", { length: 320 }).notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("deliverables_task_id_idx").on(table.taskId),
    index("deliverables_task_id_kind_idx").on(table.taskId, table.kind),
    index("deliverables_task_id_status_idx").on(table.taskId, table.status),
  ],
);
