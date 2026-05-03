import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import jwt from "jsonwebtoken";
import authRouter from "./routes/auth";
import router from "./routes";
import { logger } from "./lib/logger";

function getJwtSecret(): string {
  return process.env["SESSION_SECRET"] ?? "gymassist-fallback-secret";
}

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public auth routes (register / login / me) — no token required
app.use("/api", authRouter);

// JWT middleware for all other /api routes
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
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
    req.userId = payload.userId;
    req.userIsAdmin = payload.isAdmin;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.use("/api", requireAuth, router);

export default app;
