/**
 * Migration Service
 * Generates migration files (raw SQL or Drizzle-style) from a schema DDL and target DB.
 * Used by agent tools for "generate migrations" and optionally "apply" (with guard rails).
 */

import logger from "../middleware/logger.js";
import { getCompletion } from "./llmGatewayHelper.js";

export type MigrationTargetDb = "sqlite" | "postgres";

export interface GenerateMigrationsResult {
  migrations: string[];
  summary?: string;
}

const MIGRATION_SYSTEM_PROMPT = `You are a database migration expert. Given a schema DDL, produce one or more migration steps as raw SQL.
Each migration should be a single, idempotent SQL script (use IF NOT EXISTS / IF NOT EXISTS where the target DB supports it).
Target DBs: sqlite, postgres. Output only valid SQL. Return each migration as a separate \`\`\`sql block, in order.`;

/**
 * Generate migration SQL files from existing schema DDL for the given target DB.
 */
export async function generateMigrations(
  schemaDdl: string,
  targetDb: MigrationTargetDb = "sqlite",
): Promise<GenerateMigrationsResult> {
  const userMsg = `Target DB: ${targetDb}\n\nSchema DDL:\n${schemaDdl}\n\nProduce ordered migration SQL blocks.`;

  try {
    const result = await getCompletion({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: MIGRATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMsg }],
    });

    if (result.error) {
      logger.warn(
        { err: result.error },
        "migrationService: generateMigrations failed",
      );
      return { migrations: [`-- Error: ${result.error}`], summary: "Error" };
    }

    const migrations: string[] = [];
    const sqlBlocks = result.text.matchAll(/```sql\n?([\s\S]*?)\n?```/g);
    for (const m of sqlBlocks) migrations.push(m[1].trim());
    if (migrations.length === 0 && result.text.includes("CREATE")) {
      migrations.push(result.text.replace(/```\w*\n?/g, "").trim());
    }
    return {
      migrations,
      summary: `${migrations.length} migration(s) for ${targetDb}`,
    };
  } catch (e) {
    logger.warn(
      { err: (e as Error).message },
      "migrationService: generateMigrations failed",
    );
    return {
      migrations: [`-- Error: ${(e as Error).message}`],
      summary: "Error",
    };
  }
}
