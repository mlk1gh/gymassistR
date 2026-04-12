import { Router, type IRouter } from "express";
import { eq, and, SQL, desc } from "drizzle-orm";
import { db, healthMetricsTable } from "@workspace/db";
import { serializeRows, serializeRow } from "../lib/serialize";
import {
  ListHealthMetricsResponse,
  ListHealthMetricsQueryParams,
  CreateHealthMetricBody,
  GetHealthMetricParams,
  GetHealthMetricResponse,
  UpdateHealthMetricParams,
  UpdateHealthMetricBody,
  UpdateHealthMetricResponse,
  DeleteHealthMetricParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/health-metrics", async (req, res): Promise<void> => {
  const query = ListHealthMetricsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions: SQL[] = [];
  if (query.data.type) {
    conditions.push(eq(healthMetricsTable.type, query.data.type));
  }

  const limit = query.data.limit ?? 100;

  const metrics = conditions.length > 0
    ? await db.select().from(healthMetricsTable).where(and(...conditions)).orderBy(desc(healthMetricsTable.loggedAt)).limit(limit)
    : await db.select().from(healthMetricsTable).orderBy(desc(healthMetricsTable.loggedAt)).limit(limit);

  res.json(ListHealthMetricsResponse.parse(serializeRows(metrics)));
});

router.post("/health-metrics", async (req, res): Promise<void> => {
  const parsed = CreateHealthMetricBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const [metric] = await db.insert(healthMetricsTable).values({
    type: data.type,
    value: data.value,
    unit: data.unit,
    notes: data.notes ?? null,
    loggedAt: data.loggedAt ? new Date(data.loggedAt) : new Date(),
  }).returning();

  res.status(201).json(GetHealthMetricResponse.parse(serializeRow(metric)));
});

router.get("/health-metrics/:id", async (req, res): Promise<void> => {
  const params = GetHealthMetricParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [metric] = await db.select().from(healthMetricsTable).where(eq(healthMetricsTable.id, params.data.id));
  if (!metric) {
    res.status(404).json({ error: "Health metric not found" });
    return;
  }

  res.json(GetHealthMetricResponse.parse(serializeRow(metric)));
});

router.patch("/health-metrics/:id", async (req, res): Promise<void> => {
  const params = UpdateHealthMetricParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateHealthMetricBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const [metric] = await db.update(healthMetricsTable)
    .set({
      ...(data.type !== undefined && { type: data.type }),
      ...(data.value !== undefined && { value: data.value }),
      ...(data.unit !== undefined && { unit: data.unit }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.loggedAt !== undefined && { loggedAt: data.loggedAt ? new Date(data.loggedAt) : new Date() }),
    })
    .where(eq(healthMetricsTable.id, params.data.id))
    .returning();

  if (!metric) {
    res.status(404).json({ error: "Health metric not found" });
    return;
  }

  res.json(UpdateHealthMetricResponse.parse(serializeRow(metric)));
});

router.delete("/health-metrics/:id", async (req, res): Promise<void> => {
  const params = DeleteHealthMetricParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(healthMetricsTable).where(eq(healthMetricsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Health metric not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
