import { Router, type IRouter } from "express";
import { eq, count, sql, desc, gte, and } from "drizzle-orm";
import { serializeRow, serializeRows } from "../lib/serialize";
import { db, workoutsTable, exercisesTable, healthMetricsTable, chatMessagesTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetRecentActivityResponse,
  GetMetricsTrendResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const userId = req.userId;

  const [totalWorkoutsResult] = await db.select({ count: count() }).from(workoutsTable).where(eq(workoutsTable.clerkUserId, userId));
  const [completedWorkoutsResult] = await db.select({ count: count() }).from(workoutsTable).where(and(eq(workoutsTable.clerkUserId, userId), eq(workoutsTable.completed, true)));
  const [totalExercisesResult] = await db.select({ count: count() }).from(exercisesTable);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const [weeklyWorkoutsResult] = await db.select({ count: count() }).from(workoutsTable).where(and(eq(workoutsTable.clerkUserId, userId), gte(workoutsTable.createdAt, sevenDaysAgo)));

  const avgDurationResult = await db.select({ avg: sql<string>`AVG(${workoutsTable.durationMinutes})` }).from(workoutsTable).where(eq(workoutsTable.clerkUserId, userId));
  const avgDuration = avgDurationResult[0]?.avg != null ? parseFloat(avgDurationResult[0].avg) : null;

  const latestWeightRow = await db.select().from(healthMetricsTable).where(and(eq(healthMetricsTable.clerkUserId, userId), eq(healthMetricsTable.type, "weight"))).orderBy(desc(healthMetricsTable.loggedAt)).limit(1);
  const latestWeight = latestWeightRow[0]?.value ?? null;
  const latestWeightUnit = latestWeightRow[0]?.unit ?? null;

  res.json(GetDashboardSummaryResponse.parse({
    totalWorkouts: totalWorkoutsResult.count,
    completedWorkouts: completedWorkoutsResult.count,
    totalExercises: totalExercisesResult.count,
    latestWeight,
    latestWeightUnit,
    weeklyWorkoutsCount: weeklyWorkoutsResult.count,
    averageDurationMinutes: avgDuration,
  }));
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const userId = req.userId;

  const recentWorkouts = await db.select().from(workoutsTable).where(eq(workoutsTable.clerkUserId, userId)).orderBy(desc(workoutsTable.createdAt)).limit(5);
  const recentMetrics = await db.select().from(healthMetricsTable).where(eq(healthMetricsTable.clerkUserId, userId)).orderBy(desc(healthMetricsTable.loggedAt)).limit(5);
  const recentChats = await db.select().from(chatMessagesTable).where(and(eq(chatMessagesTable.clerkUserId, userId), eq(chatMessagesTable.role, "user"))).orderBy(desc(chatMessagesTable.createdAt)).limit(3);

  const activities: Array<{ id: number; type: string; description: string; timestamp: string }> = [];

  for (const w of recentWorkouts) {
    activities.push({
      id: w.id,
      type: w.completed ? "workout_completed" : "workout_created",
      description: w.completed
        ? `Completed "${w.name}" (${w.durationMinutes} min, ${w.difficulty})`
        : `Added workout "${w.name}" (${w.durationMinutes} min, ${w.difficulty})`,
      timestamp: w.createdAt.toISOString(),
    });
  }

  for (const m of recentMetrics) {
    activities.push({
      id: m.id + 10000,
      type: "health_metric_logged",
      description: `Logged ${m.type}: ${m.value} ${m.unit}`,
      timestamp: m.loggedAt.toISOString(),
    });
  }

  for (const c of recentChats) {
    activities.push({
      id: c.id + 20000,
      type: "chat_message",
      description: `Asked GymAssist: "${c.content.substring(0, 60)}${c.content.length > 60 ? "..." : ""}"`,
      timestamp: c.createdAt.toISOString(),
    });
  }

  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  res.json(GetRecentActivityResponse.parse(activities.slice(0, 10)));
});

router.get("/dashboard/metrics-trend", async (req, res): Promise<void> => {
  const userId = req.userId;

  const metrics = await db.select().from(healthMetricsTable).where(eq(healthMetricsTable.clerkUserId, userId)).orderBy(healthMetricsTable.loggedAt);

  const grouped: Record<string, { unit: string; data: Array<{ loggedAt: string; value: number }> }> = {};

  for (const m of metrics) {
    if (!grouped[m.type]) {
      grouped[m.type] = { unit: m.unit, data: [] };
    }
    grouped[m.type].data.push({
      loggedAt: m.loggedAt.toISOString(),
      value: m.value,
    });
  }

  const trends = Object.entries(grouped).map(([type, val]) => ({
    type,
    unit: val.unit,
    data: val.data,
  }));

  res.json(GetMetricsTrendResponse.parse(trends));
});

export default router;
