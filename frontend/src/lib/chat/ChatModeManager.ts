/**
 * Chat Mode Manager
 *
 * Manages chat mode state (normal/plan/spec/ship/design/argument/code)
 */

export type ChatMode =
  | 'normal'
  | 'plan'
  | 'spec'
  | 'ship'
  | 'execute'
  | 'design'
  | 'argument'
  | 'code';

export interface ModeState {
  chatMode: ChatMode;
  showShipConfirmModal: boolean;
}

export function createModeState(): ModeState {
  return {
    chatMode: 'normal',
    showShipConfirmModal: false,
  };
}

export function setChatMode(state: ModeState, mode: ChatMode): void {
  state.chatMode = mode;
}

export function isShipModeActive(state: ModeState): boolean {
  return state.chatMode === 'ship';
}

export function showShipConfirm(state: ModeState): void {
  state.showShipConfirmModal = true;
}

export function hideShipConfirm(state: ModeState): void {
  state.showShipConfirmModal = false;
}

export function toggleMode(state: ModeState, mode: ChatMode): void {
  if (state.chatMode === mode) {
    state.chatMode = 'normal';
  } else {
    state.chatMode = mode;
  }
}
