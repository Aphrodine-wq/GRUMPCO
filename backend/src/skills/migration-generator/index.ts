/**
 * Migration Generator Skill
 * Generate database migration files for schema changes
 */
import type { SkillContext, ToolDefinition, ToolExecutionResult } from "../types.js";

export const tools = {
    definitions: [
        {
            name: "generate_migration",
            description: "Generate a database migration file with up and down SQL statements",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string", description: "Migration name (e.g. add_users_table)" },
                    dialect: { type: "string", enum: ["postgresql", "mysql", "sqlite"], description: "SQL dialect" },
                    changes: { type: "string", description: "Description of schema changes" },
                },
                required: ["name", "changes"],
            },
        },
        {
            name: "analyze_schema",
            description: "Analyze current database schema and suggest optimizations or missing indexes",
            input_schema: {
                type: "object",
                properties: {
                    schema: { type: "string", description: "SQL schema or ORM model definitions" },
                },
                required: ["schema"],
            },
        },
    ] as ToolDefinition[],

    async execute(
        toolName: string,
        input: Record<string, unknown>,
        context: SkillContext,
    ): Promise<ToolExecutionResult> {
        switch (toolName) {
            case "generate_migration": {
                const name = input.name as string;
                const dialect = (input.dialect as string) || "postgresql";
                const changes = input.changes as string;
                const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
                const filename = `${timestamp}_${name}.sql`;

                return {
                    success: true,
                    output: JSON.stringify({
                        filename,
                        dialect,
                        template: `-- Migration: ${name}\n-- Created: ${new Date().toISOString()}\n-- Dialect: ${dialect}\n-- Changes: ${changes}\n\n-- UP\n-- TODO: Add your schema changes here\n\n-- DOWN\n-- TODO: Add rollback statements here\n`,
                        suggestions: [
                            "Add indexes for frequently queried columns",
                            "Consider adding NOT NULL constraints with defaults",
                            "Add foreign key constraints for referential integrity",
                        ],
                    }),
                };
            }

            case "analyze_schema": {
                const schema = input.schema as string;
                return {
                    success: true,
                    output: JSON.stringify({
                        analysis: {
                            tables: schema.split("CREATE TABLE").length - 1,
                            suggestions: [
                                "Add created_at/updated_at timestamps to all tables",
                                "Consider adding composite indexes for common query patterns",
                                "Review column types for storage optimization",
                                "Add CHECK constraints for data validation",
                            ],
                        },
                    }),
                };
            }

            default:
                return { success: false, output: `Unknown tool: ${toolName}` };
        }
    },
};

export const prompts = {
    system: `You are a database migration expert. When generating migrations:
1. Always include both UP and DOWN statements for reversibility
2. Use transactions for atomic changes
3. Consider data preservation during column modifications
4. Add appropriate indexes and constraints
5. Follow the naming convention: timestamp_description.sql`,
};
