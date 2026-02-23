import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { config } from "./config.js";
import { db } from "./db/pool.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes    from "./routes/auth.js";
import articleRoutes from "./routes/articles.js";
import paymentRoutes from "./routes/payments.js";

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
// Helmet sets sensible defaults: X-Frame-Options, X-Content-Type-Options,
// Strict-Transport-Security, Content-Security-Policy, etc.
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      config.cors.origin,
  credentials: true,  // required for cookies (refresh token)
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
// Stripe webhooks require the raw buffer for HMAC signature verification.
// This route must be registered BEFORE express.json() to avoid double-parsing.
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

// Limit JSON body size to prevent resource exhaustion attacks
app.use(express.json({ limit: "256kb" }));

// Cookie parser — needed for the HttpOnly refresh token cookie
app.use(cookieParser());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",     authRoutes);
app.use("/api/articles", articleRoutes);
app.use("/api/payments", paymentRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
// Checks actual database connectivity — not just that the process is alive.
// Load balancers and Docker healthchecks should use this endpoint.
app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok", database: "reachable" });
  } catch {
    res.status(503).json({ status: "degraded", database: "unreachable" });
  }
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Not found" }));

// ── Centralised error handler ─────────────────────────────────────────────────
app.use(errorHandler);

// ── Scheduled: prune globally expired refresh tokens ─────────────────────────
// Catches any tokens missed by the per-user pruning on login.
// Runs once on startup, then every 24 hours.
async function pruneExpiredRefreshTokens() {
  try {
    const result = await db.query("DELETE FROM refresh_tokens WHERE expires_at < now()");
    if (result.rowCount > 0) {
      console.log(`Pruned ${result.rowCount} expired refresh token(s)`);
    }
  } catch (err) {
    console.error("Failed to prune expired refresh tokens:", err.message);
  }
}

pruneExpiredRefreshTokens();
setInterval(pruneExpiredRefreshTokens, 24 * 60 * 60 * 1000);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`Longform API listening on port ${config.port} (${config.nodeEnv})`);
});
