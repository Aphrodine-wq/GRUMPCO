/**
 * DB Schema Service
 * Generates database schema (SQL DDL, Drizzle) from architecture, PRD, or natural language.
 * Used by agent tools for "schema from diagram/PRD" and ORM output.
 */

import logger from "../middleware/logger.js";
import type { ArchitectureMetadata, DataModel } from "../types/architecture.js";
import { getCompletion } from "./llmGatewayHelper.js";

export type SchemaTargetDb = "sqlite" | "postgres" | "mysql";
export type SchemaFormat = "sql" | "drizzle";

export interface GenerateSchemaResult {
  ddl: string;
  drizzle?: string;
  tables?: string[];
}

const SCHEMA_SYSTEM_PROMPT = `You are a database schema expert. Given an architecture description, PRD excerpt, or structured data models, produce:
1. SQL DDL (CREATE TABLE ...) for the specified target DB.
2. Optionally Drizzle schema (TypeScript) if requested.
Target DBs: sqlite, postgres, mysql. Use appropriate types (e.g. SQLite INTEGER PRIMARY KEY, Postgres SERIAL, TEXT/VARCHAR).
Output only valid SQL and/or Drizzle. No prose outside code blocks.`;

/**
 * Generate DB schema (DDL, optionally Drizzle) from a text description or architecture/PRD excerpt.
 */
export async function generateSchemaFromDescription(
  description: string,
  options: { format?: SchemaFormat; targetDb?: SchemaTargetDb } = {},
): Promise<GenerateSchemaResult> {
  const targetDb = options.targetDb ?? "sqlite";
  const format = options.format ?? "sql";

  const userMsg = `Target DB: ${targetDb}. Format: ${format}. Generate schema for:\n\n${description}\n\nRespond with a \`\`\`sql code block for DDL.${format === "drizzle" ? " Then a ```ts block for Drizzle schema." : ""}\`\`\``;

  try {
    const result = await getCompletion({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SCHEMA_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMsg }],
    });

    if (result.error) {
      logger.warn(
        { err: result.error },
        "dbSchemaService: generateSchemaFromDescription failed",
      );
      return { ddl: `-- Error: ${result.error}`, tables: [] };
    }

    let ddl = "";
    let drizzle: string | undefined;
    const sqlMatch = result.text.match(/```sql\n?([\s\S]*?)\n?```/);
    if (sqlMatch) ddl = sqlMatch[1].trim();
    const tsMatch = result.text.match(
      /```(?:ts|typescript)\n?([\s\S]*?)\n?```/,
    );
    if (tsMatch) drizzle = tsMatch[1].trim();
    const tables = [
      ...ddl.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?\s*["']?(\w+)["']?/gi),
    ].map((m) => m[1]);
    return { ddl, drizzle, tables };
  } catch (e) {
    logger.warn(
      { err: (e as Error).message },
      "dbSchemaService: generateSchemaFromDescription failed",
    );
    return { ddl: `-- Error: ${(e as Error).message}`, tables: [] };
  }
}

/**
 * Generate schema from structured architecture metadata (e.g. dataModels from architecture output).
 */
export async function generateSchemaFromArchitecture(
  architecture: ArchitectureMetadata | string,
): Promise<GenerateSchemaResult> {
  if (typeof architecture === "string") {
    try {
      const parsed = JSON.parse(architecture) as ArchitectureMetadata;
      return generateSchemaFromArchitecture(parsed);
    } catch {
      return generateSchemaFromDescription(architecture, {
        targetDb: "sqlite",
        format: "sql",
      });
    }
  }
  const dataModels = architecture.dataModels || [];
  if (dataModels.length === 0) {
    return generateSchemaFromDescription(
      `Components: ${architecture.components?.map((c) => c.name).join(", ")}. Integrations and endpoints described in architecture.`,
      { targetDb: "sqlite", format: "sql" },
    );
  }
  const description = dataModels
    .map(
      (m: DataModel) =>
        `Table ${m.name}: ${m.fields.map((f) => `${f.name} ${f.type}${f.required ? " NOT NULL" : ""}`).join(", ")}` +
        (m.relationships?.length
          ? `; Relations: ${m.relationships.map((r) => `${r.field} -> ${r.references} (${r.type})`).join("; ")}`
          : ""),
    )
    .join("\n");
  return generateSchemaFromDescription(description, {
    targetDb: "sqlite",
    format: "sql",
  });
}
