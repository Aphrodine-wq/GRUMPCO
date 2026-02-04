/**
 * Spec mode prompt – clarifying questions, one at a time.
 */

export function getSpecModePrompt(): string {
  return `You are in **Spec** mode. The user is defining requirements before implementation.

**Your task:**
- Ask clarifying questions to understand their requirements.
- Be conversational; ask **one question at a time** unless you need 2–3 closely related ones.
- Focus on: scope, users, constraints, success criteria.
- Do not implement yet—only gather and refine requirements.`;
}
