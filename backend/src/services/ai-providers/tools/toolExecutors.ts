/**
 * Tool Executors
 *
 * Individual tool execution functions extracted from ClaudeServiceWithTools.
 * Each function validates input via Zod schema and delegates to the
 * appropriate service layer.
 *
 * @module tools/toolExecutors
 */

import type { ToolExecutionResult } from "../../../tools/index.js";
import {
    bashExecuteInputSchema,
    fileReadInputSchema,
    fileWriteInputSchema,
    fileEditInputSchema,
    listDirectoryInputSchema,
    codebaseSearchInputSchema,
    grepSearchInputSchema,
    searchAndReplaceInputSchema,
    generateDbSchemaInputSchema,
    generateMigrationsInputSchema,
    screenshotUrlInputSchema,
    browserRunScriptInputSchema,
    browserNavigateInputSchema,
    browserClickInputSchema,
    browserTypeInputSchema,
    browserGetContentInputSchema,
    browserScreenshotInputSchema,
    gitStatusInputSchema,
    gitDiffInputSchema,
    gitLogInputSchema,
    gitCommitInputSchema,
    gitBranchInputSchema,
    gitPushInputSchema,
    terminalExecuteInputSchema,
} from "../../../tools/index.js";
import { generateSchemaFromDescription } from "../../platform/dbSchemaService.js";
import { generateMigrations } from "../../platform/migrationService.js";
import {
    screenshotUrl,
    browserRunScript,
    browserNavigate,
    browserClick,
    browserType,
    browserGetContent,
    browserScreenshot,
    type BrowserStep,
} from "../../workspace/browserService.js";
import type { ToolExecutionService } from "../../workspace/toolExecutionService.js";

// ============================================================================
// File & Code Tools
// ============================================================================

export async function executeBash(
    input: Record<string, unknown>,
    tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
    const validation = bashExecuteInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "bash_execute",
            executionTime: 0,
        };
    }
    const { command, workingDirectory, timeout } = validation.data;
    return await tes.executeBash(command, workingDirectory, timeout);
}

export async function executeFileRead(
    input: Record<string, unknown>,
    tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
    const validation = fileReadInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "file_read",
            executionTime: 0,
        };
    }
    const { path, encoding, startLine, endLine } = validation.data;
    return await tes.readFile(path, encoding, startLine, endLine);
}

export async function executeFileWrite(
    input: Record<string, unknown>,
    tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
    const validation = fileWriteInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "file_write",
            executionTime: 0,
        };
    }
    const { path, content, createDirectories } = validation.data;
    return await tes.writeFile(path, content, createDirectories);
}

export async function executeFileEdit(
    input: Record<string, unknown>,
    tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
    const validation = fileEditInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "file_edit",
            executionTime: 0,
        };
    }
    const { path, operations } = validation.data;
    const typedOps = operations.map((op) => ({
        type: op.type as "insert" | "replace" | "delete",
        lineStart: op.lineStart,
        lineEnd: op.lineEnd,
        content: op.content,
    }));
    return await tes.editFile(path, typedOps);
}

export async function executeListDirectory(
    input: Record<string, unknown>,
    tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
    const validation = listDirectoryInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "list_directory",
            executionTime: 0,
        };
    }
    const { path, recursive } = validation.data;
    return await tes.listDirectory(path, recursive);
}

export async function executeCodebaseSearch(
    input: Record<string, unknown>,
    tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
    const validation = codebaseSearchInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "codebase_search",
            executionTime: 0,
        };
    }
    const { query, workingDirectory, maxResults } = validation.data;
    return await tes.searchCodebase(query, workingDirectory, maxResults);
}

export async function executeGrepSearch(
    input: Record<string, unknown>,
    tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
    const validation = grepSearchInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "grep_search",
            executionTime: 0,
        };
    }
    const { pattern, path, isRegex, includes, maxResults, caseSensitive } = validation.data;
    return await tes.grepSearch(pattern, path, isRegex, includes, maxResults, caseSensitive);
}

