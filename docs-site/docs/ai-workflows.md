---
layout: doc
title: AI Workflows
---

# AI Workflow Documentation

This document provides comprehensive guidance for creating effective AI agent workflows in the G-Rump system.

## Workflow Patterns

### Sequential Workflows

Sequential workflows execute steps one after another, where each step depends on the previous one completing.

**Use Case**: Code generation pipeline, multi-step refactoring

```typescript
async function sequentialWorkflow() {
  const step1 = await runArchitectAgent();
  const step2 = await runFrontendAgent(step1);
  const step3 = await runBackendAgent(step1);
  const step4 = await runTestAgent(step2, step3);
  return { step1, step2, step3, step4 };
}
```

### Parallel Workflows

Parallel workflows execute multiple independent steps simultaneously.

**Use Case**: Generating frontend and backend code simultaneously

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

### Conditional Workflows

Conditional workflows branch based on results or conditions.

**Use Case**: Different code paths based on framework choice

```typescript
async function conditionalWorkflow(framework: string) {
  if (framework === 'react') {
    return await generateReactCode();
  } else if (framework === 'vue') {
    return await generateVueCode();
  }
}
```

### Iterative Workflows

Iterative workflows refine results through multiple passes.

**Use Case**: Code refinement, architecture iteration

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

## Tool Usage Best Practices

### Available Tools

1. **bash_execute**: Run shell commands
2. **file_read**: Read file contents
3. **file_write**: Create or overwrite files
4. **file_edit**: Make targeted edits to files
5. **list_directory**: List directory contents

### When to Use Each Tool

| Tool | Use for | Avoid for |
|------|---------|-----------|
| `bash_execute` | Build commands, tests, git | Reading files |
| `file_read` | Understanding codebase, config | - |
| `file_write` | New files, complete replacements | Small edits |
| `file_edit` | Targeted changes, refactoring | New files |
| `list_directory` | Exploring structure, finding files | - |

### Tool Chaining Patterns

**Exploration → Analysis → Implementation:**
```typescript
// 1. Explore
const structure = await list_directory({ path: 'src' });

// 2. Analyze
const mainFile = await file_read({ path: 'src/index.ts' });

// 3. Implement
await file_edit({ path: 'src/index.ts', operations: [...] });
```

## Agent Profiles

| Profile | Use for | Strengths |
|---------|---------|-----------|
| **General** | Mixed tasks | Versatile |
| **Router** | Complex coordination | Delegation |
| **Frontend** | UI components, styling | Framework knowledge |
| **Backend** | APIs, services, DB | Server patterns |
| **DevOps** | Docker, CI/CD | Infrastructure |
| **Test** | Unit, integration, E2E | Testing patterns |

## Error Handling & Retry

### Exponential Backoff

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

## Workflow Templates

### Template 1: Feature Addition

**Pattern**: Explore → Plan → Implement → Test

### Template 2: Bug Fix

**Pattern**: Reproduce → Diagnose → Fix → Verify

### Template 3: Refactoring

**Pattern**: Analyze → Plan → Execute → Validate

### Template 4: New Project

**Pattern**: Scaffold → Implement → Configure → Deploy

## Plan Mode Workflows

### When to Use Plan Mode

- Complex multi-step tasks
- Risk assessment needed
- Team collaboration required
- Learning/understanding

### Plan Structure Best Practices

1. **Clear Steps**: Single, clear purpose per step
2. **Dependencies**: Explicit dependency definitions
3. **File Changes**: List all files to be modified
4. **Time Estimates**: Realistic estimates
5. **Risk Assessment**: Identify potential issues

## Best Practices Summary

1. Always explore before implementing
2. Use appropriate tools for each task
3. Handle errors gracefully
4. Plan complex changes
5. Validate inputs
6. Log everything
7. Test after changes
8. Use specialists for domain tasks
9. Iterate when needed
10. Keep workflows focused
