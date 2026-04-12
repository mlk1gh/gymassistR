import { pgTable, text, serial, timestamp, doublePrecision, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const healthMetricsTable = pgTable("health_metrics", {
  id: serial("id").primaryKey(),
  clerkUserId: varchar("clerk_user_id", { length: 256 }).notNull().default(""),
  type: text("type").notNull(),
  value: doublePrecision("value").notNull(),
  unit: text("unit").notNull(),
  notes: text("notes"),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHealthMetricSchema = createInsertSchema(healthMetricsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHealthMetric = z.infer<typeof insertHealthMetricSchema>;
export type HealthMetric = typeof healthMetricsTable.$inferSelect;