export async function executeSearchAndReplace(
    input: Record<string, unknown>,
    tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
    const validation = searchAndReplaceInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "search_and_replace",
            executionTime: 0,
        };
    }
    const { path, search, replace, allowMultiple } = validation.data;
    return await tes.searchAndReplace(path, search, replace, allowMultiple);
}

export async function executeTerminalExecute(
    input: Record<string, unknown>,
    tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
    const validation = terminalExecuteInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "terminal_execute",
            executionTime: 0,
        };
    }
    const { command, workingDirectory, timeout } = validation.data;
    return await tes.executeTerminal(command, workingDirectory, timeout);
}

// ============================================================================
// Git Tools
// ============================================================================

export async function executeGitStatus(
    input: Record<string, unknown>,
    tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
    const validation = gitStatusInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "git_status",
            executionTime: 0,
        };
    }
    return await tes.gitStatus(validation.data.workingDirectory);
}

export async function executeGitDiff(
    input: Record<string, unknown>,
    tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
    const validation = gitDiffInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "git_diff",
            executionTime: 0,
        };
    }
    const { workingDirectory, staged, file } = validation.data;
    return await tes.gitDiff(workingDirectory, staged, file);
}

export async function executeGitLog(
    input: Record<string, unknown>,
    tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
    const validation = gitLogInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "git_log",
            executionTime: 0,
        };
    }
    const { workingDirectory, maxCount, oneline } = validation.data;
    return await tes.gitLog(workingDirectory, maxCount, oneline);
}

export async function executeGitCommit(
    input: Record<string, unknown>,
    tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
    const validation = gitCommitInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "git_commit",
            executionTime: 0,
        };
    }
    const { message, workingDirectory, addAll } = validation.data;
    return await tes.gitCommit(message, workingDirectory, addAll);
}

export async function executeGitBranch(
    input: Record<string, unknown>,
    tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
    const validation = gitBranchInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "git_branch",
            executionTime: 0,
        };
    }
    const { workingDirectory, list, create } = validation.data;
    return await tes.gitBranch(workingDirectory, list ?? true, create);
}

export async function executeGitPush(
    input: Record<string, unknown>,
    tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
    const validation = gitPushInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "git_push",
            executionTime: 0,
        };
    }
    const { workingDirectory, remote, branch } = validation.data;
    return await tes.gitPush(workingDirectory, remote, branch);
}

// ============================================================================
// Database Tools
// ============================================================================

export async function executeGenerateDbSchema(
    input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = generateDbSchemaInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "generate_db_schema",
            executionTime: 0,
        };
    }
    try {
        const { description, targetDb, format } = validation.data;
        const result = await generateSchemaFromDescription(description, {
            targetDb: targetDb as "sqlite" | "postgres" | "mysql",
            format: format as "sql" | "drizzle",
        });
        let output = `DDL:\n${result.ddl}`;
        if (result.drizzle) output += `\n\nDrizzle schema:\n${result.drizzle}`;
        if (result.tables?.length)
            output += `\n\nTables: ${result.tables.join(", ")}`;
        return {
            success: true,
            output,
            toolName: "generate_db_schema",
            executionTime: Date.now() - start,
        };
    } catch (e) {
        return {
            success: false,
            error: (e as Error).message,
            toolName: "generate_db_schema",
            executionTime: Date.now() - start,
        };
    }
}

