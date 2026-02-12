/**
 * Spec Service
 * Interactive Q&A for requirements gathering and specification generation
 */

import type {
  SpecSession,
  SpecQuestion,
  SpecAnswer,
  Specification,
  SpecStartRequest,
  SpecAnswerRequest,
  SpecGenerateRequest,
  SpecDesignContext,
  QuestionType,
} from '../../types/spec.js';
import logger from '../../middleware/logger.js';
import { getDatabase } from '../../db/database.js';
import { getCompletion } from '../ai-providers/llmGatewayHelper.js';
import { getIntentGuidedRagContext } from '../rag/ragService.js';

/**
 * Start a new spec session and generate initial questions
 */
export async function startSpecSession(request: SpecStartRequest): Promise<SpecSession> {
  const sessionId = `spec_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  logger.info({ sessionId, workspaceRoot: request.workspaceRoot }, 'Starting spec session');

  const systemPrompt = `You are a requirements gathering assistant. Based on a user's initial request, generate a series of clarifying questions to understand their needs.

Generate 5-10 questions that will help create a comprehensive specification. Questions should be:
- Clear and specific
- Cover different aspects (functionality, technical, UX, constraints)
- Use appropriate question types (text, choice, multi-choice, number, boolean)
- Include help text where needed

Return a JSON array of questions:
[
  {
    "id": "q1",
    "question": "What is the primary purpose of this feature?",
    "type": "text",
    "required": true,
    "placeholder": "Describe the main goal...",
    "helpText": "This helps us understand the core functionality",
    "order": 1,
    "category": "functionality"
  },
  {
    "id": "q2",
    "question": "Which framework do you prefer?",
    "type": "choice",
    "options": ["React", "Vue", "Svelte", "Angular"],
    "required": true,
    "order": 2,
    "category": "technical"
  }
]

Question types:
- "text": Free text input
- "choice": Single selection from options
- "multi-choice": Multiple selections
- "number": Numeric input
- "boolean": Yes/No
- "code": Code snippet input

Generate questions that will help create a complete specification.`;

  const userPrompt = `User request: ${request.userRequest}

${request.workspaceRoot ? `Workspace: ${request.workspaceRoot}` : ''}

Generate relevant questions to gather all necessary information for creating a comprehensive specification.`;

  try {
    const result = await getCompletion({
      model: 'moonshotai/kimi-k2.5',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    if (result.error) {
      throw new Error(`LLM API error: ${result.error}`);
    }

    let jsonText = result.text.trim();

    // Extract JSON from markdown code blocks if present
    if (jsonText.includes('```json')) {
      const match = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    } else if (jsonText.includes('```')) {
      const match = jsonText.match(/```\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    }

    const questionsData = JSON.parse(jsonText);
    const questions: SpecQuestion[] = (Array.isArray(questionsData) ? questionsData : [])
      .map((q: Record<string, unknown>, index: number) => ({
        id: String(q.id ?? `q${index + 1}`),
        question: String(q.question ?? ''),
        type: (q.type || 'text') as QuestionType,
        options: q.options as string[] | undefined,
        required: q.required !== undefined ? Boolean(q.required) : true,
        placeholder: q.placeholder as string | undefined,
        helpText: q.helpText as string | undefined,
        validation: q.validation as SpecQuestion['validation'],
        order: Number(q.order ?? index + 1),
        category: q.category as string | undefined,
      }))
      .sort((a, b) => a.order - b.order);

    const session: SpecSession = {
      id: sessionId,
      status: 'collecting',
      originalRequest: request.userRequest,
      questions,
      answers: {},
      specification: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      workspaceRoot: request.workspaceRoot,
    };

    const db = getDatabase();
    await db.saveSpec(session);
    logger.info({ sessionId, questionCount: questions.length }, 'Spec session started');

    return session;
  } catch (error) {
    logger.error({ error, sessionId }, 'Spec session start failed');
    throw error;
  }
}

/**
 * Submit answer to a question
 */
export async function submitAnswer(
  sessionId: string,
  answerRequest: SpecAnswerRequest
): Promise<SpecSession> {
  const db = getDatabase();
  const session = await db.getSpec(sessionId);
  if (!session) {
    throw new Error(`Spec session ${sessionId} not found`);
  }

  if (session.status !== 'collecting') {
    throw new Error(`Cannot submit answers to session ${sessionId} in status ${session.status}`);
  }

  const question = session.questions.find((q) => q.id === answerRequest.questionId);
  if (!question) {
    throw new Error(`Question ${answerRequest.questionId} not found`);
  }

  // Validate answer based on question type
  validateAnswer(question, answerRequest.value);

  const answer: SpecAnswer = {
    questionId: answerRequest.questionId,
    value: answerRequest.value,
    answeredAt: new Date().toISOString(),
  };

  session.answers[answerRequest.questionId] = answer;
  session.updatedAt = new Date().toISOString();

  await db.saveSpec(session);
  logger.info({ sessionId, questionId: answerRequest.questionId }, 'Answer submitted');

  return session;
}

/**
 * Validate answer based on question type and validation rules
 */
function validateAnswer(question: SpecQuestion, value: unknown): void {
  if (question.required && (value === null || value === undefined || value === '')) {
    throw new Error(`Question ${question.id} is required`);
  }

  if (value === null || value === undefined || value === '') {
    return; // Optional questions can be empty
  }

  switch (question.type) {
    case 'choice':
      if (!question.options?.includes(value as string)) {
        throw new Error(`Answer must be one of: ${question.options?.join(', ')}`);
      }
      break;
    case 'multi-choice':
      if (!Array.isArray(value)) {
        throw new Error('Answer must be an array');
      }
      for (const v of value) {
        if (!question.options?.includes(v)) {
          throw new Error(`All selections must be from: ${question.options?.join(', ')}`);
        }
      }
      break;
    case 'number':
      if (typeof value !== 'number') {
        throw new Error('Answer must be a number');
      }
      if (question.validation) {
        if (question.validation.min !== undefined && value < question.validation.min) {
          throw new Error(`Value must be at least ${question.validation.min}`);
        }
        if (question.validation.max !== undefined && value > question.validation.max) {
          throw new Error(`Value must be at most ${question.validation.max}`);
        }
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new Error('Answer must be a boolean');
      }
      break;
    case 'text':
      if (typeof value !== 'string') {
        throw new Error('Answer must be a string');
      }
      if (question.validation) {
        if (
          question.validation.minLength !== undefined &&
          value.length < question.validation.minLength
        ) {
          throw new Error(`Text must be at least ${question.validation.minLength} characters`);
        }
        if (
          question.validation.maxLength !== undefined &&
          value.length > question.validation.maxLength
        ) {
          throw new Error(`Text must be at most ${question.validation.maxLength} characters`);
        }
        if (question.validation.pattern) {
          const regex = new RegExp(question.validation.pattern);
          if (!regex.test(value)) {
            throw new Error(`Text does not match required pattern`);
          }
        }
      }
      break;
  }
}

/**
 * Check if all required questions are answered
 */
export async function isSessionComplete(sessionId: string): Promise<boolean> {
  const db = getDatabase();
  const session = await db.getSpec(sessionId);
  if (!session) {
    return false;
  }

  const requiredQuestions = session.questions.filter((q) => q.required);
  return requiredQuestions.every((q) => session.answers[q.id] !== undefined);
}

/**
 * Get next unanswered question
 */
export async function getNextQuestion(sessionId: string): Promise<SpecQuestion | null> {
  const db = getDatabase();
  const session = await db.getSpec(sessionId);
  if (!session) {
    return null;
  }

  const unanswered = session.questions
    .filter((q) => !session.answers[q.id])
    .sort((a, b) => a.order - b.order);

  return unanswered[0] || null;
}

/**
 * Generate specification from answered questions
 */
export async function generateSpecification(
  request: SpecGenerateRequest
): Promise<{ specification: Specification; session: SpecSession }> {
  const db = getDatabase();
  const session = await db.getSpec(request.sessionId);
  if (!session) {
    throw new Error(`Spec session ${request.sessionId} not found`);
  }

  if (session.status !== 'collecting') {
    throw new Error(
      `Cannot generate spec for session ${request.sessionId} in status ${session.status}`
    );
  }

  const useDesignContext = request.designContext != null;
  if (!useDesignContext && !(await isSessionComplete(request.sessionId))) {
    throw new Error('Not all required questions are answered');
  }

  session.status = 'generating';
  session.updatedAt = new Date().toISOString();
  await db.saveSpec(session);

  logger.info(
    { sessionId: request.sessionId, fromContext: useDesignContext },
    'Generating specification'
  );

  const hasCDD =
    useDesignContext && (request.designContext as SpecDesignContext)?.creativeDesignDoc != null;
  const uiComponentsSchema = hasCDD
    ? `"uiComponents": [
      {
        "id": "ui1",
        "name": "string",
        "description": "string",
        "type": "page|component|layout|form|modal",
        "region": "header|sidebar|main|footer|modal (which layout region)",
        "placement": "string - where in that region",
        "layoutNotes": "string - hierarchy/UX notes from Creative Design Document"
      }
    ]`
    : `"uiComponents": [...]`;

  const layoutGuidance = hasCDD
    ? `
When a Creative Design Document is provided, you MUST:
- Add a short "Layout & UX" subsection in the overview describing regions, breakpoints, and key flows from the CDD.
- For each uiComponent, include "region", "placement", and "layoutNotes" so implementation follows the CDD.`
    : '';

  const baseSpecPrompt = `You are a specification writer. ${useDesignContext ? 'Based on project description, PRD overview, and optional Creative Design Document, create a comprehensive technical specification.' : 'Based on user answers to questions, create a comprehensive technical specification.'}

Generate a detailed specification with:
1. Overview and description${hasCDD ? ' including a Layout & UX subsection' : ''}
2. Requirements (functional and non-functional)
3. Technical specifications (frameworks, libraries, patterns)
4. Data models (if applicable)
5. API specifications (if applicable)
6. UI component specifications (if applicable)${hasCDD ? ' — include region, placement, layoutNotes per component' : ''}
7. Constraints and assumptions

Return a JSON object:
{
  "title": "Specification title",
  "description": "Overview description",
  "sections": {
    "overview": "...",
    "requirements": [...],
    "technicalSpecs": [...],
    "dataModels": [...],
    "apis": [...],
    ${uiComponentsSchema},
    "constraints": ["Constraint 1"],
    "assumptions": ["Assumption 1"]
  }
}
${layoutGuidance}

Be thorough and specific. ${useDesignContext ? 'Use all provided design context (project description, PRD overview, Creative Design Document).' : 'Include all relevant details from the answers.'}`;
  let systemPrompt = request.systemPromptPrefix
    ? `${request.systemPromptPrefix}\n\n${baseSpecPrompt}`
    : baseSpecPrompt;
  if (request.namespace) {
    try {
      const query =
        useDesignContext && request.designContext
          ? request.designContext.projectDescription
          : session.originalRequest;
      const ragResult = await getIntentGuidedRagContext(query, {
        namespace: request.namespace,
        maxChunks: 6,
      });
      if (ragResult?.context)
        systemPrompt += `\n\nRelevant context from knowledge base:\n\n${ragResult.context}`;
    } catch {
      // RAG optional
    }
  }

  let userPrompt: string;
  if (useDesignContext && request.designContext) {
    const ctx = request.designContext as SpecDesignContext;
    userPrompt = `Project description: ${ctx.projectDescription}`;
    if (ctx.prdOverview) {
      if (ctx.prdOverview.vision) userPrompt += `\n\nPRD vision: ${ctx.prdOverview.vision}`;
      if (ctx.prdOverview.problem) userPrompt += `\nPRD problem: ${ctx.prdOverview.problem}`;
      if (ctx.prdOverview.solution) userPrompt += `\nPRD solution: ${ctx.prdOverview.solution}`;
      if (ctx.prdOverview.targetMarket)
        userPrompt += `\nTarget market: ${ctx.prdOverview.targetMarket}`;
    }
    if (ctx.creativeDesignDoc) {
      userPrompt += `\n\nCreative Design Document (layout, UI/UX, key screens, UX flows):\n${JSON.stringify(ctx.creativeDesignDoc, null, 2)}`;
    }
    userPrompt +=
      '\n\nGenerate a comprehensive specification from this design context. Align uiComponents with the Creative Design Document when provided.';
  } else {
    const qaContext = session.questions
      .map((q) => {
        const answer = session.answers[q.id];
        return `Q: ${q.question}\nA: ${answer ? JSON.stringify(answer.value) : 'Not answered'}`;
      })
      .join('\n\n');
    userPrompt = `Original request: ${session.originalRequest}

${session.workspaceRoot ? `Workspace: ${session.workspaceRoot}` : ''}

Questions and Answers:
${qaContext}

Generate a comprehensive specification based on these answers.`;
  }

  try {
    const result = await getCompletion({
      model: 'moonshotai/kimi-k2.5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    if (result.error) {
      throw new Error(`LLM API error: ${result.error}`);
    }

    let jsonText = result.text.trim();

    // Extract JSON from markdown code blocks if present
    if (jsonText.includes('```json')) {
      const match = jsonText.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    } else if (jsonText.includes('```')) {
      const match = jsonText.match(/```\n?([\s\S]*?)\n?```/);
      if (match) jsonText = match[1];
    }

    const specData = JSON.parse(jsonText);

    const specification: Specification = {
      id: `spec_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      title: specData.title || 'Specification',
      description: specData.description || '',
      sections: {
        overview: specData.sections?.overview,
        requirements: specData.sections?.requirements || [],
        technicalSpecs: specData.sections?.technicalSpecs || [],
        dataModels: specData.sections?.dataModels || [],
        apis: specData.sections?.apis || [],
        uiComponents: specData.sections?.uiComponents || [],
        constraints: specData.sections?.constraints || [],
        assumptions: specData.sections?.assumptions || [],
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        sessionId: session.id,
      },
    };

    session.specification = specification;
    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    session.updatedAt = new Date().toISOString();

    await db.saveSpec(session);
    logger.info({ sessionId: request.sessionId }, 'Specification generated');

    return { specification, session };
  } catch (error) {
    session.status = 'collecting';
    session.updatedAt = new Date().toISOString();
    await db.saveSpec(session);
    logger.error({ error, sessionId: request.sessionId }, 'Specification generation failed');
    throw error;
  }
}

/**
 * Get spec session by ID
 */
export async function getSpecSession(sessionId: string): Promise<SpecSession | null> {
  const db = getDatabase();
  return await db.getSpec(sessionId);
}
