import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function getJwtSecret(): string {
  return process.env["SESSION_SECRET"] ?? "gymassist-fallback-secret";
}

function makeAdminEmailSet(): Set<string> {
  return new Set(
    (process.env["ADMIN_EMAILS"] ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

function signToken(user: { id: number; email: string; name: string; isAdmin: boolean }): string {
  return jwt.sign(
    { userId: String(user.id), email: user.email, name: user.name, isAdmin: user.isAdmin },
    getJwtSecret(),
    { expiresIn: "7d" },
  );
}

// POST /api/auth/register
router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, name } = req.body as { email?: string; password?: string; name?: string };

  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail));

  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const adminEmails = makeAdminEmailSet();
  const isAdmin = adminEmails.has(normalizedEmail);
  const displayName = (typeof name === "string" && name.trim()) ? name.trim() : normalizedEmail.split("@")[0]!;

  const [user] = await db
    .insert(usersTable)
    .values({ email: normalizedEmail, passwordHash, name: displayName, isAdmin })
    .returning();

  const token = signToken(user!);
  res.status(201).json({
    token,
    user: { userId: String(user!.id), email: user!.email, name: user!.name, isAdmin: user!.isAdmin },
  });
});

// POST /api/auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail));

  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  if (user.banned) {
    res.status(403).json({ error: "Your account has been suspended" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const adminEmails = makeAdminEmailSet();
  const isAdmin = adminEmails.has(user.email) || user.isAdmin;
  if (isAdmin !== user.isAdmin) {
    await db.update(usersTable).set({ isAdmin }).where(eq(usersTable.id, user.id));
  }
  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

  const token = signToken({ ...user, isAdmin });
  res.json({
    token,
    user: { userId: String(user.id), email: user.email, name: user.name, isAdmin },
  });
});

// GET /api/auth/me
router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, getJwtSecret()) as {
      userId: string;
      email: string;
      name: string;
      isAdmin: boolean;
    };
    res.json({ userId: payload.userId, email: payload.email, name: payload.name, isAdmin: payload.isAdmin });
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

export default router;
