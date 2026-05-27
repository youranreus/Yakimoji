import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export const channelPresets = pgTable(
  "channel_presets",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    ownerUserId: integer("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceIdentifier: varchar("source_identifier", { length: 320 }).notNull(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    translationMode: varchar("translation_mode", { length: 120 }).notNull(),
    subtitleTemplate: varchar("subtitle_template", { length: 160 }).notNull(),
    outputPackage: varchar("output_package", { length: 120 }).notNull(),
    notes: text("notes"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_channel_presets_owner_source").on(
      table.ownerUserId,
      table.sourceIdentifier,
    ),
    index("idx_channel_presets_owner_user_id").on(table.ownerUserId),
    index("idx_channel_presets_source_identifier").on(table.sourceIdentifier),
  ],
);
