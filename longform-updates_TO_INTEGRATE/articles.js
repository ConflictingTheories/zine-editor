import { Router } from "express";
import { db } from "../db/pool.js";
import { authenticate, optionalAuthenticate } from "../middleware/authenticate.js";
import { createError } from "../middleware/errorHandler.js";
import { applyAccessControl, isFunded } from "../services/contributionService.js";

const router = Router();

// ── GET /api/articles  — paginated list with funding status ──────────────────
router.get("/", optionalAuthenticate, async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  ?? "20", 10), 50);
    const offset = parseInt(req.query.offset ?? "0", 10);

    const articles = await db.queryMany(
      `SELECT
         a.id, a.title, a.excerpt, a.tags,
         a.funding_goal, a.amount_raised,
         a.published_at, a.author_id,
         u.name AS author_name,
         COUNT(c.id)::int AS backer_count
       FROM articles a
       JOIN users u ON u.id = a.author_id
       LEFT JOIN contributions c ON c.article_id = a.id
       GROUP BY a.id, u.name
       ORDER BY a.published_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // Fetch caller's contributions to annotate which articles they've unlocked
    const userContributions = req.user
      ? await db.queryMany(
          "SELECT article_id, credit_tier, SUM(amount_cents)/100.0 AS total FROM contributions WHERE user_id = $1 GROUP BY article_id, credit_tier",
          [req.user.id]
        )
      : [];

    const annotated = articles.map((article) => ({
      ...article,
      is_funded:    isFunded(article),
      user_access:  isFunded(article) || userContributions.some((c) => c.article_id === article.id),
      user_credit:  userContributions.find((c) => c.article_id === article.id)?.credit_tier ?? null,
    }));

    res.json({ articles: annotated, limit, offset });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/articles/:id  — full article with access control ─────────────────
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

    const backers = await db.queryMany(
      `SELECT c.user_id, u.name, c.credit_tier,
              SUM(c.amount_cents) / 100.0 AS total_contributed
       FROM contributions c
       JOIN users u ON u.id = c.user_id
       WHERE c.article_id = $1
       GROUP BY c.user_id, u.name, c.credit_tier`,
      [article.id]
    );

    const userContributions = req.user
      ? await db.queryMany(
          "SELECT article_id, credit_tier FROM contributions WHERE user_id = $1 AND article_id = $2",
          [req.user.id, article.id]
        )
      : [];

    const controlled = applyAccessControl(article, req.user?.id, userContributions);

    res.json({
      article: {
        ...controlled,
        is_funded:  isFunded(article),
        backers,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/articles  — publish a new article ───────────────────────────────
router.post("/", authenticate, async (req, res, next) => {
  try {
    const { title, excerpt, content, tags, funding_goal } = req.body;
    if (!title?.trim())   throw createError(400, "title is required");
    if (!content?.trim()) throw createError(400, "content is required");

    const parsedGoal = parseInt(funding_goal ?? "0", 10);
    if (isNaN(parsedGoal) || parsedGoal < 0) throw createError(400, "funding_goal must be a non-negative integer");

    const autoExcerpt = excerpt?.trim() || content.split("\n\n")[0].slice(0, 200) + "…";
    const parsedTags  = Array.isArray(tags) ? tags : [];

    const article = await db.queryOne(
      `INSERT INTO articles (author_id, title, excerpt, content, tags, funding_goal)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, excerpt, tags, funding_goal, amount_raised, published_at`,
      [req.user.id, title.trim(), autoExcerpt, content.trim(), parsedTags, parsedGoal]
    );

    res.status(201).json({ article });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/articles/library/mine  — user's unlocked article library ─────────
router.get("/library/mine", authenticate, async (req, res, next) => {
  try {
    const articles = await db.queryMany(
      `SELECT DISTINCT
         a.id, a.title, a.excerpt, a.tags,
         a.funding_goal, a.amount_raised, a.published_at,
         u.name AS author_name,
         c_user.credit_tier,
         SUM(c_user.amount_cents) / 100.0 AS user_contribution
       FROM contributions c_user
       JOIN articles a ON a.id = c_user.article_id
       JOIN users u ON u.id = a.author_id
       WHERE c_user.user_id = $1
       GROUP BY a.id, u.name, c_user.credit_tier
       ORDER BY a.published_at DESC`,
      [req.user.id]
    );

    res.json({ articles });
  } catch (err) {
    next(err);
  }
});

export default router;
