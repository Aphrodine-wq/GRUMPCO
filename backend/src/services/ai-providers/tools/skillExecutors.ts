/**
 * Skill Executors
 *
 * Execution functions for skill tools, user skill management,
 * and session coordination tools.
 *
 * @module tools/skillExecutors
 */

import type { ToolExecutionResult } from "../../../tools/index.js";
import { skillRegistry } from "../../../skills/index.js";
import {
    createSkill,
    editSkill,
    runSkillTest,
    listSkills,
} from "../../workspace/userSkillsService.js";
import { createSkillContext } from "../../../skills/base/SkillContext.js";
import logger from "../../../middleware/logger.js";

/**
 * Execute a skill tool (prefixed with skill_)
 */
export async function executeSkillTool(
    toolName: string,
    input: Record<string, unknown>,
    workspaceRoot?: string,
): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    const toolHandler = skillRegistry.getToolHandler(toolName);
    if (!toolHandler) {
        return {
            success: false,
            error: `Unknown skill tool: ${toolName}`,
            toolName,
            executionTime: 0,
        };
    }

    const { skill, handler } = toolHandler;
    logger.debug(
        { toolName, skillId: skill.manifest.id },
        "Executing skill tool",
    );

    const context = createSkillContext({
        workspacePath: workspaceRoot,
        source: "chat",
    });

    try {
        const result = await handler(input, context);
        return {
            ...result,
            toolName,
            executionTime: Date.now() - startTime,
        };
    } catch (error: unknown) {
        logger.error(
            { error, toolName, skillId: skill.manifest.id },
            "Skill tool execution failed",
        );
        return {
            success: false,
            error: (error as Error).message,
            toolName,
            executionTime: Date.now() - startTime,
        };
    }
}

export async function executeSkillCreate(
    input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const name = input.name as string;
    const description = input.description as string;
    const tools =
        (input.tools as Array<{ name: string; description: string }>) ?? [];
    const prompts = (input.prompts as Record<string, string>) ?? {};
    if (!name || !description) {
        return {
            success: false,
            error: "name and description required",
            toolName: "skill_create",
            executionTime: Date.now() - start,
        };
    }
    const result = await createSkill(name, description, tools, prompts);
    if (result.success) {
        return {
            success: true,
            output: `Skill created: ${result.skillId}`,
            toolName: "skill_create",
            executionTime: Date.now() - start,
        };
    }
    return {
        success: false,
        error: result.error,
        toolName: "skill_create",
        executionTime: Date.now() - start,
    };
}

export async function executeSkillEdit(
    input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const skillId = input.skillId as string;
    const updates = input.updates as Record<string, unknown>;
    if (!skillId || !updates) {
        return {
            success: false,
            error: "skillId and updates required",
            toolName: "skill_edit",
            executionTime: Date.now() - start,
        };
    }
    const result = await editSkill(
        skillId,
        updates as Parameters<typeof editSkill>[1],
    );
    if (result.success) {
        return {
            success: true,
            output: `Skill ${skillId} updated`,
            toolName: "skill_edit",
            executionTime: Date.now() - start,
        };
    }
    return {
        success: false,
        error: result.error,
        toolName: "skill_edit",
        executionTime: Date.now() - start,
    };
}

export async function executeSkillRunTest(
    input: Record<string, unknown>,
    workspaceRoot?: string,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const skillId = input.skillId as string;
    const testInput = (input.input as Record<string, unknown>) ?? {};
    if (!skillId) {
        return {
            success: false,
            error: "skillId required",
            toolName: "skill_run_test",
            executionTime: Date.now() - start,
        };
    }
    const result = await runSkillTest(skillId, testInput, workspaceRoot);
    const output = result.success
        ? `Test passed. Output: ${result.output}\nDuration: ${result.duration}ms`
        : `Test failed: ${result.error}`;
    return {
        success: result.success,
        output,
        error: result.error,
        toolName: "skill_run_test",
        executionTime: Date.now() - start,
    };
}

export async function executeSkillList(): Promise<ToolExecutionResult> {
    const start = Date.now();
    const skills = await listSkills();
    const lines = skills.map(
        (s) => `- ${s.id}: ${s.name} (${s.version})${s.isUser ? " [user]" : ""}`,
    );
    return {
        success: true,
        output: `Available skills:\n${lines.join("\n")}`,
        toolName: "skill_list",
        executionTime: Date.now() - start,
    };
}

export async function executeSessionsList(
    input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const { sessionsList } = await import("../../session/sessionCoordinatorService.js");
    const limit =
        typeof input.limit === "number" ? Math.min(100, input.limit) : 50;
    const sessions = await sessionsList({ limit });
    const lines = sessions.map(
        (s) =>
            `- ${s.id}: type=${s.type} model=${s.model ?? "N/A"} status=${s.status} started=${s.startedAt}`,
    );
    return {
        success: true,
        output: lines.length
            ? `Sessions:\n${lines.join("\n")}`
            : "No sessions found.",
        toolName: "sessions_list",
        executionTime: Date.now() - start,
    };
}

export async function executeSessionsHistory(
    input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const sessionId = input.sessionId;
    if (typeof sessionId !== "string" || !sessionId.trim()) {
        return {
            success: false,
            error: "sessionId is required",
            toolName: "sessions_history",
            executionTime: Date.now() - start,
        };
    }
    const { sessionsHistory } = await import("../../session/sessionCoordinatorService.js");
    const hist = await sessionsHistory(sessionId.trim());
    if (!hist) {
        return {
            success: false,
            error: `Session ${sessionId} not found`,
            toolName: "sessions_history",
            executionTime: Date.now() - start,
        };
    }
    const lines = hist.messages.map((m) => `[${m.role}]: ${m.content}`);
    return {
        success: true,
        output: lines.length
            ? `Transcript:\n${lines.join("\n")}`
            : "No messages in session.",
        toolName: "sessions_history",
        executionTime: Date.now() - start,
    };
}

export async function executeSessionsSend(
    input: Record<string, unknown>,
): Promise<ToolExecutionResult> {
    const start = Date.now();
    const sessionId = input.sessionId;
    const message = input.message;
    if (typeof sessionId !== "string" || !sessionId.trim()) {
        return {
            success: false,
            error: "sessionId is required",
            toolName: "sessions_send",
            executionTime: Date.now() - start,
        };
    }
    if (typeof message !== "string" || !message.trim()) {
        return {
            success: false,
            error: "message is required",
            toolName: "sessions_send",
            executionTime: Date.now() - start,
        };
    }
    const { sessionsSend } = await import("../../session/sessionCoordinatorService.js");
    const result = await sessionsSend(sessionId.trim(), message.trim());
    if (!result.ok) {
        return {
            success: false,
            error: result.error ?? "Send failed",
            toolName: "sessions_send",
            executionTime: Date.now() - start,
        };
    }
    const output = result.reply
        ? `Reply from session:\n${result.reply}`
        : result.queued
            ? "Message queued for session."
            : "Message sent.";
    return {
        success: true,
        output,
        toolName: "sessions_send",
        executionTime: Date.now() - start,
    };
}
