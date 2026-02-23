import pg from "pg";
import { config } from "../config.js";

// Single pool instance shared across the app
const pool = new pg.Pool({
  connectionString: config.database.connectionString,
  ssl: config.database.ssl,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("Unexpected postgres client error:", err);
});

// Thin helpers to keep query calls readable
export const db = {
  query: (text, params) => pool.query(text, params),

  // Returns first row or null
  queryOne: async (text, params) => {
    const result = await pool.query(text, params);
    return result.rows[0] ?? null;
  },

  // Returns all rows
  queryMany: async (text, params) => {
    const result = await pool.query(text, params);
    return result.rows;
  },

  // Runs multiple statements in a transaction
  transaction: async (callback) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};
