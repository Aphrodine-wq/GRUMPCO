# AI Workflow Documentation

This document provides comprehensive guidance for creating effective AI agent workflows in the G-Rump system.

## Table of Contents

1. [Workflow Patterns](#workflow-patterns)
2. [Tool Usage Best Practices](#tool-usage-best-practices)
3. [Agent Profiles](#agent-profiles)
4. [Error Handling & Retry](#error-handling--retry)
5. [Workflow Templates](#workflow-templates)
6. [Plan Mode Workflows](#plan-mode-workflows)
7. [Spec Mode Workflows](#spec-mode-workflows)

---

## Workflow Patterns

### Sequential Workflows

Sequential workflows execute steps one after another, where each step depends on the previous one completing.

**Use Case**: Code generation pipeline, multi-step refactoring

**Example**:
```typescript
// Backend: agentOrchestrator.ts pattern
async function sequentialWorkflow() {
  const step1 = await runArchitectAgent();
  const step2 = await runFrontendAgent(step1);
  const step3 = await runBackendAgent(step1);
  const step4 = await runTestAgent(step2, step3);
  return { step1, step2, step3, step4 };
}
```

**Best Practices**:
- Ensure each step completes before starting the next
- Pass results from previous steps as context
- Handle errors at each step to prevent cascade failures

### Parallel Workflows

Parallel workflows execute multiple independent steps simultaneously.

**Use Case**: Generating frontend and backend code simultaneously, running multiple tests

**Example**:
```typescript
async function parallelWorkflow() {
  const [frontend, backend, tests] = await Promise.all([
    runFrontendAgent(),
    runBackendAgent(),
    runTestAgent(),
  ]);
  return { frontend, backend, tests };
}
```

**Best Practices**:
- Only parallelize independent operations
- Use Promise.allSettled() if you need all results even if some fail
- Consider resource limits (API rate limits, memory)

### Conditional Workflows

Conditional workflows branch based on results or conditions.

**Use Case**: Different code paths based on framework choice, error recovery

**Example**:
```typescript
async function conditionalWorkflow(framework: string) {
  if (framework === 'react') {
    return await generateReactCode();
  } else if (framework === 'vue') {
    return await generateVueCode();
  } else {
    throw new Error(`Unsupported framework: ${framework}`);
  }
}
```

**Best Practices**:
- Define clear conditions upfront
- Handle all possible branches
- Provide fallback paths when possible

### Iterative Workflows

Iterative workflows refine results through multiple passes.

**Use Case**: Code refinement, architecture iteration, test-driven development

**Example**:
```typescript
async function iterativeWorkflow(initialCode: string, maxIterations = 3) {
  let code = initialCode;
  for (let i = 0; i < maxIterations; i++) {
    const feedback = await analyzeCode(code);
    if (feedback.isComplete) break;
    code = await refineCode(code, feedback);
  }
  return code;
}
```

**Best Practices**:
- Set maximum iteration limits to prevent infinite loops
- Track changes between iterations
- Provide clear stopping criteria

---

## Tool Usage Best Practices

### Available Tools

1. **bash_execute**: Run shell commands
2. **file_read**: Read file contents
3. **file_write**: Create or overwrite files
4. **file_edit**: Make targeted edits to files
5. **list_directory**: List directory contents

### When to Use Each Tool

#### bash_execute
- **Use for**: Running build commands, installing dependencies, running tests, git operations
- **Avoid for**: Reading file contents (use file_read instead)
- **Example**:
```typescript
// Good: Running tests
bash_execute({ command: 'npm test', workingDirectory: './frontend' })

// Bad: Reading file
bash_execute({ command: 'cat package.json' }) // Use file_read instead
```

#### file_read
- **Use for**: Understanding codebase structure, reading configuration, analyzing existing code
- **Best practice**: Read files before making changes
- **Example**:
```typescript
// Good: Read before edit
const currentCode = await file_read({ path: 'src/App.tsx' });
// Analyze and plan changes
await file_edit({ path: 'src/App.tsx', operations: [...] });
```

#### file_write
- **Use for**: Creating new files, complete file replacements
- **Avoid for**: Small edits (use file_edit instead)
- **Example**:
```typescript
// Good: Creating new file
file_write({ 
  path: 'src/components/NewComponent.tsx',
  content: '...',
  createDirectories: true 
})
```

#### file_edit
- **Use for**: Making targeted changes, refactoring, bug fixes
- **Best practice**: Use precise line numbers and clear operations
- **Example**:
```typescript
// Good: Precise edit
file_edit({
  path: 'src/App.tsx',
  operations: [
    { type: 'replace', line: 10, content: 'const newValue = 42;' },
    { type: 'insert', line: 15, content: '// New comment' }
  ]
})
```

#### list_directory
- **Use for**: Exploring project structure, finding files, understanding organization
- **Best practice**: Use recursive option carefully (can be slow on large directories)
- **Example**:
```typescript
// Good: Explore structure
list_directory({ path: 'src', recursive: false }) // Start shallow
list_directory({ path: 'src/components', recursive: true }) // Then go deep
```

### Tool Chaining Patterns

#### Exploration → Analysis → Implementation

```typescript
// 1. Explore
const structure = await list_directory({ path: 'src' });

// 2. Analyze
const mainFile = await file_read({ path: 'src/index.ts' });
const config = await file_read({ path: 'package.json' });

// 3. Implement
await file_edit({ path: 'src/index.ts', operations: [...] });
```

#### Read → Modify → Test

```typescript
// 1. Read current state
const testFile = await file_read({ path: 'tests/unit.test.ts' });

// 2. Modify
await file_edit({ path: 'tests/unit.test.ts', operations: [...] });

// 3. Test
const result = await bash_execute({ command: 'npm test' });
```

### Error Handling with Tools

Always handle tool errors gracefully:

```typescript
try {
  const result = await file_read({ path: 'src/App.tsx' });
  if (!result.success) {
    // File doesn't exist, create it
    await file_write({ path: 'src/App.tsx', content: '...' });
  }
} catch (error) {
  // Log and continue or retry
  logger.error({ error }, 'Failed to read file');
  throw error;
}
```

### Workspace Scoping Considerations

- All tool paths are relative to `workspaceRoot`
- Always verify workspace is set before using tools
- Use absolute paths when necessary (but prefer relative)

---

## Agent Profiles

### General
- **Use for**: General coding tasks, mixed frontend/backend work
- **Strengths**: Versatile, good for exploratory work
- **Limitations**: Not specialized in any domain

### Router
- **Use for**: Complex tasks requiring coordination between specialists
- **Strengths**: Can delegate to appropriate specialists
- **Best practice**: Use for multi-component features

### Frontend
- **Use for**: UI components, styling, client-side logic, React/Vue/Svelte
- **Strengths**: Deep knowledge of frontend frameworks
- **Best practice**: Use when task is primarily UI-related

### Backend
- **Use for**: APIs, services, database, authentication
- **Strengths**: Server-side patterns, data modeling
- **Best practice**: Use for API development, data processing

### DevOps
- **Use for**: Docker, CI/CD, configuration, deployment
- **Strengths**: Infrastructure, automation
- **Best practice**: Use for deployment scripts, Dockerfiles

### Test
- **Use for**: Unit tests, integration tests, E2E tests
- **Strengths**: Testing patterns, coverage
- **Best practice**: Use when adding or updating tests

### Profile Switching Strategies

```typescript
// Strategy 1: Start with router, delegate
if (task.complexity === 'high') {
  useProfile('router');
  // Router will delegate to specialists
}

// Strategy 2: Direct specialist selection
if (task.type === 'ui') {
  useProfile('frontend');
} else if (task.type === 'api') {
  useProfile('backend');
}

// Strategy 3: Sequential specialist use
await runWithProfile('frontend', generateUI);
await runWithProfile('backend', generateAPI);
await runWithProfile('test', generateTests);
```

### Multi-Agent Coordination

When coordinating multiple agents:

1. **Shared Context**: Pass results between agents
2. **Dependency Management**: Ensure agents run in correct order
3. **Conflict Resolution**: Handle overlapping responsibilities
4. **Progress Tracking**: Monitor each agent's status

---

## Error Handling & Retry

### Retry Strategies

#### Exponential Backoff

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(initialDelay * Math.pow(2, i));
    }
  }
  throw new Error('Max retries exceeded');
}
```

#### Retry with Validation

```typescript
async function retryUntilValid<T>(
  fn: () => Promise<T>,
  validator: (result: T) => boolean,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    const result = await fn();
    if (validator(result)) return result;
    if (i === maxRetries - 1) {
      throw new Error('Result validation failed after retries');
    }
  }
  throw new Error('Max retries exceeded');
}
```

### Graceful Degradation

When operations fail, provide fallbacks:

```typescript
async function generateWithFallback() {
  try {
    return await generateWithFramework('react');
  } catch (error) {
    logger.warn({ error }, 'React generation failed, trying Vue');
    try {
      return await generateWithFramework('vue');
    } catch (error2) {
      logger.error({ error: error2 }, 'All generation attempts failed');
      throw error2;
    }
  }
}
```

### User Notification Patterns

Always inform users of errors:

```typescript
try {
  await executeWorkflow();
} catch (error) {
  // Log for debugging
  logger.error({ error }, 'Workflow failed');
  
  // Notify user
  showToast({
    message: 'Workflow failed. Please try again.',
    type: 'error',
    details: error.message
  });
  
  // Provide recovery options
  showRecoveryOptions(['retry', 'skip', 'cancel']);
}
```

### Logging and Debugging

Use structured logging:

```typescript
logger.info({
  workflowId: 'wf_123',
  step: 'frontend_generation',
  duration: 1500,
  fileCount: 12
}, 'Frontend generation completed');

logger.error({
  workflowId: 'wf_123',
  step: 'backend_generation',
  error: error.message,
  stack: error.stack
}, 'Backend generation failed');
```

---

## Workflow Templates

### Template 1: Feature Addition

**Pattern**: Explore → Plan → Implement → Test

```typescript
async function addFeature(description: string) {
  // 1. Explore
  const structure = await list_directory({ path: 'src' });
  const existingCode = await file_read({ path: 'src/App.tsx' });
  
  // 2. Plan
  const plan = await generatePlan({
    userRequest: description,
    workspaceRoot: './',
  });
  await approvePlan(plan.id);
  
  // 3. Implement
  await startPlanExecution(plan.id);
  // Plan execution uses tools to implement changes
  
  // 4. Test
  await bash_execute({ command: 'npm test' });
  
  return { plan, success: true };
}
```

### Template 2: Bug Fix

**Pattern**: Reproduce → Diagnose → Fix → Verify

```typescript
async function fixBug(bugDescription: string) {
  // 1. Reproduce
  const testResult = await bash_execute({ command: 'npm test' });
  // Analyze test output
  
  // 2. Diagnose
  const relevantFiles = await findRelevantFiles(bugDescription);
  for (const file of relevantFiles) {
    await file_read({ path: file });
  }
  
  // 3. Fix
  await file_edit({
    path: 'src/buggyFile.ts',
    operations: [/* fixes */]
  });
  
  // 4. Verify
  const testResult2 = await bash_execute({ command: 'npm test' });
  if (!testResult2.success) {
    throw new Error('Fix did not resolve issue');
  }
  
  return { fixed: true };
}
```

### Template 3: Refactoring

**Pattern**: Analyze → Plan → Execute → Validate

```typescript
async function refactor(targetFiles: string[]) {
  // 1. Analyze
  const analysis = await Promise.all(
    targetFiles.map(file => file_read({ path: file }))
  );
  
  // 2. Plan
  const refactorPlan = await generateRefactorPlan(analysis);
  
  // 3. Execute
  for (const change of refactorPlan.changes) {
    await file_edit({
      path: change.path,
      operations: change.operations
    });
  }
  
  // 4. Validate
  await bash_execute({ command: 'npm run lint' });
  await bash_execute({ command: 'npm test' });
  
  return { refactored: true };
}
```

### Template 4: New Project

**Pattern**: Scaffold → Implement → Configure → Deploy

```typescript
async function createNewProject(projectSpec: Specification) {
  // 1. Scaffold
  await bash_execute({ command: 'npm create vite@latest . -- --template react-ts' });
  
  // 2. Implement
  for (const component of projectSpec.sections.uiComponents || []) {
    await file_write({
      path: `src/components/${component.name}.tsx`,
      content: generateComponentCode(component)
    });
  }
  
  // 3. Configure
  await file_edit({
    path: 'package.json',
    operations: [/* add dependencies */]
  });
  
  // 4. Deploy (optional)
  // await setupDeployment();
  
  return { projectCreated: true };
}
```

---

## Plan Mode Workflows

### When to Use Plan Mode

- **Complex multi-step tasks**: When you need to see the full plan before execution
- **Risk assessment**: When you want to review changes before they're made
- **Team collaboration**: When plans need approval from multiple stakeholders
- **Learning**: When you want to understand what will happen before it happens

### Plan Structure Best Practices

1. **Clear Steps**: Each step should have a single, clear purpose
2. **Dependencies**: Explicitly define what depends on what
3. **File Changes**: List all files that will be modified
4. **Time Estimates**: Provide realistic time estimates
5. **Risk Assessment**: Identify potential issues upfront

### Approval Workflow Patterns

```typescript
// Pattern 1: Auto-approve simple plans
if (plan.steps.length <= 3 && plan.totalEstimatedTime < 30) {
  await approvePlan(plan.id);
  await startPlanExecution(plan.id);
}

// Pattern 2: Require approval for complex plans
if (plan.steps.length > 10 || plan.totalEstimatedTime > 120) {
  // Wait for user approval
  await waitForApproval(plan.id);
}

// Pattern 3: Conditional approval
if (planHasHighRisk(plan)) {
  await requestExplicitApproval(plan.id);
} else {
  await approvePlan(plan.id);
}
```

### Multi-Phase Execution Strategies

```typescript
// Strategy 1: Execute all phases sequentially
await startPlanExecution(planId);

// Strategy 2: Execute with checkpoints
for (const phase of plan.phases) {
  if (phase.checkpoint) {
    await waitForUserApproval(phase.id);
  }
  await executePhase(phase.id);
}

// Strategy 3: Skip certain phases
await startPlanExecution(planId, {
  skipPhases: ['validation'] // Skip tests for now
});
```

---

## Spec Mode Workflows

### Question Generation Strategies

1. **Progressive Disclosure**: Start with high-level questions, then drill down
2. **Category Grouping**: Group related questions together
3. **Required vs Optional**: Mark critical questions as required
4. **Context Awareness**: Use previous answers to inform next questions

### Answer Validation

```typescript
// Validate answers before submission
function validateAnswer(question: SpecQuestion, answer: any): boolean {
  if (question.required && !answer) {
    return false;
  }
  
  if (question.type === 'choice' && question.options) {
    return question.options.includes(answer);
  }
  
  if (question.type === 'number' && question.validation) {
    const num = Number(answer);
    if (question.validation.min && num < question.validation.min) return false;
    if (question.validation.max && num > question.validation.max) return false;
  }
  
  return true;
}
```

### Spec Synthesis Patterns

After collecting answers, synthesize into specification:

```typescript
async function synthesizeSpec(answers: Record<string, any>) {
  const spec = {
    overview: generateOverview(answers),
    requirements: extractRequirements(answers),
    technicalSpecs: determineTechStack(answers),
    dataModels: inferDataModels(answers),
    apis: designAPIs(answers),
  };
  
  return spec;
}
```

### Integration with Plan Mode

Spec mode naturally leads to plan mode:

```typescript
// 1. Gather requirements via spec mode
const spec = await generateSpecification(sessionId);

// 2. Generate plan from spec
const plan = await generatePlan({
  userRequest: `Implement: ${spec.title}\n${spec.description}`,
  workspaceRoot: './',
});

// 3. Execute plan
await approvePlan(plan.id);
await startPlanExecution(plan.id);
```

---

## Code Examples

### Complete Workflow Example

```typescript
import { generatePlan, approvePlan, startPlanExecution } from './stores/planStore';
import { startSpecSession, generateSpecification } from './stores/specStore';

async function completeFeatureWorkflow(userRequest: string) {
  // Step 1: Gather requirements (Spec Mode)
  const specSession = await startSpecSession({
    userRequest,
    workspaceRoot: './',
  });
  
  // Answer questions (handled by UI)
  // ... user answers questions ...
  
  // Step 2: Generate specification
  const { specification } = await generateSpecification(specSession.id);
  
  // Step 3: Create implementation plan (Plan Mode)
  const plan = await generatePlan({
    userRequest: `Implement: ${specification.title}`,
    workspaceRoot: './',
  });
  
  // Step 4: Review and approve
  await approvePlan(plan.id);
  
  // Step 5: Execute
  await startPlanExecution(plan.id);
  
  return { specification, plan };
}
```

### Tool Chaining Example

```typescript
async function addNewComponent(componentName: string) {
  // 1. Explore existing components
  const components = await list_directory({ path: 'src/components' });
  
  // 2. Read similar component for reference
  const similarComponent = await file_read({ 
    path: 'src/components/SimilarComponent.tsx' 
  });
  
  // 3. Read project structure
  const packageJson = await file_read({ path: 'package.json' });
  
  // 4. Create new component
  await file_write({
    path: `src/components/${componentName}.tsx`,
    content: generateComponentCode(componentName, similarComponent),
  });
  
  // 5. Update imports
  await file_edit({
    path: 'src/App.tsx',
    operations: [
      { 
        type: 'insert', 
        line: 1, 
        content: `import ${componentName} from './components/${componentName}';` 
      }
    ]
  });
  
  // 6. Run tests
  await bash_execute({ command: 'npm test' });
  
  return { success: true };
}
```

---

## Best Practices Summary

1. **Always explore before implementing**: Understand the codebase first
2. **Use appropriate tools**: Don't use bash_execute to read files
3. **Handle errors gracefully**: Provide fallbacks and user feedback
4. **Plan complex changes**: Use plan mode for multi-step tasks
5. **Validate inputs**: Check answers and results before proceeding
6. **Log everything**: Structured logging helps debugging
7. **Test after changes**: Always verify your changes work
8. **Use specialists**: Choose the right agent profile for the task
9. **Iterate when needed**: Don't be afraid to refine results
10. **Keep workflows focused**: One workflow, one clear goal

---

## Additional Resources

- [Backend Services Documentation](../backend/src/services/README.md)
- [Tool Definitions](../backend/src/tools/definitions.ts)
- [Agent Orchestrator](../backend/src/services/agentOrchestrator.ts)
- [Plan Service](../backend/src/services/planService.ts)
- [Spec Service](../backend/src/services/specService.ts)
