import { Router } from "express";
import { db } from "../db/pool.js";
import { authenticate, optionalAuthenticate } from "../middleware/authenticate.js";
import { createError } from "../middleware/errorHandler.js";
import { applyAccessControl, isFunded, computeCreditTier } from "../services/contributionService.js";
import { dollarsToMicro, microToDollarsDisplay } from "../services/currency.js";

const router = Router();

// ── ROUTE ORDER MATTERS ───────────────────────────────────────────────────────
// /library/mine MUST be registered before /:id, otherwise Express matches the
// string "mine" as a valid article ID and the library endpoint is never reached.

// ── GET /api/articles/library/mine ───────────────────────────────────────────
router.get("/library/mine", authenticate, async (req, res, next) => {
  try {
    // Aggregate by article — compute credit tier from cumulative total
    const articles = await db.queryMany(
      `SELECT
         a.id, a.title, a.excerpt, a.tags,
         a.funding_goal_micro, a.amount_raised_micro, a.published_at,
         u.name AS author_name,
         SUM(c.amount_micro) AS user_total_micro
       FROM contributions c
       JOIN articles a ON a.id = c.article_id
       JOIN users u    ON u.id = a.author_id
       WHERE c.user_id = $1
       GROUP BY a.id, u.name
       ORDER BY a.published_at DESC`,
      [req.user.id]
    );

    const annotated = articles.map((a) => ({
      ...a,
      funding_goal_micro:  Number(a.funding_goal_micro),
      amount_raised_micro: Number(a.amount_raised_micro),
      user_total_micro:    Number(a.user_total_micro),
      credit_tier: computeCreditTier(
        Number(a.user_total_micro),
        Number(a.funding_goal_micro)
      ),
    }));

    res.json({ articles: annotated });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/articles ─────────────────────────────────────────────────────────
router.get("/", optionalAuthenticate, async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  ?? "20", 10), 50);
    const offset = parseInt(req.query.offset ?? "0", 10);

    const articles = await db.queryMany(
      `SELECT
         a.id, a.title, a.excerpt, a.tags,
         a.funding_goal_micro, a.amount_raised_micro,
         a.published_at, a.author_id,
         u.name AS author_name,
         COUNT(DISTINCT c.id)::int AS backer_count
       FROM articles a
       JOIN users u ON u.id = a.author_id
       LEFT JOIN contributions c ON c.article_id = a.id
       GROUP BY a.id, u.name
       ORDER BY a.published_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // One query to fetch all the caller's contribution totals per article
    const userTotals = req.user
      ? await db.queryMany(
          `SELECT article_id, SUM(amount_micro) AS total_micro
           FROM contributions WHERE user_id = $1
           GROUP BY article_id`,
          [req.user.id]
        )
      : [];

    const userTotalMap = Object.fromEntries(
      userTotals.map((r) => [r.article_id, Number(r.total_micro)])
    );

    const annotated = articles.map((a) => {
      const goalMicro    = Number(a.funding_goal_micro);
      const raisedMicro  = Number(a.amount_raised_micro);
      const userMicro    = userTotalMap[a.id] ?? 0;
      const funded       = goalMicro === 0 || raisedMicro >= goalMicro;

      return {
        ...a,
        funding_goal_micro:  goalMicro,
        amount_raised_micro: raisedMicro,
        is_funded:   funded,
        user_access: funded || userMicro > 0,
        user_total_micro: userMicro,
        credit_tier: userMicro > 0
          ? computeCreditTier(userMicro, goalMicro)
          : null,
      };
    });

    res.json({ articles: annotated, limit, offset });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/articles/:id ─────────────────────────────────────────────────────
router.get("/:id", optionalAuthenticate, async (req, res, next) => {
  try {
    const article = await db.queryOne(
      `SELECT a.*, u.name AS author_name
       FROM articles a
       JOIN users u ON u.id = a.author_id
       WHERE a.id = $1`,
      [req.params.id]
    );
    if (!article) throw createError(404, "Article not found");

    // Convert BIGINT columns to JS numbers (pg driver returns them as strings)
    article.funding_goal_micro  = Number(article.funding_goal_micro);
    article.amount_raised_micro = Number(article.amount_raised_micro);

    // Backer list with cumulative totals and derived credit tiers
    const backers = await db.queryMany(
      `SELECT
         c.user_id, u.name,
         SUM(c.amount_micro) AS total_micro
       FROM contributions c
       JOIN users u ON u.id = c.user_id
       WHERE c.article_id = $1
       GROUP BY c.user_id, u.name`,
      [article.id]
    );

    const backersWithTier = backers.map((b) => ({
      ...b,
      total_micro: Number(b.total_micro),
      credit_tier: computeCreditTier(
        Number(b.total_micro),
        article.funding_goal_micro
      ),
    }));

    // User's own cumulative total for this article
    const userTotalRow = req.user
      ? await db.queryOne(
          `SELECT COALESCE(SUM(amount_micro), 0) AS total_micro
           FROM contributions WHERE user_id = $1 AND article_id = $2`,
          [req.user.id, article.id]
        )
      : null;

    const userTotalMicro = Number(userTotalRow?.total_micro ?? 0);
    const controlled     = applyAccessControl(article, req.user?.id, userTotalMicro);

    res.json({
      article: {
        ...controlled,
        is_funded:        isFunded(article),
        backers:          backersWithTier,
        user_total_micro: userTotalMicro,
        credit_tier: userTotalMicro > 0
          ? computeCreditTier(userTotalMicro, article.funding_goal_micro)
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/articles ────────────────────────────────────────────────────────
// Accepts funding_goal_dollars from the client (human input).
// Converts to micro-units immediately — stored value is always micro.
router.post("/", authenticate, async (req, res, next) => {
  try {
    const { title, excerpt, content, tags, funding_goal_dollars } = req.body;

    if (!title?.trim())   throw createError(400, "title is required");
    if (!content?.trim()) throw createError(400, "content is required");
    if (title.trim().length   > 300)    throw createError(400, "title must be 300 characters or fewer");
    if (content.trim().length > 200000) throw createError(400, "content must be 200,000 characters or fewer");

    // Convert human-supplied dollar amount to micro-units at the boundary
    let goalMicro = 0;
    if (funding_goal_dollars !== undefined && funding_goal_dollars !== null && funding_goal_dollars !== "") {
      goalMicro = dollarsToMicro(funding_goal_dollars);
      if (goalMicro < 0) throw createError(400, "funding_goal_dollars must be non-negative");
    }

    const autoExcerpt = excerpt?.trim() || content.trim().split("\n\n")[0].slice(0, 200) + "…";
    const parsedTags  = Array.isArray(tags) ? tags.slice(0, 10) : [];

    const article = await db.queryOne(
      `INSERT INTO articles (author_id, title, excerpt, content, tags, funding_goal_micro)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, excerpt, tags, funding_goal_micro, amount_raised_micro, published_at`,
      [req.user.id, title.trim(), autoExcerpt, content.trim(), parsedTags, goalMicro]
    );

    res.status(201).json({
      article: {
        ...article,
        funding_goal_micro:  Number(article.funding_goal_micro),
        amount_raised_micro: Number(article.amount_raised_micro),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
