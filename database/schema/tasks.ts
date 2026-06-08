import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { apiCredentials, users } from "./auth";
import { channelPresets } from "./channel-presets";

export const tasks = pgTable(
  "tasks",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    creatorUserId: integer("creator_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    apiCredentialId: varchar("api_credential_id", { length: 64 }).references(
      () => apiCredentials.id,
      { onDelete: "set null" },
    ),
    intakeMethod: varchar("intake_method", { length: 32 }).notNull(),
    sourceUrl: text("source_url"),
    sourceIdentifier: varchar("source_identifier", { length: 320 }).notNull(),
    sourceSnapshot: jsonb("source_snapshot")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    processingBaselineSnapshot: jsonb("processing_baseline_snapshot")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    presetId: varchar("preset_id", { length: 64 }).references(
      () => channelPresets.id,
      { onDelete: "set null" },
    ),
    presetSnapshot: jsonb("preset_snapshot")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    uploadStorageKey: text("upload_storage_key"),
    status: varchar("status", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("tasks_creator_user_id_idx").on(table.creatorUserId),
    index("tasks_api_credential_id_idx").on(table.apiCredentialId),
    index("tasks_status_idx").on(table.status),
    index("tasks_source_identifier_idx").on(table.sourceIdentifier),
    index("tasks_preset_id_idx").on(table.presetId),
  ],
);

export const taskIntakeDrafts = pgTable(
  "task_intake_drafts",
  {
    token: varchar("token", { length: 64 }).primaryKey(),
    creatorUserId: integer("creator_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    intakeMethod: varchar("intake_method", { length: 32 }).notNull(),
    sourceUrl: text("source_url"),
    sourceIdentifier: varchar("source_identifier", { length: 320 }),
    sourceSnapshot: jsonb("source_snapshot")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    processingBaselineSnapshot: jsonb("processing_baseline_snapshot")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    uploadStorageKey: text("upload_storage_key"),
    uploadSnapshot: jsonb("upload_snapshot")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("task_intake_drafts_creator_user_id_idx").on(table.creatorUserId),
    index("task_intake_drafts_expires_at_idx").on(table.expiresAt),
  ],
);
