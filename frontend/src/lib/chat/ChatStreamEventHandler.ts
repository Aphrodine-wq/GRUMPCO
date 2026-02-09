/**
 * Chat Stream Event Handler
 *
 * Processes streaming events from the chat API and updates streaming state.
 * Extracted from RefactoredChatInterface.svelte to eliminate the duplicated
 * handleEvent logic between runStreamingChat and runStreamingChatWithMessages.
 */

import type { ChatStreamEvent } from '../chatStreaming';
import type { ContentBlock } from '../../types';
import {
    FILE_WRITE_TOOLS,
    FILE_READ_TOOLS,
    SEARCH_TOOLS_SET,
    EXEC_TOOLS_SET,
    getShortFilePath,
} from './FileActivityTracker';

export interface StreamEventCallbacks {
    /** Called when streaming blocks are updated */
    onBlocksUpdate: (blocks: ContentBlock[]) => void;
    /** Called when streaming status text changes */
    onStatusUpdate: (status: string) => void;
    /** Called when extended thinking content arrives */
    onThinkingUpdate: (thinking: string) => void;
    /** Called when tool names in progress change */
    onToolNamesUpdate: (names: string[]) => void;
    /** Called when a stream error occurs */
    onError: (error: string) => void;
    /** Check whether the component is still mounted */
    isMounted: () => boolean;
    /** Queue a scroll-to-bottom */
    queueScroll: () => void;
}

/**
 * Creates a streaming event handler that processes ChatStreamEvents.
 * This is the single source of truth for how streaming events map to UI state.
 */
export function createStreamEventHandler(callbacks: StreamEventCallbacks) {
    return (event: ChatStreamEvent) => {
        if (!callbacks.isMounted()) return;

        if (event.type === 'text') {
            callbacks.onThinkingUpdate('');

            // Detect content type from accumulated text for smart status
            const accumulatedText = event.blocks
                .filter((b) => b.type === 'text')
                .map((b) => (b as any).content || '')
                .join('')
                .toLowerCase();

            if (accumulatedText.includes('```mermaid')) {
                callbacks.onStatusUpdate('Generating Architecture Chart');
            } else if (/^\s*\d+\.\s+.+\?/m.test(accumulatedText)) {
                callbacks.onStatusUpdate('Asking Questions');
            } else if (
                accumulatedText.includes('```') ||
                accumulatedText.includes('file_write') ||
                accumulatedText.includes('implement')
            ) {
                callbacks.onStatusUpdate('Generating Code');
            } else {
                callbacks.onStatusUpdate('Generating response...');
            }
            callbacks.onBlocksUpdate(event.blocks);
            callbacks.queueScroll();
        } else if (event.type === 'tool_call') {
            callbacks.onThinkingUpdate('');
            const toolCalls = event.blocks.filter(
                (b): b is ContentBlock & { type: 'tool_call'; name: string } => b.type === 'tool_call',
            );
            callbacks.onToolNamesUpdate([...new Set(toolCalls.map((b) => b.name))]);

            const lastBlock = event.blocks[event.blocks.length - 1];
            if (lastBlock?.type === 'tool_call') {
                updateToolCallStatus(lastBlock as any, callbacks);
            }
            callbacks.onBlocksUpdate(event.blocks);
            callbacks.queueScroll();
        } else if (event.type === 'tool_result') {
            const toolCalls = event.blocks.filter(
                (b): b is ContentBlock & { type: 'tool_call'; name: string } => b.type === 'tool_call',
            );
            const toolNames = [...new Set(toolCalls.map((b) => b.name))];
            callbacks.onToolNamesUpdate(toolNames);

            if (toolCalls.length > 0) {
                const lastTool = toolCalls[toolCalls.length - 1] as any;
                const toolName = lastTool.name || '';
                if (toolName === 'file_write' || toolName === 'file_edit') {
                    callbacks.onStatusUpdate('Writing Files...');
                } else if (toolName === 'bash_execute') {
                    callbacks.onStatusUpdate('Running Command');
                } else if (toolName === 'read_file' || toolName === 'list_directory') {
                    callbacks.onStatusUpdate('Exploring Workspace');
                } else {
                    callbacks.onStatusUpdate(
                        toolCalls.length > 1
                            ? `Running: ${toolNames.join(', ')}`
                            : `Running ${toolName}...`,
                    );
                }
            } else {
                callbacks.onStatusUpdate('Generating response...');
            }
            callbacks.onBlocksUpdate(event.blocks);
            callbacks.queueScroll();
        } else if (event.type === 'thinking') {
            callbacks.onStatusUpdate('Thinking...');
            if (typeof event.thinking === 'string') {
                callbacks.onThinkingUpdate(event.thinking);
            }
        } else if (event.type === 'error') {
            callbacks.onStatusUpdate('Error');
            callbacks.onError(event.error || 'Stream error');
        }
    };
}

/** Helper: update status based on the current tool call */
function updateToolCallStatus(
    lastBlock: { name?: string; input?: Record<string, any> },
    callbacks: Pick<StreamEventCallbacks, 'onStatusUpdate' | 'onToolNamesUpdate'> & {
        onToolNamesUpdate: (names: string[]) => void;
    },
) {
    const toolName = lastBlock.name || '';
    const input = lastBlock.input || {};
    const fPath =
        input.path ||
        input.TargetFile ||
        input.AbsolutePath ||
        input.file_path ||
        input.filePath ||
        input.File ||
        input.SearchPath;
    const sPath = typeof fPath === 'string' ? getShortFilePath(fPath) : '';

    if (FILE_WRITE_TOOLS.has(toolName)) {
        callbacks.onStatusUpdate(sPath ? `Writing ${sPath}` : 'Writing Files');
    } else if (EXEC_TOOLS_SET.has(toolName)) {
        callbacks.onStatusUpdate('Running Command');
    } else if (FILE_READ_TOOLS.has(toolName)) {
        callbacks.onStatusUpdate(sPath ? `Reading ${sPath}` : 'Exploring Workspace');
    } else if (SEARCH_TOOLS_SET.has(toolName)) {
        callbacks.onStatusUpdate(fPath ? `Searching in ${sPath}` : 'Searching Codebase');
    } else {
        callbacks.onStatusUpdate(`Running ${toolName}...`);
    }
}
