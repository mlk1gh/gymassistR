import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, workoutsTable, exercisesTable, workoutExercisesTable } from "@workspace/db";
import { serializeRows } from "../lib/serialize";

const router: IRouter = Router();

router.get("/workouts/:workoutId/exercises", async (req, res): Promise<void> => {
  const userId = req.userId;
  const workoutId = parseInt(req.params["workoutId"] as string);
  if (isNaN(workoutId)) { res.status(400).json({ error: "Invalid workoutId" }); return; }

  const [workout] = await db.select({ id: workoutsTable.id }).from(workoutsTable)
    .where(and(eq(workoutsTable.id, workoutId), eq(workoutsTable.clerkUserId, userId)));
  if (!workout) { res.status(404).json({ error: "Workout not found" }); return; }

  const rows = await db
    .select({
      id: exercisesTable.id,
      name: exercisesTable.name,
      description: exercisesTable.description,
      muscleGroup: exercisesTable.muscleGroup,
      difficulty: exercisesTable.difficulty,
      equipment: exercisesTable.equipment,
      instructions: exercisesTable.instructions,
      sets: exercisesTable.sets,
      reps: exercisesTable.reps,
      durationSeconds: exercisesTable.durationSeconds,
      videoUrl: exercisesTable.videoUrl,
      linkId: workoutExercisesTable.id,
      order: workoutExercisesTable.order,
    })
    .from(workoutExercisesTable)
    .innerJoin(exercisesTable, eq(workoutExercisesTable.exerciseId, exercisesTable.id))
    .where(eq(workoutExercisesTable.workoutId, workoutId))
    .orderBy(asc(workoutExercisesTable.order));

  res.json(serializeRows(rows));
});

router.post("/workouts/:workoutId/exercises", async (req, res): Promise<void> => {
  const userId = req.userId;
  const workoutId = parseInt(req.params["workoutId"] as string);
  if (isNaN(workoutId)) { res.status(400).json({ error: "Invalid workoutId" }); return; }

  const { exerciseId } = req.body as { exerciseId: number };
  if (!exerciseId) { res.status(400).json({ error: "exerciseId is required" }); return; }

  const [workout] = await db.select({ id: workoutsTable.id }).from(workoutsTable)
    .where(and(eq(workoutsTable.id, workoutId), eq(workoutsTable.clerkUserId, userId)));
  if (!workout) { res.status(404).json({ error: "Workout not found" }); return; }

  const existing = await db.select({ id: workoutExercisesTable.id })
    .from(workoutExercisesTable)
    .where(and(eq(workoutExercisesTable.workoutId, workoutId), eq(workoutExercisesTable.exerciseId, exerciseId)));
  if (existing.length > 0) { res.status(409).json({ error: "Exercise already in this workout" }); return; }

  await db.insert(workoutExercisesTable).values({ workoutId, exerciseId, order: 0 });
  res.status(201).json({ ok: true });
});

router.delete("/workouts/:workoutId/exercises/:exerciseId", async (req, res): Promise<void> => {
  const userId = req.userId;
  const workoutId = parseInt(req.params["workoutId"] as string);
  const exerciseId = parseInt(req.params["exerciseId"] as string);
  if (isNaN(workoutId) || isNaN(exerciseId)) { res.status(400).json({ error: "Invalid ids" }); return; }

  const [workout] = await db.select({ id: workoutsTable.id }).from(workoutsTable)
    .where(and(eq(workoutsTable.id, workoutId), eq(workoutsTable.clerkUserId, userId)));
  if (!workout) { res.status(404).json({ error: "Workout not found" }); return; }

  await db.delete(workoutExercisesTable)
    .where(and(eq(workoutExercisesTable.workoutId, workoutId), eq(workoutExercisesTable.exerciseId, exerciseId)));
  res.json({ ok: true });
});

export default router;
