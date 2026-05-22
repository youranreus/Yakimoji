import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    email: varchar("email", { length: 320 }).notNull().unique(),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("users_status_idx").on(table.status)],
);

export const ssoAccounts = pgTable(
  "sso_accounts",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 64 }).notNull(),
    providerUserId: varchar("provider_user_id", { length: 160 }).notNull(),
    providerRole: varchar("provider_role", { length: 64 }),
    profile: jsonb("profile").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("sso_accounts_provider_user_idx").on(
      table.provider,
      table.providerUserId,
    ),
    index("sso_accounts_user_id_idx").on(table.userId),
  ],
);

export const userRoleAssignments = pgTable(
  "user_role_assignments",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 32 }).notNull(),
    scopeType: varchar("scope_type", { length: 32 }).notNull().default("global"),
    scopeId: varchar("scope_id", { length: 128 }),
    assignedBy: varchar("assigned_by", { length: 160 }).notNull().default("system"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: "user_role_assignments_pk",
      columns: [table.userId, table.role, table.scopeType, table.scopeId],
    }),
    index("user_role_assignments_role_idx").on(table.role),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
    ipAddress: varchar("ip_address", { length: 128 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    requestId: varchar("request_id", { length: 64 }).notNull(),
    actorUserId: integer("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorSessionId: varchar("actor_session_id", { length: 128 }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    resourceType: varchar("resource_type", { length: 64 }).notNull(),
    resourceId: varchar("resource_id", { length: 160 }).notNull(),
    outcome: varchar("outcome", { length: 32 }).notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_request_id_idx").on(table.requestId),
    index("audit_logs_actor_user_id_idx").on(table.actorUserId),
    index("audit_logs_event_type_idx").on(table.eventType),
  ],
);

export const allowedRoles = ["creator", "support", "ops", "admin"] as const;
export type AllowedRole = (typeof allowedRoles)[number];
