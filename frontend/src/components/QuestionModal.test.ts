import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import QuestionModal from './QuestionModal.svelte';
import { isOpen, currentClarification, answers, isValid } from '../stores/clarificationStore';

// Mock clarificationStore
vi.mock('../stores/clarificationStore', async () => {
  const { writable, derived } = await import('svelte/store');

  const openStore = writable(false);
  const clarificationStore = writable<{
    context?: string;
    questions: Array<{
      id: string;
      question: string;
      required?: boolean;
      selectionType: 'single' | 'multiple';
      options: Array<{ id: string; label: string; icon?: string; description?: string }>;
    }>;
  } | null>(null);
  const answersStore = writable(new Map<string, string[]>());
  const validStore = writable(false);

  return {
    isOpen: openStore,
    currentClarification: clarificationStore,
    answers: answersStore,
    isValid: validStore,
    closeModal: vi.fn(),
    toggleOption: vi.fn(),
    submitAnswers: vi.fn(),
  };
});

describe('QuestionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isOpen.set(false);
    currentClarification.set(null);
    answers.set(new Map());
    isValid.set(false);
  });

  it('should not render anything when isOpen is false', () => {
    const { container } = render(QuestionModal);
    expect(container.querySelector('.modal-overlay')).toBeFalsy();
  });

  it('should render modal when isOpen is true', () => {
    isOpen.set(true);
    currentClarification.set({
      context: 'Test context',
      questions: [
        {
          id: 'q1',
          question: 'Pick a framework',
          selectionType: 'single',
          options: [
            { id: 'react', label: 'React' },
            { id: 'svelte', label: 'Svelte' },
          ],
        },
      ],
    });

    const { container } = render(QuestionModal);
    expect(container.querySelector('.modal-overlay')).toBeTruthy();
  });

  it('should display the modal title', () => {
    isOpen.set(true);
    currentClarification.set({
      questions: [],
    });

    const { getByText } = render(QuestionModal);
    expect(getByText('Help me understand your needs')).toBeTruthy();
  });

  it('should display context when provided', () => {
    isOpen.set(true);
    currentClarification.set({
      context: 'Building a dashboard app',
      questions: [],
    });

    const { getByText } = render(QuestionModal);
    expect(getByText('Building a dashboard app')).toBeTruthy();
  });

  it('should render questions with their text', () => {
    isOpen.set(true);
    currentClarification.set({
      questions: [
        {
          id: 'q1',
          question: 'What database do you prefer?',
          selectionType: 'single',
          options: [{ id: 'pg', label: 'PostgreSQL' }],
        },
      ],
    });

    const { container } = render(QuestionModal);
    expect(container.textContent).toContain('What database do you prefer?');
  });

  it('should render option labels', () => {
    isOpen.set(true);
    currentClarification.set({
      questions: [
        {
          id: 'q1',
          question: 'Pick one',
          selectionType: 'single',
          options: [
            { id: 'a', label: 'Alpha' },
            { id: 'b', label: 'Beta' },
          ],
        },
      ],
    });

    const { getByText } = render(QuestionModal);
    expect(getByText('Alpha')).toBeTruthy();
    expect(getByText('Beta')).toBeTruthy();
  });

  it('should show required marker for required questions', () => {
    isOpen.set(true);
    currentClarification.set({
      questions: [
        {
          id: 'q1',
          question: 'Required question',
          required: true,
          selectionType: 'single',
          options: [{ id: 'a', label: 'A' }],
        },
      ],
    });

    const { container } = render(QuestionModal);
    expect(container.querySelector('.required-marker')).toBeTruthy();
  });

  it('should show "Select all that apply" hint for multiple selection', () => {
    isOpen.set(true);
    currentClarification.set({
      questions: [
        {
          id: 'q1',
          question: 'Pick many',
          selectionType: 'multiple',
          options: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ],
        },
      ],
    });

    const { getByText } = render(QuestionModal);
    expect(getByText('Select all that apply')).toBeTruthy();
  });

  it('should render Cancel and Generate Diagram buttons', () => {
    isOpen.set(true);
    currentClarification.set({ questions: [] });

    const { getByText } = render(QuestionModal);
    expect(getByText('Cancel')).toBeTruthy();
    expect(getByText('Generate Diagram')).toBeTruthy();
  });

  it('should disable Generate Diagram button when not valid', () => {
    isOpen.set(true);
    isValid.set(false);
    currentClarification.set({ questions: [] });

    const { getByText } = render(QuestionModal);
    const btn = getByText('Generate Diagram') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('should render option descriptions when provided', () => {
    isOpen.set(true);
    currentClarification.set({
      questions: [
        {
          id: 'q1',
          question: 'Choose',
          selectionType: 'single',
          options: [{ id: 'a', label: 'Option A', description: 'Detailed info about A' }],
        },
      ],
    });

    const { getByText } = render(QuestionModal);
    expect(getByText('Detailed info about A')).toBeTruthy();
  });

  it('should render option icons when provided', () => {
    isOpen.set(true);
    currentClarification.set({
      questions: [
        {
          id: 'q1',
          question: 'Choose',
          selectionType: 'single',
          options: [{ id: 'a', label: 'opt', icon: '🚀' }],
        },
      ],
    });

    const { getByText } = render(QuestionModal);
    expect(getByText('🚀')).toBeTruthy();
  });
});