export async function executeGenerateMigrations(
    input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = generateMigrationsInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "generate_migrations",
            executionTime: 0,
        };
    }
    try {
        const { schemaDdl, targetDb } = validation.data;
        const result = await generateMigrations(
            schemaDdl,
            targetDb as "sqlite" | "postgres",
        );
        const output = result.migrations.length
            ? result.migrations
                .map((m, i) => `-- Migration ${i + 1}\n${m}`)
                .join("\n\n")
            : "No migrations generated.";
        return {
            success: true,
            output: (result.summary ? `${result.summary}\n\n` : "") + output,
            toolName: "generate_migrations",
            executionTime: Date.now() - start,
        };
    } catch (e) {
        return {
            success: false,
            error: (e as Error).message,
            toolName: "generate_migrations",
            executionTime: Date.now() - start,
        };
    }
}

// ============================================================================
// Browser Tools
// ============================================================================

export async function executeScreenshotUrl(
    input: Record<string, unknown>,
    gAgentExternalAllowlist?: string[] | null,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = screenshotUrlInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "screenshot_url",
            executionTime: 0,
        };
    }
    const url = validation.data.url;
    if (gAgentExternalAllowlist?.length) {
        try {
            const host = new URL(url).hostname.toLowerCase();
            const allowed = gAgentExternalAllowlist.map((h: string) =>
                h.toLowerCase().trim(),
            );
            if (!allowed.includes(host)) {
                return {
                    success: false,
                    error: `URL host "${host}" is not in G-Agent external allowlist. Add the domain in G-Agent settings.`,
                    toolName: "screenshot_url",
                    executionTime: Date.now() - start,
                };
            }
        } catch {
            return {
                success: false,
                error: "Invalid URL",
                toolName: "screenshot_url",
                executionTime: Date.now() - start,
            };
        }
    }
    const result = await screenshotUrl(url);
    if (!result.ok) {
        return {
            success: false,
            error: result.error ?? "Screenshot failed",
            toolName: "screenshot_url",
            executionTime: Date.now() - start,
        };
    }
    const output = result.imageBase64
        ? `Screenshot captured (base64 PNG, ${result.imageBase64.length} chars). Use for visual verification.`
        : "Screenshot captured.";
    return {
        success: true,
        output,
        toolName: "screenshot_url",
        executionTime: Date.now() - start,
    };
}

export async function executeBrowserRunScript(
    input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = browserRunScriptInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "browser_run_script",
            executionTime: 0,
        };
    }
    const result = await browserRunScript(
        validation.data.steps as BrowserStep[],
    );
    if (!result.ok) {
        return {
            success: false,
            error: result.error ?? "Script failed",
            toolName: "browser_run_script",
            executionTime: Date.now() - start,
        };
    }
    const parts = result.logs ? [`Steps: ${result.logs.join("; ")}`] : [];
    if (result.lastUrl) parts.push(`Last URL: ${result.lastUrl}`);
    if (result.screenshotBase64)
        parts.push(
            `Screenshot captured (base64, ${result.screenshotBase64.length} chars)`,
        );
    return {
        success: true,
        output: parts.join("\n") || "Script completed.",
        toolName: "browser_run_script",
        executionTime: Date.now() - start,
    };
}

export async function executeBrowserNavigate(
    input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = browserNavigateInputSchema.safeParse(input);
    if (!validation.success)
        return {
            success: false,
            error: validation.error.message,
            toolName: "browser_navigate",
            executionTime: 0,
        };
    const res = await browserNavigate(
        validation.data.url,
        validation.data.timeout,
    );
    return {
        success: res.ok,
        output: res.ok
            ? `Navigated to ${res.result?.url}. Title: ${res.result?.title}`
            : res.error,
        toolName: "browser_navigate",
        executionTime: Date.now() - start,
    };
}

export async function executeBrowserClick(
    input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = browserClickInputSchema.safeParse(input);
    if (!validation.success)
        return {
            success: false,
            error: validation.error.message,
            toolName: "browser_click",
            executionTime: 0,
        };
    const { selector, url } = validation.data;
    const res = await browserClick(selector, url);
    return {
        success: res.ok,
        output: res.ok ? `Clicked element: ${selector}` : res.error,
        toolName: "browser_click",
        executionTime: Date.now() - start,
    };
}

