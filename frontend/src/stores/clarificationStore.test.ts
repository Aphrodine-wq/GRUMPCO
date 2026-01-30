/**
 * Clarification Store Tests
 * 
 * Comprehensive tests for clarification modal state management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { resetMocks } from '../test/setup';

describe('clarificationStore', () => {
  beforeEach(async () => {
    resetMocks();
    vi.resetModules();
  });

  describe('initial state', () => {
    it('should not be open initially', async () => {
      const { isOpen } = await import('./clarificationStore');
      expect(get(isOpen)).toBe(false);
    });

    it('should have null clarification', async () => {
      const { currentClarification } = await import('./clarificationStore');
      expect(get(currentClarification)).toBeNull();
    });

    it('should have empty answers', async () => {
      const { answers } = await import('./clarificationStore');
      expect(get(answers).size).toBe(0);
    });
  });

  describe('openModal', () => {
    it('should open modal with clarification', async () => {
      const { openModal, isOpen, currentClarification } = await import('./clarificationStore');

      const clarification = {
        questions: [
          {
            id: 'q1',
            category: 'complexity' as const,
            question: 'How complex?',
            selectionType: 'single' as const,
            options: [
              { id: 'simple', label: 'Simple' },
              { id: 'complex', label: 'Complex' }
            ],
            required: true
          }
        ]
      };

      // Don't await - it returns a promise that resolves on submit
      openModal(clarification);

      expect(get(isOpen)).toBe(true);
      expect(get(currentClarification)).toEqual(clarification);
    });

    it('should reset answers when opening', async () => {
      const { openModal, answers, setAnswer, resetClarificationState } = await import('./clarificationStore');

      // Set some answers first
      setAnswer('old-q', ['old-answer']);

      const clarification = {
        questions: [{ id: 'q1', category: 'scope' as const, question: 'Q?', selectionType: 'single' as const, options: [] }]
      };

      openModal(clarification);

      expect(get(answers).size).toBe(0);
      resetClarificationState();
    });
  });

  describe('closeModal', () => {
    it('should close modal and clear state', async () => {
      const { openModal, closeModal, isOpen, currentClarification, answers, resetClarificationState } = await import('./clarificationStore');

      const clarification = {
        questions: [{ id: 'q1', category: 'scope' as const, question: 'Q?', selectionType: 'single' as const, options: [] }]
      };

      openModal(clarification);
      closeModal();

      expect(get(isOpen)).toBe(false);
      expect(get(currentClarification)).toBeNull();
      expect(get(answers).size).toBe(0);
      resetClarificationState();
    });
  });

  describe('setAnswer', () => {
    it('should set answer for question', async () => {
      const { setAnswer, answers, resetClarificationState } = await import('./clarificationStore');

      setAnswer('q1', ['option1', 'option2']);

      expect(get(answers).get('q1')).toEqual(['option1', 'option2']);
      resetClarificationState();
    });

    it('should overwrite previous answer', async () => {
      const { setAnswer, answers, resetClarificationState } = await import('./clarificationStore');

      setAnswer('q1', ['old']);
      setAnswer('q1', ['new']);

      expect(get(answers).get('q1')).toEqual(['new']);
      resetClarificationState();
    });
  });

  describe('toggleOption', () => {
    it('should toggle option for single selection', async () => {
      const { toggleOption, answers, resetClarificationState } = await import('./clarificationStore');

      toggleOption('q1', 'opt1', 'single');
      expect(get(answers).get('q1')).toEqual(['opt1']);

      toggleOption('q1', 'opt2', 'single');
      expect(get(answers).get('q1')).toEqual(['opt2']);
      resetClarificationState();
    });

    it('should toggle option for multiple selection', async () => {
      const { toggleOption, answers, resetClarificationState } = await import('./clarificationStore');

      toggleOption('q1', 'opt1', 'multiple');
      expect(get(answers).get('q1')).toEqual(['opt1']);

      toggleOption('q1', 'opt2', 'multiple');
      expect(get(answers).get('q1')).toEqual(['opt1', 'opt2']);

      // Toggle off
      toggleOption('q1', 'opt1', 'multiple');
      expect(get(answers).get('q1')).toEqual(['opt2']);
      resetClarificationState();
    });
  });

  describe('isValid derived store', () => {
    it('should be false when required questions unanswered', async () => {
      const { openModal, isValid, resetClarificationState } = await import('./clarificationStore');

      openModal({
        questions: [
          { id: 'q1', category: 'scope' as const, question: 'Q?', selectionType: 'single' as const, options: [], required: true }
        ]
      });

      expect(get(isValid)).toBe(false);
      resetClarificationState();
    });

    it('should be true when all required questions answered', async () => {
      const { openModal, setAnswer, isValid, resetClarificationState } = await import('./clarificationStore');

      openModal({
        questions: [
          { id: 'q1', category: 'scope' as const, question: 'Q?', selectionType: 'single' as const, options: [], required: true }
        ]
      });

      setAnswer('q1', ['answer']);

      expect(get(isValid)).toBe(true);
      resetClarificationState();
    });

    it('should ignore optional questions', async () => {
      const { openModal, isValid, resetClarificationState } = await import('./clarificationStore');

      openModal({
        questions: [
          { id: 'q1', category: 'scope' as const, question: 'Q?', selectionType: 'single' as const, options: [], required: false }
        ]
      });

      expect(get(isValid)).toBe(true);
      resetClarificationState();
    });
  });

  describe('submitAnswers', () => {
    it('should resolve promise with formatted answers', async () => {
      const { openModal, setAnswer, submitAnswers, resetClarificationState } = await import('./clarificationStore');

      const clarification = {
        questions: [
          { id: 'q1', category: 'scope' as const, question: 'Q1?', selectionType: 'single' as const, options: [] },
          { id: 'q2', category: 'scope' as const, question: 'Q2?', selectionType: 'multiple' as const, options: [] }
        ]
      };

      const promise = openModal(clarification);
      
      setAnswer('q1', ['a1']);
      setAnswer('q2', ['a2', 'a3']);
      
      submitAnswers();

      const result = await promise;
      
      expect(result).toEqual([
        { questionId: 'q1', selectedOptionIds: ['a1'] },
        { questionId: 'q2', selectedOptionIds: ['a2', 'a3'] }
      ]);
      resetClarificationState();
    });

    it('should close modal after submit', async () => {
      const { openModal, submitAnswers, isOpen, resetClarificationState } = await import('./clarificationStore');

      openModal({ questions: [] });
      submitAnswers();

      expect(get(isOpen)).toBe(false);
      resetClarificationState();
    });
  });

  describe('resetClarificationState', () => {
    it('should reset all state', async () => {
      const { openModal, setAnswer, resetClarificationState, isOpen, currentClarification, answers } = await import('./clarificationStore');

      openModal({ questions: [{ id: 'q1', category: 'scope' as const, question: 'Q?', selectionType: 'single' as const, options: [] }] });
      setAnswer('q1', ['answer']);
      
      resetClarificationState();

      expect(get(isOpen)).toBe(false);
      expect(get(currentClarification)).toBeNull();
      expect(get(answers).size).toBe(0);
    });
  });
});
