import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "../db/pool.js";
import { config } from "../config.js";
import { authenticate } from "../middleware/authenticate.js";
import { createError } from "../middleware/errorHandler.js";

const router = Router();
const BCRYPT_ROUNDS = 12;

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

async function storeRefreshToken(userId, rawToken) {
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await db.query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, hash, expiresAt]
  );
}

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password) throw createError(400, "email, name, and password are required");
    if (password.length < 8)         throw createError(400, "Password must be at least 8 characters");

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await db.queryOne(
      "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name",
      [email.toLowerCase().trim(), name.trim(), passwordHash]
    );

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(user.id, refreshToken);

    res.status(201).json({ user, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw createError(400, "email and password are required");

    const user = await db.queryOne(
      "SELECT id, email, name, password_hash FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    );

    // Constant-time comparison to resist timing attacks
    const passwordValid = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, "$2b$12$invalidhashforcomparison");

    if (!user || !passwordValid) throw createError(401, "Invalid email or password");

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(user.id, refreshToken);

    const { password_hash: _, ...safeUser } = user;
    res.json({ user: safeUser, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw createError(400, "refreshToken is required");

    const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const stored = await db.queryOne(
      `SELECT rt.user_id, rt.expires_at, u.id, u.email, u.name
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1`,
      [hash]
    );

    if (!stored || stored.expires_at < new Date()) {
      throw createError(401, "Invalid or expired refresh token");
    }

    // Rotate — delete old, issue new (prevents token reuse)
    await db.query("DELETE FROM refresh_tokens WHERE token_hash = $1", [hash]);
    const newRefreshToken = generateRefreshToken();
    await storeRefreshToken(stored.user_id, newRefreshToken);

    const accessToken = generateAccessToken({ id: stored.id, email: stored.email, name: stored.name });
    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post("/logout", authenticate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");
      await db.query("DELETE FROM refresh_tokens WHERE token_hash = $1", [hash]);
    }
    res.json({ message: "Logged out" });
  } catch (err) {
    next(err);
  }
});

export default router;
