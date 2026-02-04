/**
 * Canvas Service - shared logic for Live Canvas (A2UI)
 */

const canvasState = new Map<string, Array<Record<string, unknown>>>();

export interface CanvasActionInput {
  sessionId: string;
  action: "create" | "update" | "delete";
  elementId?: string;
  element?: Record<string, unknown>;
}

export function applyCanvasAction(input: CanvasActionInput): {
  elements: Record<string, unknown>[];
} {
  const { sessionId, action, elementId, element } = input;
  let elements = canvasState.get(sessionId) ?? [];

  if (action === "create" && element) {
    elements = [
      ...elements,
      { id: elementId ?? `el_${Date.now()}`, ...element },
    ];
  } else if (action === "update" && elementId && element) {
    elements = elements.map((el) =>
      (el.id as string) === elementId ? { ...el, ...element } : el,
    );
  } else if (action === "delete" && elementId) {
    elements = elements.filter((el) => (el.id as string) !== elementId);
  }

  canvasState.set(sessionId, elements);
  return { elements };
}

export function getCanvasState(sessionId: string): Record<string, unknown>[] {
  return canvasState.get(sessionId) ?? [];
}
