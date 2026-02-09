/**
 * Agent Brain Store
 *
 * Reactive store that surfaces the agent's internal reasoning process:
 * - Confidence analysis (how sure the agent is)
 * - Task decomposition (how it breaks down complex work)
 * - Strategy selection (which approach it picked)
 * - Self-healing timeline (recovery from failures)
 * - Learning pulse (adaptation over time)
 *
 * This bridges the backend's Power Expansion subsystem directly into
 * visible UI, providing AI decision-making transparency.
 */

import { writable, derived, get } from 'svelte/store';
import { fetchApi } from '../lib/api.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ConfidenceAnalysis {
    overall: number; // 0-1
    factors: ConfidenceFactor[];
    level: 'high' | 'medium' | 'low';
    action: string; // "Will execute autonomously" etc.
    timestamp: number;
}

export interface ConfidenceFactor {
    name: string;
    value: number; // 0-1
    weight: number;
    explanation?: string;
}

export interface TaskNode {
    id: string;
    label: string;
    status: 'pending' | 'active' | 'done' | 'failed';
    confidence: number;
    children: TaskNode[];
    durationMs?: number;
}

export interface StrategyChoice {
    selected: string; // e.g. "conservative", "balanced", "aggressive"
    alternatives: string[];
    reasoning: string;
    timestamp: number;
}

export interface HealingEvent {
    id: string;
    error: string;
    action: string; // what the agent did to recover
    result: 'recovered' | 'escalated' | 'pending';
    timestamp: number;
}

export interface LearningPulse {
    totalSignals: number;
    recentAdaptations: string[];
    accuracy: number; // 0-1 trending
    lastUpdated: number;
}

interface BrainStoreState {
    // Core data
    confidence: ConfidenceAnalysis | null;
    decomposition: TaskNode | null;
    strategy: StrategyChoice | null;
    healingTimeline: HealingEvent[];
    learningPulse: LearningPulse | null;

