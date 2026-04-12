import { Router, type IRouter } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { db, exercisesTable } from "@workspace/db";
import { serializeRows, serializeRow } from "../lib/serialize";
import {
  ListExercisesResponse,
  ListExercisesQueryParams,
  CreateExerciseBody,
  GetExerciseParams,
  GetExerciseResponse,
  UpdateExerciseParams,
  UpdateExerciseBody,
  UpdateExerciseResponse,
  DeleteExerciseParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/exercises", async (req, res): Promise<void> => {
  const query = ListExercisesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions: SQL[] = [];
  if (query.data.muscleGroup) {
    conditions.push(eq(exercisesTable.muscleGroup, query.data.muscleGroup));
  }
  if (query.data.difficulty) {
    conditions.push(eq(exercisesTable.difficulty, query.data.difficulty));
  }

  const exercises = conditions.length > 0
    ? await db.select().from(exercisesTable).where(and(...conditions)).orderBy(exercisesTable.name)
    : await db.select().from(exercisesTable).orderBy(exercisesTable.name);

  res.json(ListExercisesResponse.parse(serializeRows(exercises)));
});

router.post("/exercises", async (req, res): Promise<void> => {
  const parsed = CreateExerciseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const [exercise] = await db.insert(exercisesTable).values({
    name: data.name,
    description: data.description ?? null,
    muscleGroup: data.muscleGroup,
    difficulty: data.difficulty,
    equipment: data.equipment ?? null,
    instructions: data.instructions ?? null,
    sets: data.sets ?? null,
    reps: data.reps ?? null,
    durationSeconds: data.durationSeconds ?? null,
  }).returning();

  res.status(201).json(GetExerciseResponse.parse(serializeRow(exercise)));
});

router.get("/exercises/:id", async (req, res): Promise<void> => {
  const params = GetExerciseParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [exercise] = await db.select().from(exercisesTable).where(eq(exercisesTable.id, params.data.id));
  if (!exercise) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  res.json(GetExerciseResponse.parse(serializeRow(exercise)));
});

router.patch("/exercises/:id", async (req, res): Promise<void> => {
  const params = UpdateExerciseParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateExerciseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const [exercise] = await db.update(exercisesTable)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.muscleGroup !== undefined && { muscleGroup: data.muscleGroup }),
      ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
      ...(data.equipment !== undefined && { equipment: data.equipment }),
      ...(data.instructions !== undefined && { instructions: data.instructions }),
      ...(data.sets !== undefined && { sets: data.sets }),
      ...(data.reps !== undefined && { reps: data.reps }),
      ...(data.durationSeconds !== undefined && { durationSeconds: data.durationSeconds }),
    })
    .where(eq(exercisesTable.id, params.data.id))
    .returning();

  if (!exercise) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  res.json(UpdateExerciseResponse.parse(serializeRow(exercise)));
});

router.delete("/exercises/:id", async (req, res): Promise<void> => {
  const params = DeleteExerciseParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(exercisesTable).where(eq(exercisesTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
