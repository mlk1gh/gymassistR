import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, workoutsTable } from "@workspace/db";
import { serializeRows, serializeRow } from "../lib/serialize";
import {
  ListWorkoutsResponse,
  CreateWorkoutBody,
  GetWorkoutParams,
  GetWorkoutResponse,
  UpdateWorkoutParams,
  UpdateWorkoutBody,
  UpdateWorkoutResponse,
  DeleteWorkoutParams,
  CompleteWorkoutParams,
  CompleteWorkoutResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/workouts", async (req, res): Promise<void> => {
  const userId = req.userId;
  const workouts = await db.select().from(workoutsTable).where(eq(workoutsTable.clerkUserId, userId)).orderBy(workoutsTable.createdAt);
  res.json(ListWorkoutsResponse.parse(serializeRows(workouts)));
});

router.post("/workouts", async (req, res): Promise<void> => {
  const userId = req.userId;
  const parsed = CreateWorkoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const [workout] = await db.insert(workoutsTable).values({
    clerkUserId: userId,
    name: data.name,
    description: data.description ?? null,
    goal: data.goal,
    durationMinutes: data.durationMinutes,
    difficulty: data.difficulty,
    scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
  }).returning();

  res.status(201).json(GetWorkoutResponse.parse(serializeRow(workout)));
});

router.get("/workouts/:id", async (req, res): Promise<void> => {
  const userId = req.userId;
  const params = GetWorkoutParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [workout] = await db.select().from(workoutsTable).where(and(eq(workoutsTable.id, params.data.id), eq(workoutsTable.clerkUserId, userId)));
  if (!workout) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }

  res.json(GetWorkoutResponse.parse(serializeRow(workout)));
});

router.patch("/workouts/:id", async (req, res): Promise<void> => {
  const userId = req.userId;
  const params = UpdateWorkoutParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateWorkoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const [workout] = await db.update(workoutsTable)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.goal !== undefined && { goal: data.goal }),
      ...(data.durationMinutes !== undefined && { durationMinutes: data.durationMinutes }),
      ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
      ...(data.completed !== undefined && { completed: data.completed }),
      ...(data.scheduledAt !== undefined && { scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null }),
    })
    .where(and(eq(workoutsTable.id, params.data.id), eq(workoutsTable.clerkUserId, userId)))
    .returning();

  if (!workout) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }

  res.json(UpdateWorkoutResponse.parse(serializeRow(workout)));
});

router.delete("/workouts/:id", async (req, res): Promise<void> => {
  const userId = req.userId;
  const params = DeleteWorkoutParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(workoutsTable).where(and(eq(workoutsTable.id, params.data.id), eq(workoutsTable.clerkUserId, userId))).returning();
  if (!deleted) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }

  res.sendStatus(204);
});

router.patch("/workouts/:id/complete", async (req, res): Promise<void> => {
  const userId = req.userId;
  const params = CompleteWorkoutParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [workout] = await db.update(workoutsTable)
    .set({ completed: true })
    .where(and(eq(workoutsTable.id, params.data.id), eq(workoutsTable.clerkUserId, userId)))
    .returning();

  if (!workout) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }

  res.json(CompleteWorkoutResponse.parse(serializeRow(workout)));
});

export default router;
