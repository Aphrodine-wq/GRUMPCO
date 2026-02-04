/**
 * Shared Claude Code quality directives for all agents.
 * Use in system prompts to align output with Claude Code standards.
 */
export const CLAUDE_CODE_QUALITY_BLOCK = `
## Claude Code Quality Standards (mandatory):
- **Type safety**: Strict TypeScript; no \`any\`; explicit interfaces for APIs and state.
- **Testing**: Unit tests for logic; integration tests for APIs; E2E for critical flows.
- **Security**: Validate/sanitize inputs; use parameterized queries; no secrets in code.
- **Performance**: Lazy load where appropriate; avoid N+1; index DB queries.
- **Maintainability**: Single responsibility; clear naming; small focused modules.
- **Error handling**: Typed errors; user-facing messages; structured logging.
`;

export function withClaudeCodeQuality(prompt: string): string {
  if (prompt.includes('Claude Code Quality Standards')) return prompt;
  return (
    prompt.replace(/\n## Output Format:/, `${CLAUDE_CODE_QUALITY_BLOCK}\n\n## Output Format:`) ||
    prompt + CLAUDE_CODE_QUALITY_BLOCK
  );
}
