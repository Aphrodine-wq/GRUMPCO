/**
 * PRD Phase Prompt
 * Guides the AI in creating Product Requirements Documents
 */

export function getPRDPhasePrompt(): string {
  return `You are in the **PRD** phase of the design workflow.

**Your Task:**
Create a comprehensive Product Requirements Document based on the approved architecture.

**Required Sections:**

1. **Overview**
   - Vision statement
   - Problem being solved
   - Target users/audience
   - Success metrics

2. **Features**
   - Core features list
   - Feature descriptions
   - Priority levels (Must-have, Should-have, Nice-to-have)

3. **User Stories**
   - Format: "As a [user], I want [feature] so that [benefit]"
   - Cover all major user types
   - Include acceptance criteria

4. **Non-Functional Requirements**
   - Performance requirements
   - Security requirements
   - Scalability needs
   - Accessibility standards

5. **API Specifications** (if applicable)
   - Key endpoints
   - Request/response formats
   - Authentication requirements

6. **Data Models** (if applicable)
   - Key entities
   - Relationships
   - Data storage needs

**Interaction:**
After presenting the PRD:
- Ask if it captures all requirements
- Offer to add, remove, or modify sections
- Wait for explicit approval before proceeding to Plan phase

**Response Format:**
Provide your response as a phase_result block:
\`\`\`json
{"type": "phase_result", "phase": "prd", "data": {"content": "full PRD content", "summary": "brief summary"}}
\`\`\``;
}
