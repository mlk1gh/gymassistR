import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { count, sql, desc } from "drizzle-orm";
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

router.get("/admin/status", async (req, res): Promise<void> => {
  const isAdmin = await isAdminUser(req.userId);
  res.json({ isAdmin });
});

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

router.get("/admin/users", requireAdmin, async (_req, res): Promise<void> => {
  const workoutCounts = await db
    .select({
      clerkUserId: workoutsTable.clerkUserId,
      workoutCount: count(),
      lastActivity: sql<string>`MAX(${workoutsTable.updatedAt})`,
    })
    .from(workoutsTable)
    .groupBy(workoutsTable.clerkUserId);

  const healthCounts = await db
    .select({
      clerkUserId: healthMetricsTable.clerkUserId,
      healthCount: count(),
      lastActivity: sql<string>`MAX(${healthMetricsTable.updatedAt})`,
    })
    .from(healthMetricsTable)
    .groupBy(healthMetricsTable.clerkUserId);

  const chatCounts = await db
    .select({
      clerkUserId: chatMessagesTable.clerkUserId,
      chatCount: count(),
      lastActivity: sql<string>`MAX(${chatMessagesTable.createdAt})`,
    })
    .from(chatMessagesTable)
    .groupBy(chatMessagesTable.clerkUserId);

  const allUserIds = new Set([
    ...workoutCounts.map((r) => r.clerkUserId),
    ...healthCounts.map((r) => r.clerkUserId),
    ...chatCounts.map((r) => r.clerkUserId),
  ]);

  const workoutMap = new Map(workoutCounts.map((r) => [r.clerkUserId, r]));
  const healthMap = new Map(healthCounts.map((r) => [r.clerkUserId, r]));
  const chatMap = new Map(chatCounts.map((r) => [r.clerkUserId, r]));

  let clerkUsers: Record<string, { email: string; name: string; imageUrl: string }> = {};
  if (allUserIds.size > 0) {
    try {
      const userList = await clerkClient.users.getUserList({ userId: [...allUserIds], limit: 500 });
      for (const u of userList.data) {
        clerkUsers[u.id] = {
          email: u.emailAddresses[0]?.emailAddress ?? "",
          name: ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.emailAddresses[0]?.emailAddress) ?? u.id,
          imageUrl: u.imageUrl ?? "",
        };
      }
    } catch {
      // If Clerk lookup fails, still return data without user details
    }
  }

  const users = [...allUserIds].map((userId) => {
    const w = workoutMap.get(userId);
    const h = healthMap.get(userId);
    const c = chatMap.get(userId);

    const dates = [w?.lastActivity, h?.lastActivity, c?.lastActivity]
      .filter(Boolean)
      .map((d) => new Date(d as string).getTime());
    const lastActivity = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : null;

    return {
      clerkUserId: userId,
      email: clerkUsers[userId]?.email ?? "",
      name: clerkUsers[userId]?.name ?? userId,
      imageUrl: clerkUsers[userId]?.imageUrl ?? "",
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

export default router;