    // UI
    isActive: boolean;
    isPulsing: boolean;
    lastEventTimestamp: number;
    error: string | null;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: BrainStoreState = {
    confidence: null,
    decomposition: null,
    strategy: null,
    healingTimeline: [],
    learningPulse: null,
    isActive: false,
    isPulsing: false,
    lastEventTimestamp: 0,
    error: null,
};

// ============================================================================
// STORE
// ============================================================================

const store = writable<BrainStoreState>(initialState);

// ============================================================================
// DERIVED STORES
// ============================================================================

/** Overall confidence level (0-1) */
export const confidenceLevel = derived(store, ($s) => $s.confidence?.overall ?? 0);

/** Is the brain actively processing? */
export const isThinking = derived(store, ($s) => $s.isActive);

/** Current decomposition tree root */
export const taskTree = derived(store, ($s) => $s.decomposition);

/** Has self-healing kicked in recently? */
export const isHealing = derived(
    store,
    ($s) => $s.healingTimeline.some((h) => h.result === 'pending')
);

/** Learning adaptation count */
export const adaptationCount = derived(
    store,
    ($s) => $s.learningPulse?.totalSignals ?? 0
);

// ============================================================================
// DEMO / SIMULATED DATA
// ============================================================================

/**
 * Generate realistic brain activity data for display.
 * In production, this would come from SSE events and API calls.
 * For now we simulate it to show the panel's visual capabilities.
 */
function generateSimulatedActivity(): Partial<BrainStoreState> {
    const confidence: ConfidenceAnalysis = {
        overall: 0.72 + Math.random() * 0.25,
        factors: [
            { name: 'Context Match', value: 0.85 + Math.random() * 0.1, weight: 0.3 },
            { name: 'Pattern Recognition', value: 0.65 + Math.random() * 0.2, weight: 0.25 },
            { name: 'Historical Success', value: 0.78 + Math.random() * 0.15, weight: 0.2 },
            { name: 'Input Clarity', value: 0.7 + Math.random() * 0.25, weight: 0.15 },
            { name: 'Resource Availability', value: 0.9 + Math.random() * 0.08, weight: 0.1 },
        ],
        level: 'high',
        action: 'Will execute autonomously',
        timestamp: Date.now(),
    };
    // Recalculate level from overall
    confidence.level =
        confidence.overall >= 0.8 ? 'high' : confidence.overall >= 0.5 ? 'medium' : 'low';
    confidence.action =
        confidence.level === 'high'
            ? 'Will execute autonomously'
            : confidence.level === 'medium'
                ? 'Will execute with logging'
                : 'Will ask for confirmation';

    const decomposition: TaskNode = {
        id: 'root',
        label: 'Process Request',
        status: 'active',
        confidence: confidence.overall,
        children: [
            {
                id: 'parse',
                label: 'Parse Intent',
                status: 'done',
                confidence: 0.95,
                children: [],
                durationMs: 12,
            },
            {
                id: 'plan',
                label: 'Plan Strategy',
                status: 'done',
                confidence: 0.88,
                children: [
                    {
                        id: 'risk',
                        label: 'Risk Assessment',
                        status: 'done',
                        confidence: 0.92,
                        children: [],
                        durationMs: 8,
                    },
                    {
                        id: 'budget',
                        label: 'Budget Check',
                        status: 'done',
                        confidence: 0.99,
                        children: [],
                        durationMs: 3,
                    },
                ],
                durationMs: 24,
            },
            {
                id: 'exec',
                label: 'Execute',
                status: 'active',
                confidence: 0.76,
                children: [
                    {
                        id: 'gen',
                        label: 'Generate Output',
                        status: 'active',
                        confidence: 0.74,
                        children: [],
                    },
                    {
                        id: 'validate',
                        label: 'Validate Result',
                        status: 'pending',
                        confidence: 0,
                        children: [],
                    },
                ],
            },
            {
                id: 'review',
                label: 'Self-Review',
                status: 'pending',
                confidence: 0,
                children: [],
            },
        ],
    };

    const strategy: StrategyChoice = {
        selected: 'balanced',
        alternatives: ['conservative', 'aggressive'],
        reasoning: 'Medium complexity task with moderate confidence — balanced approach optimizes for both speed and safety.',
        timestamp: Date.now(),
    };

    const learningPulse: LearningPulse = {
        totalSignals: 47 + Math.floor(Math.random() * 10),
        recentAdaptations: ['Improved file relevance scoring', 'Adjusted verbosity preference'],
        accuracy: 0.82 + Math.random() * 0.1,
        lastUpdated: Date.now(),
    };

    return {
        confidence,
        decomposition,
        strategy,
        learningPulse,
        isActive: true,
        isPulsing: true,
        lastEventTimestamp: Date.now(),
    };
}

// ============================================================================
// STORE ACTIONS
// ============================================================================

export const agentBrainStore = {
    subscribe: store.subscribe,

    /**
     * Activate the brain panel with simulated data.
     * In production, this would connect to SSE events.
     */
    activate(sessionId: string): void {
        const simulated = generateSimulatedActivity();
        store.update((s) => ({ ...s, ...simulated }));
    },

    /**
     * Handle SSE brain events from the backend
     */
    handleBrainEvent(event: {
        type: 'confidence_update' | 'decomposition_update' | 'strategy_selected' |
        'healing_started' | 'healing_resolved' | 'learning_signal';
        data: unknown;
    }): void {
        switch (event.type) {
            case 'confidence_update': {
                const confidence = event.data as ConfidenceAnalysis;
                store.update((s) => ({
                    ...s,
                    confidence,
                    isActive: true,
                    isPulsing: true,
                    lastEventTimestamp: Date.now(),
                }));
                break;
            }
            case 'decomposition_update': {
                const decomposition = event.data as TaskNode;
                store.update((s) => ({ ...s, decomposition, lastEventTimestamp: Date.now() }));
                break;
            }
            case 'strategy_selected': {
                const strategy = event.data as StrategyChoice;
                store.update((s) => ({ ...s, strategy, lastEventTimestamp: Date.now() }));
                break;
            }
            case 'healing_started': {
                const healingEvent = event.data as HealingEvent;
                store.update((s) => ({
                    ...s,
                    healingTimeline: [healingEvent, ...s.healingTimeline].slice(0, 10),
                    lastEventTimestamp: Date.now(),
                }));
                break;
            }
            case 'healing_resolved': {
                const { id, result } = event.data as { id: string; result: 'recovered' | 'escalated' };
                store.update((s) => ({
                    ...s,
                    healingTimeline: s.healingTimeline.map((h) =>
                        h.id === id ? { ...h, result } : h
                    ),
                    lastEventTimestamp: Date.now(),
                }));
                break;
            }
            case 'learning_signal': {
                const pulse = event.data as LearningPulse;
                store.update((s) => ({ ...s, learningPulse: pulse, lastEventTimestamp: Date.now() }));
                break;
            }
        }
    },

    /**
     * Deactivate the brain panel
     */
    deactivate(): void {
        store.update((s) => ({ ...s, isActive: false, isPulsing: false }));
    },

    /**
     * Reset store to initial state
     */
    reset(): void {
        store.set(initialState);
    },

    /**
     * Get current state snapshot
     */
    getState(): BrainStoreState {
        return get(store);
    },
};

export default agentBrainStore;
