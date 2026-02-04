/**
 * Example: Integrating Analytics into Services
 * 
 * This file shows how to integrate analytics tracking into existing services.
 * Copy these patterns into your actual service files.
 */

// ============================================================================
// Example 1: Intent Service
// ============================================================================

import { analytics } from './services/analytics';

export async function submitIntent(
  userId: string,
  intentData: { description: string; complexity: string }
) {
  const startTime = Date.now();
  
  try {
    // Track intent submission
    analytics.track('intent_submitted', {
      complexity: intentData.complexity,
      intent_length: intentData.description.length,
      has_attachments: false,
    }, userId);

    // Process intent...
    const result = await processIntent(intentData);

    // Track success
    analytics.trackGeneration('intent', true, Date.now() - startTime, userId, {
      result_type: result.type,
    });

    return result;
  } catch (error) {
    // Track error
    analytics.trackError('generation_failed', error as Error, userId, {
      operation: 'intent_submission',
    });
    throw error;
  }
}

// ============================================================================
// Example 2: Architecture Service
// ============================================================================

export async function generateArchitecture(
  userId: string,
  projectId: string,
  requirements: string[]
) {
  const startTime = Date.now();
  
  analytics.track('architecture_viewed', {
    project_id: projectId,
    requirements_count: requirements.length,
  }, userId);

  try {
    const architecture = await createArchitecture(requirements);
    
    analytics.trackGeneration('architecture', true, Date.now() - startTime, userId, {
      components_count: architecture.components.length,
    });

    return architecture;
  } catch (error) {
    analytics.trackError('generation_failed', error as Error, userId, {
      operation: 'architecture_generation',
    });
    throw error;
  }
}

// ============================================================================
// Example 3: Code Generation Service
// ============================================================================

export async function generateCode(
  userId: string,
  projectId: string,
  options: { language: string; framework: string }
) {
  const startTime = Date.now();
  
  try {
    const code = await createCode(projectId, options);
    
    analytics.track('code_generated', {
      project_id: projectId,
      language: options.language,
      framework: options.framework,
      lines_of_code: code.lines,
      generation_time_ms: Date.now() - startTime,
    }, userId);

    return code;
  } catch (error) {
    analytics.trackError('generation_failed', error as Error, userId, {
      operation: 'code_generation',
      language: options.language,
    });
    throw error;
  }
}

// ============================================================================
// Example 4: Project Service
// ============================================================================

export async function createProject(
  userId: string,
  isFirstProject: boolean,
  template: string
) {
  const project = await db.createProject({ userId, template });
  
  // Track project creation lifecycle
  analytics.trackProjectLifecycle('created', project.id, userId, {
    template,
    is_first: isFirstProject,
  });

  // If first project, also track separately
  if (isFirstProject) {
    analytics.track('first_project_created', {
      project_id: project.id,
      template,
      time_since_signup_ms: Date.now() - user.signupTimestamp,
    }, userId);
  }

  return project;
}

export async function downloadProject(
  userId: string,
  projectId: string,
  format: 'zip' | 'tar'
) {
  analytics.trackProjectLifecycle('downloaded', projectId, userId, {
    format,
  });

  return await createDownload(projectId, format);
}

export async function shipProject(
  userId: string,
  projectId: string,
  platform: 'vercel' | 'netlify' | 'github'
) {
  const result = await deployProject(projectId, platform);
  
  analytics.trackProjectLifecycle('shipped', projectId, userId, {
    platform,
    success: result.success,
    deployment_url: result.url,
  });

  return result;
}

// ============================================================================
// Example 5: Chat Service
// ============================================================================

export async function sendChatMessage(
  userId: string,
  sessionId: string,
  message: { content: string; role: 'user' | 'assistant' }
) {
  // Track message sent
  analytics.track('chat_message_sent', {
    session_id: sessionId,
    message_type: message.role,
    message_length: message.content.length,
  }, userId);

  return await saveMessage(sessionId, message);
}

// ============================================================================
// Example 6: User Service
// ============================================================================

export async function signUpUser(
  email: string,
  source: string
) {
  const user = await createUser({ email });
  
  // Identify the new user
  analytics.identify(user.id, {
    email,
    signup_source: source,
    signup_date: new Date().toISOString(),
  });

  // Track signup
  analytics.track('user_signed_up', {
    source,
    email_domain: email.split('@')[1],
  }, user.id);

  return user;
}

export async function upgradeUser(
  userId: string,
  fromPlan: string,
  toPlan: string,
  amount: number
) {
  await updateUserPlan(userId, toPlan);
  
  analytics.track('user_upgraded', {
    from_plan: fromPlan,
    to_plan: toPlan,
  }, userId);

  analytics.track('payment_processed', {
    amount,
    plan: toPlan,
    currency: 'USD',
  }, userId);
}

// ============================================================================
// Example 7: Skill/Tools Service
// ============================================================================

export async function useSkill(
  userId: string,
  skillName: string,
  context: Record<string, unknown>
) {
  analytics.track('skill_used', {
    skill: skillName,
    context_keys: Object.keys(context),
  }, userId);

  return await executeSkill(skillName, context);
}

// ============================================================================
// Example 8: Tour/Onboarding Service
// ============================================================================

export function startTour(userId: string, step: string) {
  analytics.track('tour_started', {
    step,
    timestamp: Date.now(),
  }, userId);
}

export function completeTour(userId: string, step: string, startedAt: number) {
  analytics.track('tour_completed', {
    step,
    duration_ms: Date.now() - startedAt,
  }, userId);
}

// ============================================================================
// Stub functions for examples
// ============================================================================

async function processIntent(data: unknown) { return { type: 'success' }; }
async function createArchitecture(reqs: unknown) { return { components: [] }; }
async function createCode(projectId: string, opts: unknown) { return { lines: 100 }; }
async function createDownload(projectId: string, format: string) { return {}; }
async function deployProject(projectId: string, platform: string) { return { success: true, url: '' }; }
async function saveMessage(sessionId: string, message: unknown) { return {}; }
async function createUser(data: unknown) { return { id: 'user-123', signupTimestamp: Date.now() }; }
async function updateUserPlan(userId: string, plan: string) { return {}; }
async function executeSkill(name: string, context: unknown) { return {}; }

const db = {
  createProject: async (data: unknown) => ({ id: 'proj-123' }),
};

const user = {
  signupTimestamp: Date.now(),
};
