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
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── Cookie configuration ──────────────────────────────────────────────────────
// The refresh token lives in an HttpOnly cookie — inaccessible to JavaScript.
// This eliminates the XSS risk of storing it in localStorage.
const REFRESH_COOKIE_NAME = "longform_refresh";
const refreshCookieOptions = {
  httpOnly:  true,
  secure:    config.nodeEnv === "production",  // HTTPS only in prod
  sameSite:  "strict",
  maxAge:    REFRESH_TOKEN_TTL_MS,
  path:      "/api/auth",  // Cookie only sent to auth endpoints, not every request
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  const hash      = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await db.query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, hash, expiresAt]
  );
  return rawToken;
}

// Delete expired tokens for a user on login to prevent unbounded table growth
async function pruneExpiredTokensForUser(userId) {
  await db.query(
    "DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < now()",
    [userId]
  );
}

function setRefreshCookie(res, rawToken) {
  res.cookie(REFRESH_COOKIE_NAME, rawToken, refreshCookieOptions);
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post("/register", async (req, res, next) => {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password) throw createError(400, "email, name, and password are required");
    if (password.length < 8)         throw createError(400, "Password must be at least 8 characters");
    if (name.length > 100)           throw createError(400, "Name must be 100 characters or fewer");

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await db.queryOne(
      "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name",
      [email.toLowerCase().trim(), name.trim(), passwordHash]
    );

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(user.id, refreshToken);

    setRefreshCookie(res, refreshToken);
    res.status(201).json({ user, accessToken });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw createError(400, "email and password are required");

    const user = await db.queryOne(
      "SELECT id, email, name, password_hash FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    );

    // Always run bcrypt even on missing user — constant-time defence against
    // user enumeration via timing attack
    const passwordValid = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, "$2b$12$invalidsaltinvalidsaltinvalid.");

    if (!user || !passwordValid) throw createError(401, "Invalid email or password");

    // Clean up this user's expired tokens before issuing a new one
    await pruneExpiredTokensForUser(user.id);

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(user.id, refreshToken);

    setRefreshCookie(res, refreshToken);

    const { password_hash: _, ...safeUser } = user;
    res.json({ user: safeUser, accessToken });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
// Reads refresh token from HttpOnly cookie — not from the request body.
router.post("/refresh", async (req, res, next) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawToken) throw createError(401, "No refresh token");

    const hash   = crypto.createHash("sha256").update(rawToken).digest("hex");
    const stored = await db.queryOne(
      `SELECT rt.user_id, rt.expires_at, rt.token_hash,
              u.id, u.email, u.name
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1`,
      [hash]
    );

    if (!stored || stored.expires_at < new Date()) {
      clearRefreshCookie(res);
      throw createError(401, "Invalid or expired session");
    }

    // Rotate: delete old token, issue new one (prevents reuse after theft)
    await db.query("DELETE FROM refresh_tokens WHERE token_hash = $1", [hash]);
    const newRefreshToken = generateRefreshToken();
    await storeRefreshToken(stored.user_id, newRefreshToken);

    const accessToken = generateAccessToken({
      id:    stored.id,
      email: stored.email,
      name:  stored.name,
    });

    setRefreshCookie(res, newRefreshToken);
    res.json({ accessToken, user: { id: stored.id, email: stored.email, name: stored.name } });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post("/logout", authenticate, async (req, res, next) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (rawToken) {
      const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
      await db.query("DELETE FROM refresh_tokens WHERE token_hash = $1", [hash]);
    }
    clearRefreshCookie(res);
    res.json({ message: "Logged out" });
  } catch (err) {
    next(err);
  }
});

export default router;
