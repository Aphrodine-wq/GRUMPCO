/**
 * Chat Stream Event Types
 *
 * Shared type definitions for the streaming chat interface between
 * the Claude service and the frontend.
 *
 * @module chatStreamTypes
 */

/** Tracks a file change during a code generation turn */
export interface FileChangeRecord {
    path: string;
    changeType: "created" | "modified" | "deleted";
    linesAdded: number;
    linesRemoved: number;
    toolName: string;
}

export type ChatStreamEvent =
    | { type: "text"; text: string }
    | { type: "thinking"; content: string }
    | { type: "intent"; value: Record<string, unknown> }
    | {
        type: "context";
        value: { mode: string; capabilities?: string[]; toolCount?: number };
    }
    | { type: "tool_planning"; tools: string[] }
    | { type: "tool_progress"; id: string; percent: number; message?: string }
    | {
        type: "tool_call";
        id: string;
        name: string;
        input: Record<string, unknown>;
    }
    | {
        type: "tool_result";
        id: string;
        toolName: string;
        output: string;
        success: boolean;
        executionTime: number;
        diff?: {
            filePath: string;
            beforeContent: string;
            afterContent: string;
            changeType: "created" | "modified" | "deleted";
            operations?: Array<{
                type: string;
                lineStart: number;
                lineEnd?: number;
            }>;
        };
    }
    | { type: "skill_activated"; skillId: string; skillName: string }
    | { type: "autonomous"; value: boolean }
    | {
        type: "agentic_progress";
        currentTurn: number;
        maxTurns: number;
        toolCallCount: number;
    }
    | {
        type: "files_summary";
        files: FileChangeRecord[];
        commandsRun: number;
        commandsPassed: number;
        totalTurns: number;
    }
    | { type: "done" }
    | {
        type: "error";
        message: string;
        toolId?: string;
        errorType?: string;
        retryable?: boolean;
        retryAfter?: number;
        metadata?: Record<string, unknown>;
    };
