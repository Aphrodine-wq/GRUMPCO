/**
 * Drift Detector Tests
 *
 * Validates that the architecture drift detector correctly identifies
 * violations across all 5 detection categories.
 */

import { describe, it, expect } from "vitest";
import {
    buildRuleset,
    detectDrift,
    analyzeDrift,
    formatDriftReport,
} from "../../src/services/ship/driftDetector.js";
import type {
    SystemArchitecture,
    ArchitectureRuleset,
} from "../../src/types/architecture.js";
import type { FileDefinition } from "../../src/types/index.js";

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestArchitecture(
    overrides?: Partial<SystemArchitecture>,
): SystemArchitecture {
    return {
        id: "test-arch-001",
        projectName: "Test Project",
        projectDescription: "A test fullstack app",
        projectType: "fullstack",
        complexity: "standard",
        techStack: ["TypeScript", "React", "Express", "PostgreSQL"],
        c4Diagrams: {
            context: "graph TD\n  User --> WebApp\n  WebApp --> API\n  API --> DB",
            container: "graph TD\n  Frontend --> Backend\n  Backend --> Database",
            component: "graph TD\n  Components --> Routes\n  Routes --> Services",
        },
        metadata: {
            components: [
                {
                    id: "frontend",
                    name: "Frontend",
                    description: "React web application",
                    type: "frontend",
                    technology: ["React", "TypeScript"],
                },
                {
                    id: "backend",
                    name: "Backend API",
                    description: "Express REST API",
                    type: "backend",
                    technology: ["Express", "TypeScript"],
                },
                {
                    id: "database",
                    name: "Database",
                    description: "PostgreSQL database",
                    type: "database",
                    technology: ["PostgreSQL"],
                },
            ],
            integrations: [
                {
                    id: "fe-be",
                    source: "frontend",
                    target: "backend",
                    protocol: "REST",
                    description: "Frontend calls backend API",
                },
                {
                    id: "be-db",
                    source: "backend",
                    target: "database",
                    protocol: "SQL",
                    description: "Backend queries database",
                },
            ],
            dataModels: [],
            apiEndpoints: [],
            technologies: {
                frontend: ["React", "TypeScript"],
                backend: ["Express", "Node.js"],
                database: ["PostgreSQL"],
                infrastructure: ["Docker"],
            },
        },
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

// ============================================================================
// buildRuleset Tests
// ============================================================================

describe("buildRuleset", () => {
    it("should extract components from architecture metadata", () => {
        const arch = createTestArchitecture();
        const ruleset = buildRuleset(arch);

        expect(ruleset.components).toHaveLength(3);
        expect(ruleset.components[0].id).toBe("frontend");
        expect(ruleset.components[0].type).toBe("frontend");
    });

    it("should extract allowed integrations", () => {
        const arch = createTestArchitecture();
        const ruleset = buildRuleset(arch);

        expect(ruleset.allowedIntegrations).toHaveLength(2);
        expect(ruleset.allowedIntegrations[0]).toEqual({
            sourceId: "frontend",
            targetId: "backend",
            protocol: "REST",
        });
    });

    it("should normalize tech stack to lowercase", () => {
        const arch = createTestArchitecture();
        const ruleset = buildRuleset(arch);

        expect(ruleset.declaredTech.frontend).toContain("react");
        expect(ruleset.declaredTech.database).toContain("postgresql");
    });

    it("should combine layered and flat tech into allTech", () => {
        const arch = createTestArchitecture();
        const ruleset = buildRuleset(arch);

        expect(ruleset.allTech).toContain("react");
        expect(ruleset.allTech).toContain("express");
        expect(ruleset.allTech).toContain("postgresql");
        expect(ruleset.allTech).toContain("typescript");
    });

    it("should handle empty architecture gracefully", () => {
        const arch = createTestArchitecture({
            metadata: {
                components: [],
                integrations: [],
                dataModels: [],
                apiEndpoints: [],
                technologies: {},
            },
        });

        const ruleset = buildRuleset(arch);
        expect(ruleset.components).toHaveLength(0);
        expect(ruleset.allowedIntegrations).toHaveLength(0);
    });
});

// ============================================================================
// detectDrift — Layer Crossing Tests
// ============================================================================

describe("detectDrift — Layer Crossings", () => {
    const arch = createTestArchitecture();
    const ruleset = buildRuleset(arch);

    it("should detect frontend file importing database package (DRIFT-001)", () => {
        const files: FileDefinition[] = [
            {
                path: "src/components/UserList.tsx",
                content: `
import React from 'react';
import { Pool } from 'pg';

export function UserList() {
  return <div>Users</div>;
}
`,
            },
        ];

        const violations = detectDrift(files, ruleset);
        const dbViolation = violations.find((v) => v.ruleId === "DRIFT-001");

        expect(dbViolation).toBeDefined();
        expect(dbViolation!.severity).toBe("error");
        expect(dbViolation!.category).toBe("layer_crossing");
        expect(dbViolation!.message).toContain("pg");
    });

    it("should detect frontend file importing server-only package (DRIFT-002)", () => {
        const files: FileDefinition[] = [
            {
                path: "src/components/Dashboard.tsx",
                content: `
import React from 'react';
import express from 'express';
`,
            },
        ];

        const violations = detectDrift(files, ruleset);
        const serverViolation = violations.find((v) => v.ruleId === "DRIFT-002");

        expect(serverViolation).toBeDefined();
        expect(serverViolation!.severity).toBe("warning");
        expect(serverViolation!.category).toBe("layer_crossing");
    });

    it("should NOT flag frontend importing react (expected)", () => {
        const files: FileDefinition[] = [
            {
                path: "src/components/App.tsx",
                content: `
import React from 'react';
import { useState } from 'react';
`,
            },
        ];

        const violations = detectDrift(files, ruleset);
        expect(violations.filter((v) => v.category === "layer_crossing")).toHaveLength(0);
    });

    it("should NOT flag relative imports", () => {
        const files: FileDefinition[] = [
            {
                path: "src/components/UserList.tsx",
                content: `
import { something } from '../utils/helpers';
import { apiCall } from './api';
`,
            },
        ];

        const violations = detectDrift(files, ruleset);
        expect(violations.filter((v) => v.category === "layer_crossing")).toHaveLength(0);
    });
});

// ============================================================================
// detectDrift — Reverse Dependency Tests
// ============================================================================

describe("detectDrift — Reverse Dependencies", () => {
    const arch = createTestArchitecture();
    const ruleset = buildRuleset(arch);

    it("should detect backend file importing React (DRIFT-003)", () => {
        const files: FileDefinition[] = [
            {
                path: "src/routes/users.ts",
                content: `
import { Router } from 'express';
import React from 'react';

const router = Router();
export default router;
`,
            },
        ];

        const violations = detectDrift(files, ruleset);
        const reverseViolation = violations.find((v) => v.ruleId === "DRIFT-003");

        expect(reverseViolation).toBeDefined();
        expect(reverseViolation!.severity).toBe("warning");
        expect(reverseViolation!.category).toBe("reverse_dependency");
    });

    it("should detect database layer importing frontend package (DRIFT-004)", () => {
        const files: FileDefinition[] = [
            {
                path: "src/db/migrations/001.ts",
                content: `
import React from 'react';
export const migration = {};
`,
            },
        ];

        const violations = detectDrift(files, ruleset);
        const violation = violations.find((v) => v.ruleId === "DRIFT-004");

        expect(violation).toBeDefined();
        expect(violation!.severity).toBe("error");
    });
});

// ============================================================================
// detectDrift — Tech Mismatch Tests
// ============================================================================

describe("detectDrift — Tech Mismatches", () => {
    const arch = createTestArchitecture();
    const ruleset = buildRuleset(arch);

    it("should detect MongoDB import when architecture declares PostgreSQL (DRIFT-005)", () => {
        const files: FileDefinition[] = [
            {
                path: "src/services/userService.ts",
                content: `
import mongoose from 'mongoose';

export async function getUsers() {
  return mongoose.model('User').find();
}
`,
            },
        ];

        const violations = detectDrift(files, ruleset);
        const techViolation = violations.find((v) => v.ruleId === "DRIFT-005");

        expect(techViolation).toBeDefined();
        expect(techViolation!.severity).toBe("error");
        expect(techViolation!.category).toBe("tech_mismatch");
        expect(techViolation!.message).toContain("mongodb");
        expect(techViolation!.message).toContain("postgresql");
    });

    it("should NOT flag pg import when architecture declares PostgreSQL", () => {
        const files: FileDefinition[] = [
            {
                path: "src/services/database.ts",
                content: `
import { Pool } from 'pg';
const pool = new Pool();
`,
            },
        ];

        const violations = detectDrift(files, ruleset);
        const techViolation = violations.find((v) => v.ruleId === "DRIFT-005");

        expect(techViolation).toBeUndefined();
    });

    it("should skip tech check when no database tech is declared", () => {
        const arch = createTestArchitecture({
            metadata: {
                components: [],
                integrations: [],
                dataModels: [],
                apiEndpoints: [],
                technologies: { frontend: ["React"] },
            },
        });
        const emptyRuleset = buildRuleset(arch);

        const files: FileDefinition[] = [
            {
                path: "src/services/db.ts",
                content: `import mongoose from 'mongoose';`,
            },
        ];

        const violations = detectDrift(files, emptyRuleset);
        const techViolation = violations.find((v) => v.category === "tech_mismatch");
        expect(techViolation).toBeUndefined();
    });
});

// ============================================================================
// analyzeDrift — Full Report Tests
// ============================================================================

describe("analyzeDrift", () => {
    it("should return a passing report for clean code", () => {
        const arch = createTestArchitecture();
        const files: FileDefinition[] = [
            {
                path: "src/components/App.tsx",
                content: `
import React from 'react';
export function App() { return <div>Hello</div>; }
`,
            },
            {
                path: "src/routes/health.ts",
                content: `
import { Router } from 'express';
const router = Router();
router.get('/', (req, res) => res.json({ ok: true }));
export default router;
`,
            },
        ];

        const report = analyzeDrift(arch, files);

        expect(report.passes).toBe(true);
        expect(report.summary.errors).toBe(0);
        expect(report.filesScanned).toBe(2);
        expect(report.architectureId).toBe("test-arch-001");
    });

    it("should return a failing report when errors exist", () => {
        const arch = createTestArchitecture();
        const files: FileDefinition[] = [
            {
                path: "src/components/UserList.tsx",
                content: `
import React from 'react';
import { Pool } from 'pg';
import mongoose from 'mongoose';
`,
            },
        ];

        const report = analyzeDrift(arch, files);

        expect(report.passes).toBe(false);
        expect(report.summary.errors).toBeGreaterThan(0);
        expect(report.violations.length).toBeGreaterThan(0);
    });

    it("should skip empty files", () => {
        const arch = createTestArchitecture();
        const files: FileDefinition[] = [
            { path: "src/empty.ts", content: "" },
            { path: "src/whitespace.ts", content: "   \n\n  " },
        ];

        const report = analyzeDrift(arch, files);
        expect(report.violations).toHaveLength(0);
    });
});

// ============================================================================
// formatDriftReport Tests
// ============================================================================

describe("formatDriftReport", () => {
    it("should show passing message when no violations", () => {
        const arch = createTestArchitecture();
        const report = analyzeDrift(arch, [
            { path: "src/index.ts", content: "console.log('hello');" },
        ]);
        const formatted = formatDriftReport(report);

        expect(formatted).toContain("✅");
        expect(formatted).toContain("Passed");
    });

    it("should show failure message when errors exist", () => {
        const arch = createTestArchitecture();
        const files: FileDefinition[] = [
            {
                path: "src/components/Bad.tsx",
                content: `import { Pool } from 'pg';`,
            },
        ];
        const report = analyzeDrift(arch, files);
        const formatted = formatDriftReport(report);

        expect(formatted).toContain("❌");
        expect(formatted).toContain("Failed");
        expect(formatted).toContain("Layer Crossing");
    });

    it("should group violations by category", () => {
        const arch = createTestArchitecture();
        const files: FileDefinition[] = [
            {
                path: "src/components/Bad.tsx",
                content: `
import { Pool } from 'pg';
import mongoose from 'mongoose';
`,
            },
        ];
        const report = analyzeDrift(arch, files);
        const formatted = formatDriftReport(report);

        expect(formatted).toContain("Layer Crossing");
        expect(formatted).toContain("Technology Mismatch");
    });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Edge Cases", () => {
    it("should handle dynamic imports", () => {
        const arch = createTestArchitecture();
        const ruleset = buildRuleset(arch);
        const files: FileDefinition[] = [
            {
                path: "src/components/LazyLoad.tsx",
                content: `
const db = await import('pg');
const { Pool } = require('pg');
`,
            },
        ];

        const violations = detectDrift(files, ruleset);
        const dbViolations = violations.filter((v) => v.ruleId === "DRIFT-001");
        expect(dbViolations.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle scoped packages (@prisma/client)", () => {
        const arch = createTestArchitecture();
        const ruleset = buildRuleset(arch);
        const files: FileDefinition[] = [
            {
                path: "src/components/Form.tsx",
                content: `import { PrismaClient } from '@prisma/client';`,
            },
        ];

        const violations = detectDrift(files, ruleset);
        const dbViolation = violations.find((v) => v.ruleId === "DRIFT-001");
        expect(dbViolation).toBeDefined();
    });

    it("should handle files with no imports", () => {
        const arch = createTestArchitecture();
        const ruleset = buildRuleset(arch);
        const files: FileDefinition[] = [
            {
                path: "src/utils/constants.ts",
                content: `export const APP_NAME = "Test App";`,
            },
        ];

        const violations = detectDrift(files, ruleset);
        expect(violations.filter((v) => v.category === "layer_crossing")).toHaveLength(0);
    });

    it("should handle multiple violations in a single file", () => {
        const arch = createTestArchitecture();
        const files: FileDefinition[] = [
            {
                path: "src/components/Terrible.tsx",
                content: `
import React from 'react';
import { Pool } from 'pg';
import mongoose from 'mongoose';
import express from 'express';
import redis from 'redis';
`,
            },
        ];

        const report = analyzeDrift(arch, files);
        // Should have multiple violations: pg (layer cross), mongoose (layer cross + tech mismatch),
        // express (layer cross), redis (layer cross + tech mismatch)
        expect(report.violations.length).toBeGreaterThanOrEqual(4);
    });
});