export async function executeBrowserType(
    input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = browserTypeInputSchema.safeParse(input);
    if (!validation.success)
        return {
            success: false,
            error: validation.error.message,
            toolName: "browser_type",
            executionTime: 0,
        };
    const { selector, text, url } = validation.data;
    const res = await browserType(selector, text, url);
    return {
        success: res.ok,
        output: res.ok ? `Typed "${text}" into ${selector}` : res.error,
        toolName: "browser_type",
        executionTime: Date.now() - start,
    };
}

export async function executeBrowserGetContent(
    input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = browserGetContentInputSchema.safeParse(input);
    if (!validation.success)
        return {
            success: false,
            error: validation.error.message,
            toolName: "browser_get_content",
            executionTime: 0,
        };
    const res = await browserGetContent(validation.data.url);
    return {
        success: res.ok,
        output: res.ok
            ? `HTML Length: ${res.html?.length}\nText Content:\n${res.text?.substring(0, 5000)}`
            : res.error,
        toolName: "browser_get_content",
        executionTime: Date.now() - start,
    };
}

export async function executeBrowserScreenshot(
    input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const validation = browserScreenshotInputSchema.safeParse(input);
    if (!validation.success)
        return {
            success: false,
            error: validation.error.message,
            toolName: "browser_screenshot",
            executionTime: 0,
        };
    const res = await browserScreenshot(
        validation.data.url,
        validation.data.fullPage,
    );
    return {
        success: res.ok,
        output: res.ok ? "Screenshot captured." : res.error,
        toolName: "browser_screenshot",
        executionTime: Date.now() - start,
    };
}

export async function executeBrowserSnapshot(
    input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const { browserSnapshot } = await import("../../workspace/chromeCdpService.js");
    const url = typeof input.url === "string" ? input.url : undefined;
    const profile =
        typeof input.profile === "string" ? input.profile : undefined;
    const res = await browserSnapshot(url, profile);
    return {
        success: res.ok,
        output: res.ok ? res.snapshot : res.error,
        toolName: "browser_snapshot",
        executionTime: Date.now() - start,
    };
}

export async function executeBrowserUpload(
    input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const selector = input.selector;
    const filePath = input.filePath;
    if (typeof selector !== "string" || typeof filePath !== "string") {
        return {
            success: false,
            error: "selector and filePath required",
            toolName: "browser_upload",
            executionTime: 0,
        };
    }
    const { browserUpload } = await import("../../workspace/chromeCdpService.js");
    const res = await browserUpload(selector, filePath, {
        url: typeof input.url === "string" ? input.url : undefined,
        profile: typeof input.profile === "string" ? input.profile : undefined,
    });
    return {
        success: res.ok,
        output: res.ok ? "File uploaded." : res.error,
        toolName: "browser_upload",
        executionTime: Date.now() - start,
    };
}

export async function executeBrowserProfilesList(): Promise<ToolExecutionResult> {
    const start = Date.now();
    const { listProfiles } = await import("../../workspace/chromeCdpService.js");
    const profiles = await listProfiles();
    return {
        success: true,
        output: `Profiles: ${profiles.join(", ")}`,
        toolName: "browser_profiles_list",
        executionTime: Date.now() - start,
    };
}

export async function executeBrowserProfileSwitch(
    input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const profile = input.profile;
    if (typeof profile !== "string") {
        return {
            success: false,
            error: "profile required",
            toolName: "browser_profile_switch",
            executionTime: 0,
        };
    }
    const { switchProfile } = await import("../../workspace/chromeCdpService.js");
    switchProfile(profile);
    return {
        success: true,
        output: `Switched to profile: ${profile}`,
        toolName: "browser_profile_switch",
        executionTime: Date.now() - start,
    };
}

// ============================================================================
// Device / System Tools (Electron-only stubs + system_exec)
// ============================================================================

