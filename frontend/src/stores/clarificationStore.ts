import { writable, derived } from 'svelte/store';

// Clarification types
export interface ClarificationOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
}

export interface ClarificationQuestion {
  id: string;
  category: 'complexity' | 'domain' | 'scope' | 'features' | 'diagramType' | 'custom';
  question: string;
  selectionType: 'single' | 'multiple';
  options: ClarificationOption[];
  required?: boolean;
}

export interface ClarificationPayload {
  questions: ClarificationQuestion[];
  context?: string;
}

export interface ClarificationAnswer {
  questionId: string;
  selectedOptionIds: string[];
}

// Create stores
export const isOpen = writable<boolean>(false);
export const currentClarification = writable<ClarificationPayload | null>(null);
export const answers = writable<Map<string, string[]>>(new Map());

// Derived store
export const isValid = derived(
  [currentClarification, answers],
  ([$currentClarification, $answers]) => {
    if (!$currentClarification) return false;

    return $currentClarification.questions
      .filter(q => q.required !== false)
      .every(q => {
        const answer = $answers.get(q.id);
        return answer && answer.length > 0;
      });
  }
);

let resolveCallback: ((answers: ClarificationAnswer[]) => void) | null = null;

export function openModal(clarification: ClarificationPayload): Promise<ClarificationAnswer[]> {
  return new Promise((resolve) => {
    currentClarification.set(clarification);
    answers.set(new Map());
    isOpen.set(true);
    resolveCallback = resolve;
  });
}

export function closeModal(): void {
  isOpen.set(false);
  currentClarification.set(null);
  answers.set(new Map());
  if (resolveCallback) {
    // Return empty answers on cancel
    resolveCallback([]);
  }
  resolveCallback = null;
}

export function setAnswer(questionId: string, optionIds: string[]): void {
  answers.update(a => {
    const newMap = new Map(a);
    newMap.set(questionId, optionIds);
    return newMap;
  });
}

export function toggleOption(questionId: string, optionId: string, selectionType: 'single' | 'multiple'): void {
  answers.update(a => {
    const current = a.get(questionId) || [];
    const newMap = new Map(a);

    if (selectionType === 'single') {
      newMap.set(questionId, [optionId]);
    } else {
      const index = current.indexOf(optionId);
      if (index > -1) {
        const updated = [...current];
        updated.splice(index, 1);
        newMap.set(questionId, updated);
      } else {
        newMap.set(questionId, [...current, optionId]);
      }
    }

    return newMap;
  });
}

export function submitAnswers(): void {
  if (!resolveCallback) {
    let current: ClarificationPayload | null = null;
    currentClarification.subscribe(c => {
      current = c;
    })();
    if (!current) return;
  }

  let current: ClarificationPayload | null = null;
  let currentAnswers: Map<string, string[]> = new Map();
  
  currentClarification.subscribe(c => {
    current = c;
  })();
  
  answers.subscribe(a => {
    currentAnswers = a;
  })();

  if (!resolveCallback || !current) return;

  const formattedAnswers: ClarificationAnswer[] = current.questions.map(q => ({
    questionId: q.id,
    selectedOptionIds: currentAnswers.get(q.id) || []
  }));

  resolveCallback(formattedAnswers);
  isOpen.set(false);
  currentClarification.set(null);
  answers.set(new Map());
  resolveCallback = null;
}

// Reset function for testing
export function resetClarificationState(): void {
  isOpen.set(false);
  currentClarification.set(null);
  answers.set(new Map());
  resolveCallback = null;
}
