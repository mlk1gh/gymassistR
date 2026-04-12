import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { count, sql, eq, and } from "drizzle-orm";
import { db, workoutsTable, healthMetricsTable, chatMessagesTable } from "@workspace/db";

const router: IRouter = Router();

async function isAdminUser(userId: string): Promise<boolean> {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (adminEmails.length === 0) return false;
  try {
    const user = await clerkClient.users.getUser(userId);
    const userEmails = user.emailAddresses.map((e) => e.emailAddress);
    return userEmails.some((e) => adminEmails.includes(e));
  } catch {
    return false;
  }
}

async function requireAdmin(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): Promise<void> {
  const isAdmin = await isAdminUser(req.userId);
  if (!isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

function clerkUserToProfile(u: Awaited<ReturnType<typeof clerkClient.users.getUser>>) {
  return {
    clerkUserId: u.id,
    email: u.emailAddresses[0]?.emailAddress ?? "",
    name: ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.emailAddresses[0]?.emailAddress) ?? u.id,
    imageUrl: u.imageUrl ?? "",
    banned: u.banned ?? false,
    createdAt: new Date(u.createdAt).toISOString(),
    lastSignInAt: u.lastSignInAt ? new Date(u.lastSignInAt).toISOString() : null,
  };
}

// GET /admin/status
router.get("/admin/status", async (req, res): Promise<void> => {
  const isAdmin = await isAdminUser(req.userId);
  res.json({ isAdmin });
});

// GET /admin/summary
router.get("/admin/summary", requireAdmin, async (_req, res): Promise<void> => {
  const [totalWorkoutsRow] = await db.select({ count: count() }).from(workoutsTable);
  const [totalHealthRow] = await db.select({ count: count() }).from(healthMetricsTable);
  const [totalChatRow] = await db.select({ count: count() }).from(chatMessagesTable);

  const distinctUserIds = await db
    .selectDistinct({ clerkUserId: workoutsTable.clerkUserId })
    .from(workoutsTable)
    .union(db.selectDistinct({ clerkUserId: healthMetricsTable.clerkUserId }).from(healthMetricsTable))
    .union(db.selectDistinct({ clerkUserId: chatMessagesTable.clerkUserId }).from(chatMessagesTable));

  res.json({
    totalUsers: distinctUserIds.length,
    totalWorkouts: totalWorkoutsRow.count,
    totalHealthEntries: totalHealthRow.count,
    totalChatMessages: totalChatRow.count,
  });
});

// GET /admin/users
router.get("/admin/users", requireAdmin, async (_req, res): Promise<void> => {
  const workoutCounts = await db
    .select({ clerkUserId: workoutsTable.clerkUserId, workoutCount: count(), lastActivity: sql<string>`MAX(${workoutsTable.updatedAt})` })
    .from(workoutsTable).groupBy(workoutsTable.clerkUserId);

  const healthCounts = await db
    .select({ clerkUserId: healthMetricsTable.clerkUserId, healthCount: count(), lastActivity: sql<string>`MAX(${healthMetricsTable.updatedAt})` })
    .from(healthMetricsTable).groupBy(healthMetricsTable.clerkUserId);

  const chatCounts = await db
    .select({ clerkUserId: chatMessagesTable.clerkUserId, chatCount: count(), lastActivity: sql<string>`MAX(${chatMessagesTable.createdAt})` })
    .from(chatMessagesTable).groupBy(chatMessagesTable.clerkUserId);

  const allUserIds = new Set([
    ...workoutCounts.map((r) => r.clerkUserId),
    ...healthCounts.map((r) => r.clerkUserId),
    ...chatCounts.map((r) => r.clerkUserId),
  ]);

  const workoutMap = new Map(workoutCounts.map((r) => [r.clerkUserId, r]));
  const healthMap = new Map(healthCounts.map((r) => [r.clerkUserId, r]));
  const chatMap = new Map(chatCounts.map((r) => [r.clerkUserId, r]));

  let clerkProfiles: Record<string, ReturnType<typeof clerkUserToProfile>> = {};
  if (allUserIds.size > 0) {
    try {
      const userList = await clerkClient.users.getUserList({ userId: [...allUserIds], limit: 500 });
      for (const u of userList.data) {
        clerkProfiles[u.id] = clerkUserToProfile(u);
      }
    } catch { /* continue without Clerk details */ }
  }

  const users = [...allUserIds].map((userId) => {
    const w = workoutMap.get(userId);
    const h = healthMap.get(userId);
    const c = chatMap.get(userId);
    const dates = [w?.lastActivity, h?.lastActivity, c?.lastActivity].filter(Boolean).map((d) => new Date(d as string).getTime());
    const lastActivity = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : null;

    return {
      ...(clerkProfiles[userId] ?? { clerkUserId: userId, email: "", name: userId, imageUrl: "", banned: false, createdAt: null, lastSignInAt: null }),
      workoutCount: w?.workoutCount ?? 0,
      healthCount: h?.healthCount ?? 0,
      chatCount: c?.chatCount ?? 0,
      lastActivity,
    };
  });

  users.sort((a, b) => {
    if (!a.lastActivity && !b.lastActivity) return 0;
    if (!a.lastActivity) return 1;
    if (!b.lastActivity) return -1;
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
  });

  res.json({ users });
});

// GET /admin/users/:userId
router.get("/admin/users/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params["userId"] as string;
  try {
    const u = await clerkClient.users.getUser(userId);
    const profile = clerkUserToProfile(u);

    const workouts = await db.select().from(workoutsTable).where(eq(workoutsTable.clerkUserId, userId)).orderBy(workoutsTable.updatedAt);
    const healthMetrics = await db.select().from(healthMetricsTable).where(eq(healthMetricsTable.clerkUserId, userId)).orderBy(healthMetricsTable.loggedAt);
    const [chatRow] = await db.select({ count: count() }).from(chatMessagesTable).where(eq(chatMessagesTable.clerkUserId, userId));

    res.json({
      ...profile,
      workouts: JSON.parse(JSON.stringify(workouts)),
      healthMetrics: JSON.parse(JSON.stringify(healthMetrics)),
      chatMessageCount: chatRow.count,
    });
  } catch {
    res.status(404).json({ error: "User not found" });
  }
});

