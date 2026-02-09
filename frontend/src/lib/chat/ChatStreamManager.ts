/**
 * Chat Stream Manager
 * 
 * Handles stream lifecycle, abort handling, and error recovery
 * for the chat interface.
 */

import type { ContentBlock } from '../../types';

export interface StreamState {
  streaming: boolean;
  streamingStatus: string;
  streamingBlocks: ContentBlock[];
  streamingThinking: string;
  streamingToolNames: string[];
  streamError: string | null;
}

export interface StreamRefs {
  mounted: { current: boolean };
  controller: { current: AbortController | null };
}

export function createStreamState(): StreamState {
  return {
    streaming: false,
    streamingStatus: 'Thinking...',
    streamingBlocks: [],
    streamingThinking: '',
    streamingToolNames: [],
    streamError: null,
  };
}

export function createStreamRefs(): StreamRefs {
  return {
    mounted: { current: true },
    controller: { current: null },
  };
}

export function abortStream(refs: StreamRefs): void {
  if (refs.controller.current) {
    refs.controller.current.abort();
    refs.controller.current = null;
  }
}

export function cleanupStream(refs: StreamRefs): void {
  refs.mounted.current = false;
  abortStream(refs);
}

export function startStream(state: StreamState): void {
  state.streaming = true;
  state.streamingStatus = 'Thinking...';
  state.streamingBlocks = [];
  state.streamingThinking = '';
  state.streamingToolNames = [];
  state.streamError = null;
}

export function endStream(state: StreamState, error?: string): void {
  state.streaming = false;
  if (error) {
    state.streamError = error;
  }
}

export function updateStreamStatus(state: StreamState, status: string): void {
  state.streamingStatus = status;
}

export function addStreamingBlock(state: StreamState, block: ContentBlock): void {
  state.streamingBlocks = [...state.streamingBlocks, block];
}

export function addStreamingThinking(state: StreamState, thinking: string): void {
  state.streamingThinking += thinking;
}

export function addStreamingToolName(state: StreamState, toolName: string): void {
  if (!state.streamingToolNames.includes(toolName)) {
    state.streamingToolNames = [...state.streamingToolNames, toolName];
  }
}
