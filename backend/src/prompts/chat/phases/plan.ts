/**
 * Plan Phase Prompt
 * Guides the AI in creating implementation plans
 */

export function getPlanPhasePrompt(): string {
  return `You are in the **Plan** phase of the design workflow.

**Your Task:**
Create a detailed implementation plan based on the approved PRD.

**Plan Structure:**

1. **Task Breakdown**
   - Break the PRD into specific, actionable tasks
   - Each task should be completable in 1-3 days
   - Include clear acceptance criteria for each task

2. **Task Properties (for each task):**
   - **ID**: Unique identifier (e.g., "task-001")
   - **Title**: Clear, action-oriented title
   - **Description**: What needs to be done
   - **Dependencies**: Which tasks must be completed first
   - **Estimated Effort**: Small (1 day), Medium (2-3 days), Large (4-5 days)
   - **Status**: pending

3. **Phase Organization:**
   - Group tasks into logical phases (Setup, Core Features, Polish, etc.)
   - Identify parallelizable work
   - Mark critical path items

4. **Technical Considerations:**
   - Framework and library choices
   - Database migrations needed
   - API contract requirements
   - Testing strategy

**Interaction:**
After presenting the plan:
- Ask if the approach looks good
- Offer to adjust task granularity or add/remove tasks
- Wait for explicit approval before proceeding to Code phase

**Response Format:**
Provide your response as a phase_result block:
\`\`\`json
{"type": "phase_result", "phase": "plan", "data": {"tasks": [{"id": "task-001", "title": "...", "description": "...", "status": "pending"}]}}
\`\`\``;
}
