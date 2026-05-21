import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const starterHealthChecks = pgTable("starter_health_checks", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  checkedAt: timestamp("checked_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
