import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes     from "./routes/auth.js";
import articleRoutes  from "./routes/articles.js";
import paymentRoutes  from "./routes/payments.js";

const app = express();

// ── Body parsing ──────────────────────────────────────────────────────────────
// Stripe webhooks need the raw buffer for signature verification.
// All other routes get JSON.
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      config.cors.origin,
  credentials: true,
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",     authRoutes);
app.use("/api/articles", articleRoutes);
app.use("/api/payments", paymentRoutes);

// ── Health check (used by Docker and load balancers) ─────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok" }));

// ── 404 for unmatched routes ──────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Not found" }));

// ── Centralised error handler ─────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`Longform API listening on port ${config.port} (${config.nodeEnv})`);
});
