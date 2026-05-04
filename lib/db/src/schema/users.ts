import { pgTable, text, serial, timestamp, boolean, varchar, integer, real } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 256 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 256 }).notNull().default(""),
  isAdmin: boolean("is_admin").notNull().default(false),
  banned: boolean("banned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  age: integer("age"),
  heightCm: real("height_cm"),
  weightKg: real("weight_kg"),
  fitnessGoal: varchar("fitness_goal", { length: 512 }),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
