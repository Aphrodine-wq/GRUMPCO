
import { verifyIntent } from '../src/services/intentVerificationService.js';
import { EnrichedIntent } from '../src/services/intentCompilerService.js';

async function runTest() {
    console.log('Running Intent Verification Test...');

    const ambiguousIntent: EnrichedIntent = {
        actors: ['user'],
        features: ['fix it'],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'fix it',
        enriched: {
            ambiguity_analysis: {
                score: 0.8,
                reason: 'Subject missing',
                clarification_questions: ['What needs fixing?']
            }
        }
    };

    const result1 = await verifyIntent(ambiguousIntent);
    if (!result1.valid && result1.clarification) {
        console.log('PASS: Ambiguity check caught vague intent.');
    } else {
        console.error('FAIL: Ambiguity check missed vague intent.');
    }

    const reactIntent: EnrichedIntent = {
        actors: ['dev'],
        features: ['add button'],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'add react button',
        enriched: {
            // Mocking what the LLM might return
            tech_stack: ['React'],
            ambiguity_analysis: { score: 0.1, reason: '', clarification_questions: [] }
        }
    };

    const result2 = await verifyIntent(reactIntent);
    if (result2.warnings.some(w => w.includes('React'))) {
        console.log('PASS: React warning triggered.');
    } else {
        console.error('FAIL: React warning not triggered.');
    }

    console.log('Tests completed.');
}

runTest().catch(console.error);