export async function executeCameraCapture(): Promise<ToolExecutionResult> {
    const start = Date.now();
    return {
        success: false,
        output:
            "camera_capture requires Electron desktop app with camera permission. Use the desktop app and grant camera access.",
        toolName: "camera_capture",
        executionTime: Date.now() - start,
    };
}

export async function executeScreenRecord(
    _input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    return {
        success: false,
        output:
            "screen_record requires Electron desktop app with screen capture permission.",
        toolName: "screen_record",
        executionTime: Date.now() - start,
    };
}

export async function executeLocationGet(): Promise<ToolExecutionResult> {
    const start = Date.now();
    return {
        success: false,
        output:
            "location_get requires Electron desktop app with location permission.",
        toolName: "location_get",
        executionTime: Date.now() - start,
    };
}

export async function executeSystemExec(
    input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const command = input.command;
    if (typeof command !== "string" || !command.trim()) {
        return {
            success: false,
            error: "command required",
            toolName: "system_exec",
            executionTime: 0,
        };
    }
    const { execSync } = await import("child_process");
    const STRICT = process.env.STRICT_COMMAND_ALLOWLIST === "true";
    const ALLOWED = new Set([
        "npm",
        "npx",
        "node",
        "git",
        "pnpm",
        "yarn",
        "tsx",
        "ts-node",
        "ls",
        "pwd",
    ]);
    if (STRICT) {
        const first =
            command
                .trim()
                .split(/\s+/)[0]
                ?.replace(/^[\s"']+|["']$/g, "") ?? "";
        const base = first.split("/").pop() ?? first;
        if (!ALLOWED.has(base.toLowerCase())) {
            return {
                success: false,
                error: `Command not in allowlist: ${base}. Set STRICT_COMMAND_ALLOWLIST=false or add to allowlist.`,
                toolName: "system_exec",
                executionTime: Date.now() - start,
            };
        }
    }
    try {
        const out = execSync(command.trim(), {
            encoding: "utf8",
            timeout: 30000,
        });
        return {
            success: true,
            output: out || "(no output)",
            toolName: "system_exec",
            executionTime: Date.now() - start,
        };
    } catch (e) {
        const err = e as { stdout?: string; stderr?: string; message?: string };
        return {
            success: false,
            output: err.stderr || err.stdout || err.message,
            toolName: "system_exec",
            executionTime: Date.now() - start,
        };
    }
}

export async function executeCanvasUpdate(
    input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const sessionId = input.sessionId;
    const action = input.action;
    if (typeof sessionId !== "string" || typeof action !== "string") {
        return {
            success: false,
            error: "sessionId and action required",
            toolName: "canvas_update",
            executionTime: 0,
        };
    }
    try {
        const { applyCanvasAction } = await import("../../workspace/canvasService.js");
        const result = await applyCanvasAction({
            sessionId,
            action: action as "create" | "update" | "delete",
            elementId:
                typeof input.elementId === "string" ? input.elementId : undefined,
            element:
                typeof input.element === "object" && input.element
                    ? (input.element as Record<string, unknown>)
                    : undefined,
        });
        return {
            success: true,
            output: `Canvas updated. Elements: ${JSON.stringify(result.elements ?? []).slice(0, 500)}`,
            toolName: "canvas_update",
            executionTime: Date.now() - start,
        };
    } catch (e) {
        return {
            success: false,
            output: (e as Error).message,
            toolName: "canvas_update",
            executionTime: Date.now() - start,
        };
    }
}

// ============================================================================
// Code Navigation Tools
// ============================================================================

export async function executeFileOutline(
    input: Record<string, unknown>,
    tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
    const { fileOutlineInputSchema } = await import("../../../tools/outline/index.js");
    const validation = fileOutlineInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            success: false,
            error: `Invalid input: ${validation.error.message}`,
            toolName: "file_outline",
            executionTime: 0,
        };
    }
    const { path, maxItems } = validation.data;
    return await tes.fileOutline(path, maxItems);
}
