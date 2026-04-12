import { Router, type IRouter } from "express";
import healthRouter from "./health";
import workoutsRouter from "./workouts";
import exercisesRouter from "./exercises";
import healthMetricsRouter from "./healthMetrics";
import chatRouter from "./chat";
import dashboardRouter from "./dashboard";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(workoutsRouter);
router.use(exercisesRouter);
router.use(healthMetricsRouter);
router.use(chatRouter);
router.use(dashboardRouter);
router.use(adminRouter);

export default router;
