import Anthropic from '@anthropic-ai/sdk';

export interface JudgeScores {
  correctness: number;
  completeness: number;
  consistency: number;
  implementability: number;
}

export interface JudgeResult {
  scores: JudgeScores;
  comments: string;
}

const MODEL = process.env.JUDGE_MODEL ?? 'claude-3-7-sonnet-20250219';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function callJudge(prompt: string): Promise<JudgeResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required to run evals');
  }

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    temperature: 0,
    system:
      'You are an impartial evaluator for software architecture, PRDs, and code generation. ' +
      'Always respond with STRICT JSON only, no extra text.',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const text = message.content
    .filter((c) => c.type === 'text')
    .map((c) => ('text' in c ? c.text : ''))
    .join('\n');

  try {
    const parsed = JSON.parse(text) as JudgeResult;
    return parsed;
  } catch (err) {
    throw new Error(`Failed to parse judge JSON: ${(err as Error).message}\nRaw: ${text}`);
  }
}

export async function judgeArchitecture(params: {
  prompt: string;
  expectations: { mustMention: string[]; antiPatterns?: string[] };
  output: string;
}): Promise<JudgeResult> {
  const judgePrompt = `
You are evaluating a software architecture response.

User prompt:
${params.prompt}

Expectations:
- Must mention: ${params.expectations.mustMention.join(', ') || 'none'}
- Must avoid: ${params.expectations.antiPatterns?.join(', ') || 'none'}

Model output:
${params.output}

Return strict JSON:
{"scores":{"correctness":0-5,"completeness":0-5,"consistency":0-5,"implementability":0-5},"comments":"..."}
`;
  return callJudge(judgePrompt);
}

export async function judgePrd(params: {
  title: string;
  description: string;
  architectureSummary: string;
  expectations: { mustSections: string[] };
  output: string;
}): Promise<JudgeResult> {
  const judgePrompt = `
You are evaluating a product requirements document (PRD).

Context:
Title: ${params.title}
High-level description: ${params.description}
Architecture summary: ${params.architectureSummary}

Required sections (case-insensitive): ${params.expectations.mustSections.join(', ')}

PRD output:
${params.output}

Return strict JSON:
{"scores":{"correctness":0-5,"completeness":0-5,"consistency":0-5,"implementability":0-5},"comments":"..."}
`;
  return callJudge(judgePrompt);
}

