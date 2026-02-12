import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { resetMocks } from '../test/setup';
import { chatPhaseStore, currentPhaseLabel, workflowProgress } from './chatPhaseStore';

describe('chatPhaseStore', () => {
  beforeEach(() => {
    resetMocks();
    chatPhaseStore.reset();
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it('should start with architecture phase, inactive', () => {
    const state = get(chatPhaseStore);
    expect(state.currentPhase).toBe('architecture');
    expect(state.isActive).toBe(false);
    expect(state.phaseData).toEqual({});
    expect(state.userApprovals).toEqual({
      architecture: false,
      prd: false,
      plan: false,
      code: false,
      completed: false,
    });
  });

  // ── startWorkflow ──────────────────────────────────────────────────────────

  it('startWorkflow() should activate and store project description', () => {
    chatPhaseStore.startWorkflow('Build a todo app');
    const state = get(chatPhaseStore);
    expect(state.isActive).toBe(true);
    expect(state.projectDescription).toBe('Build a todo app');
    expect(state.currentPhase).toBe('architecture');
  });

  it('startWorkflow() should persist to localStorage', () => {
    chatPhaseStore.startWorkflow('SaaS dashboard');
    const stored = JSON.parse(localStorage.getItem('grump-design-workflow')!);
    expect(stored.isActive).toBe(true);
    expect(stored.projectDescription).toBe('SaaS dashboard');
  });

  // ── setPhaseData ───────────────────────────────────────────────────────────

  it('setPhaseData() should store architecture data', () => {
    chatPhaseStore.startWorkflow('test');
    chatPhaseStore.setPhaseData('architecture', {
      mermaidCode: 'graph TD; A-->B',
      description: 'Simple arch',
    });
    const state = get(chatPhaseStore);
    expect(state.phaseData.architecture).toEqual({
      mermaidCode: 'graph TD; A-->B',
      description: 'Simple arch',
    });
  });

  it('setPhaseData() should store prd data', () => {
    chatPhaseStore.startWorkflow('test');
    chatPhaseStore.setPhaseData('prd', {
      content: '# PRD',
      summary: 'A summary',
    });
    const state = get(chatPhaseStore);
    expect(state.phaseData.prd).toEqual({
      content: '# PRD',
      summary: 'A summary',
    });
  });

  it('setPhaseData() should persist to localStorage', () => {
    chatPhaseStore.startWorkflow('test');
    chatPhaseStore.setPhaseData('plan', {
      tasks: [{ id: '1', title: 'Task 1', description: 'Do it', status: 'pending' }],
    });
    const stored = JSON.parse(localStorage.getItem('grump-design-workflow')!);
    expect(stored.phaseData.plan.tasks).toHaveLength(1);
  });

  // ── approvePhase ───────────────────────────────────────────────────────────

  it('approvePhase() should advance from architecture to prd', () => {
    chatPhaseStore.startWorkflow('test');
    chatPhaseStore.approvePhase('architecture');
    const state = get(chatPhaseStore);
    expect(state.currentPhase).toBe('prd');
    expect(state.userApprovals.architecture).toBe(true);
  });

  it('approvePhase() should walk through all phases sequentially', () => {
    chatPhaseStore.startWorkflow('test');
    chatPhaseStore.approvePhase('architecture');
    expect(get(chatPhaseStore).currentPhase).toBe('prd');

    chatPhaseStore.approvePhase('prd');
    expect(get(chatPhaseStore).currentPhase).toBe('plan');

    chatPhaseStore.approvePhase('plan');
    expect(get(chatPhaseStore).currentPhase).toBe('code');

    chatPhaseStore.approvePhase('code');
    expect(get(chatPhaseStore).currentPhase).toBe('completed');
  });

  it('approvePhase() should persist to localStorage', () => {
    chatPhaseStore.startWorkflow('test');
    chatPhaseStore.approvePhase('architecture');
    const stored = JSON.parse(localStorage.getItem('grump-design-workflow')!);
    expect(stored.currentPhase).toBe('prd');
    expect(stored.userApprovals.architecture).toBe(true);
  });

  // ── requestChanges ─────────────────────────────────────────────────────────

  it('requestChanges() should store feedback without changing phase', () => {
    chatPhaseStore.startWorkflow('test');
    chatPhaseStore.requestChanges('architecture', 'Add microservices');
    const state = get(chatPhaseStore);
    expect(state.currentPhase).toBe('architecture');
    expect((state.phaseData as Record<string, unknown>).architectureFeedback).toBe(
      'Add microservices'
    );
  });

  // ── Imperative getters ─────────────────────────────────────────────────────

  it('getCurrentPhase() should return current phase', () => {
    chatPhaseStore.startWorkflow('test');
    expect(chatPhaseStore.getCurrentPhase()).toBe('architecture');
    chatPhaseStore.approvePhase('architecture');
    expect(chatPhaseStore.getCurrentPhase()).toBe('prd');
  });

  it('getPhaseData() should return data for a given phase', () => {
    chatPhaseStore.startWorkflow('test');
    chatPhaseStore.setPhaseData('architecture', {
      mermaidCode: 'graph TD',
      description: 'desc',
    });
    const data = chatPhaseStore.getPhaseData('architecture');
    expect(data).toEqual({ mermaidCode: 'graph TD', description: 'desc' });
  });

  it('getPhaseData() should return undefined for unset phase', () => {
    chatPhaseStore.startWorkflow('test');
    expect(chatPhaseStore.getPhaseData('prd')).toBeUndefined();
  });

  it('isWorkflowActive() should reflect active state', () => {
    expect(chatPhaseStore.isWorkflowActive()).toBe(false);
    chatPhaseStore.startWorkflow('test');
    expect(chatPhaseStore.isWorkflowActive()).toBe(true);
  });

  // ── complete ───────────────────────────────────────────────────────────────

  it('complete() should set completed phase and deactivate', () => {
    chatPhaseStore.startWorkflow('test');
    chatPhaseStore.complete();
    const state = get(chatPhaseStore);
    expect(state.currentPhase).toBe('completed');
    expect(state.isActive).toBe(false);
    expect(state.userApprovals.completed).toBe(true);
  });

  // ── reset ──────────────────────────────────────────────────────────────────

  it('reset() should restore initial state', () => {
    chatPhaseStore.startWorkflow('test');
    chatPhaseStore.approvePhase('architecture');
    chatPhaseStore.reset();
    const state = get(chatPhaseStore);
    expect(state.currentPhase).toBe('architecture');
    expect(state.isActive).toBe(false);
    expect(state.phaseData).toEqual({});
  });

  // ── Derived stores ─────────────────────────────────────────────────────────

  it('currentPhaseLabel should return human-readable label', () => {
    chatPhaseStore.startWorkflow('test');
    expect(get(currentPhaseLabel)).toBe('Architecture Design');

    chatPhaseStore.approvePhase('architecture');
    expect(get(currentPhaseLabel)).toBe('Product Requirements');

    chatPhaseStore.approvePhase('prd');
    expect(get(currentPhaseLabel)).toBe('Implementation Plan');

    chatPhaseStore.approvePhase('plan');
    expect(get(currentPhaseLabel)).toBe('Code Generation');

    chatPhaseStore.approvePhase('code');
    expect(get(currentPhaseLabel)).toBe('Completed');
  });

  it('workflowProgress should return correct percentage', () => {
    chatPhaseStore.startWorkflow('test');
    expect(get(workflowProgress)).toBe(0); // architecture = index 0

    chatPhaseStore.approvePhase('architecture');
    expect(get(workflowProgress)).toBe(25); // prd = index 1

    chatPhaseStore.approvePhase('prd');
    expect(get(workflowProgress)).toBe(50); // plan = index 2

    chatPhaseStore.approvePhase('plan');
    expect(get(workflowProgress)).toBe(75); // code = index 3

    chatPhaseStore.approvePhase('code');
    expect(get(workflowProgress)).toBe(100); // completed = index 4
  });
});
