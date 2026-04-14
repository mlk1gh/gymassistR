import { pgTable, serial, integer } from "drizzle-orm/pg-core";
import { workoutsTable } from "./workouts";
import { exercisesTable } from "./exercises";

export const workoutExercisesTable = pgTable("workout_exercises", {
  id: serial("id").primaryKey(),
  workoutId: integer("workout_id").notNull().references(() => workoutsTable.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").notNull().references(() => exercisesTable.id, { onDelete: "cascade" }),
  order: integer("order").notNull().default(0),
});

export type WorkoutExercise = typeof workoutExercisesTable.$inferSelect;
