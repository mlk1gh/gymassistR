import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

const router: IRouter = Router();

const UpdateProfileBody = z.object({
  name: z.string().min(1).max(256).optional(),
  age: z.number().int().min(1).max(120).nullable().optional(),
  heightCm: z.number().min(50).max(300).nullable().optional(),
  weightKg: z.number().min(20).max(500).nullable().optional(),
  fitnessGoal: z.string().max(512).nullable().optional(),
});

router.get("/user/profile", async (req, res): Promise<void> => {
  const userId = Number(req.userId);
  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      age: usersTable.age,
      heightCm: usersTable.heightCm,
      weightKg: usersTable.weightKg,
      fitnessGoal: usersTable.fitnessGoal,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

router.patch("/user/profile", async (req, res): Promise<void> => {
  const userId = Number(req.userId);
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const [user] = await db
    .update(usersTable)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.age !== undefined && { age: data.age }),
      ...(data.heightCm !== undefined && { heightCm: data.heightCm }),
      ...(data.weightKg !== undefined && { weightKg: data.weightKg }),
      ...(data.fitnessGoal !== undefined && { fitnessGoal: data.fitnessGoal }),
    })
    .where(eq(usersTable.id, userId))
    .returning({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      age: usersTable.age,
      heightCm: usersTable.heightCm,
      weightKg: usersTable.weightKg,
      fitnessGoal: usersTable.fitnessGoal,
    });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

export default router;
