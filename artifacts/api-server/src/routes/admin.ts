import { Router, type IRouter } from "express";
import { count, sql, eq, and } from "drizzle-orm";
import { db, workoutsTable, healthMetricsTable, chatMessagesTable, usersTable } from "@workspace/db";

const router: IRouter = Router();

async function requireAdmin(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): Promise<void> {
  if (!req.userIsAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

// GET /admin/status
router.get("/admin/status", async (req, res): Promise<void> => {
  res.json({ isAdmin: req.userIsAdmin === true });
});

// GET /admin/summary
router.get("/admin/summary", requireAdmin, async (_req, res): Promise<void> => {
  const [totalUsersRow] = await db.select({ count: count() }).from(usersTable);
  const [totalWorkoutsRow] = await db.select({ count: count() }).from(workoutsTable);
  const [totalHealthRow] = await db.select({ count: count() }).from(healthMetricsTable);
  const [totalChatRow] = await db.select({ count: count() }).from(chatMessagesTable);

  res.json({
    totalUsers: totalUsersRow?.count ?? 0,
    totalWorkouts: totalWorkoutsRow?.count ?? 0,
    totalHealthEntries: totalHealthRow?.count ?? 0,
    totalChatMessages: totalChatRow?.count ?? 0,
  });
});

// GET /admin/users
router.get("/admin/users", requireAdmin, async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);

  const workoutCounts = await db
    .select({ userId: workoutsTable.clerkUserId, workoutCount: count(), lastActivity: sql<string>`MAX(${workoutsTable.updatedAt})` })
    .from(workoutsTable)
    .groupBy(workoutsTable.clerkUserId);

  const healthCounts = await db
    .select({ userId: healthMetricsTable.clerkUserId, healthCount: count(), lastActivity: sql<string>`MAX(${healthMetricsTable.updatedAt})` })
    .from(healthMetricsTable)
    .groupBy(healthMetricsTable.clerkUserId);

  const chatCounts = await db
    .select({ userId: chatMessagesTable.clerkUserId, chatCount: count(), lastActivity: sql<string>`MAX(${chatMessagesTable.createdAt})` })
    .from(chatMessagesTable)
    .groupBy(chatMessagesTable.clerkUserId);

  const workoutMap = new Map(workoutCounts.map((r) => [r.userId, r]));
  const healthMap = new Map(healthCounts.map((r) => [r.userId, r]));
  const chatMap = new Map(chatCounts.map((r) => [r.userId, r]));

  const result = users.map((u) => {
    const uid = String(u.id);
    const w = workoutMap.get(uid);
    const h = healthMap.get(uid);
    const c = chatMap.get(uid);
    const dates = [w?.lastActivity, h?.lastActivity, c?.lastActivity]
      .filter(Boolean)
      .map((d) => new Date(d as string).getTime());
    const lastActivity = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : null;
    return {
      userId: uid,
      email: u.email,
      name: u.name,
      isAdmin: u.isAdmin,
      banned: u.banned,
      createdAt: u.createdAt?.toISOString() ?? null,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      workoutCount: w?.workoutCount ?? 0,
      healthCount: h?.healthCount ?? 0,
      chatCount: c?.chatCount ?? 0,
      lastActivity,
    };
  });

  result.sort((a, b) => {
    if (!a.lastActivity && !b.lastActivity) return 0;
    if (!a.lastActivity) return 1;
    if (!b.lastActivity) return -1;
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
  });

  res.json({ users: result });
});

// GET /admin/users/:userId
router.get("/admin/users/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params["userId"] as string;
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, parseInt(userId)));
  if (!u) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const workouts = await db
    .select()
    .from(workoutsTable)
    .where(eq(workoutsTable.clerkUserId, userId))
    .orderBy(workoutsTable.updatedAt);
  const healthMetrics = await db
    .select()
    .from(healthMetricsTable)
    .where(eq(healthMetricsTable.clerkUserId, userId))
    .orderBy(healthMetricsTable.loggedAt);
  const [chatRow] = await db
    .select({ count: count() })
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.clerkUserId, userId));

  res.json({
    userId,
    email: u.email,
    name: u.name,
    isAdmin: u.isAdmin,
    banned: u.banned,
    createdAt: u.createdAt?.toISOString() ?? null,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    workouts: JSON.parse(JSON.stringify(workouts)),
    healthMetrics: JSON.parse(JSON.stringify(healthMetrics)),
    chatMessageCount: chatRow?.count ?? 0,
  });
});

// POST /admin/users/:userId/ban
router.post("/admin/users/:userId/ban", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params["userId"] as string;
  if (userId === req.userId) {
    res.status(400).json({ error: "Cannot ban yourself" });
    return;
  }
  await db.update(usersTable).set({ banned: true }).where(eq(usersTable.id, parseInt(userId)));
  res.json({ success: true });
});

// POST /admin/users/:userId/unban
router.post("/admin/users/:userId/unban", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params["userId"] as string;
  await db.update(usersTable).set({ banned: false }).where(eq(usersTable.id, parseInt(userId)));
  res.json({ success: true });
});

// DELETE /admin/users/:userId
router.delete("/admin/users/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params["userId"] as string;
  if (userId === req.userId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }
  await db.delete(workoutsTable).where(eq(workoutsTable.clerkUserId, userId));
  await db.delete(healthMetricsTable).where(eq(healthMetricsTable.clerkUserId, userId));
  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.clerkUserId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, parseInt(userId)));
  res.json({ success: true });
});

// DELETE /admin/users/:userId/workouts/:workoutId
router.delete("/admin/users/:userId/workouts/:workoutId", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params["userId"] as string;
  const workoutId = req.params["workoutId"] as string;
  await db.delete(workoutsTable).where(and(eq(workoutsTable.id, parseInt(workoutId)), eq(workoutsTable.clerkUserId, userId)));
  res.json({ success: true });
});

// DELETE /admin/users/:userId/health-metrics/:metricId
router.delete("/admin/users/:userId/health-metrics/:metricId", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params["userId"] as string;
  const metricId = req.params["metricId"] as string;
  await db.delete(healthMetricsTable).where(and(eq(healthMetricsTable.id, parseInt(metricId)), eq(healthMetricsTable.clerkUserId, userId)));
  res.json({ success: true });
});

// DELETE /admin/users/:userId/chat
router.delete("/admin/users/:userId/chat", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params["userId"] as string;
  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.clerkUserId, userId));
  res.json({ success: true });
});

export default router;