// POST /admin/users/:userId/ban
router.post("/admin/users/:userId/ban", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params["userId"] as string;
  if (userId === req.userId) {
    res.status(400).json({ error: "Cannot ban yourself" });
    return;
  }
  try {
    await clerkClient.users.banUser(userId);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to ban user" });
  }
});

// POST /admin/users/:userId/unban
router.post("/admin/users/:userId/unban", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params["userId"] as string;
  try {
    await clerkClient.users.unbanUser(userId);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to unban user" });
  }
});

// DELETE /admin/users/:userId
router.delete("/admin/users/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params["userId"] as string;
  if (userId === req.userId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }
  try {
    await db.delete(workoutsTable).where(eq(workoutsTable.clerkUserId, userId));
    await db.delete(healthMetricsTable).where(eq(healthMetricsTable.clerkUserId, userId));
    await db.delete(chatMessagesTable).where(eq(chatMessagesTable.clerkUserId, userId));
    await clerkClient.users.deleteUser(userId);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// DELETE /admin/users/:userId/workouts/:workoutId
router.delete("/admin/users/:userId/workouts/:workoutId", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params["userId"] as string; const workoutId = req.params["workoutId"] as string;
  await db.delete(workoutsTable).where(and(eq(workoutsTable.id, parseInt(workoutId)), eq(workoutsTable.clerkUserId, userId)));
  res.json({ success: true });
});

// DELETE /admin/users/:userId/health-metrics/:metricId
router.delete("/admin/users/:userId/health-metrics/:metricId", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params["userId"] as string; const metricId = req.params["metricId"] as string;
  await db.delete(healthMetricsTable).where(and(eq(healthMetricsTable.id, parseInt(metricId)), eq(healthMetricsTable.clerkUserId, userId)));
  res.json({ success: true });
});

// DELETE /admin/users/:userId/chat
router.delete("/admin/users/:userId/chat", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params["userId"] as string;
  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.clerkUserId, userId));
  res.json({ success: true });
});

// POST /admin/invitations
router.post("/admin/invitations", requireAdmin, async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  try {
    const invitation = await clerkClient.invitations.createInvitation({ emailAddress: email.trim() });
    res.json({ success: true, id: invitation.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send invitation";
    res.status(400).json({ error: msg });
  }
});

export default router;
