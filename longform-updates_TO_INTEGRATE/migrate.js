import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, "schema.sql");

async function migrate() {
  const client = new pg.Client({ connectionString: config.database.connectionString });

  try {
    await client.connect();
    console.log("Running database migration...");

    const schema = readFileSync(schemaPath, "utf8");
    await client.query(schema);

    console.log("Migration complete.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
