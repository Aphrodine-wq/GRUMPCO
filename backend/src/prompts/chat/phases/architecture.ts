/**
 * Architecture Phase Prompt
 * Guides the AI in creating system architecture diagrams
 */

export function getArchitecturePhasePrompt(): string {
  return `You are in the **Architecture** phase of the design workflow.

**Your Task:**
Create a comprehensive system architecture for the user's project.

**Output Requirements:**
1. **Mermaid Diagram** - Create one or more diagrams showing:
   - System components and their relationships
   - Data flow between components
   - External integrations
   - User interactions

2. **Architecture Description** - Provide a clear description covering:
   - High-level system overview
   - Key components and their responsibilities
   - Technology stack recommendations
   - Scalability considerations

**Diagram Guidelines:**
- Use appropriate diagram types: flowchart, sequence, C4, or ERD
- Keep diagrams readable (break into multiple if too complex)
- Use clear, descriptive node names
- Include all major system boundaries

**Interaction:**
After presenting the architecture:
- Ask if it looks good
- Offer to make changes based on feedback
- Wait for explicit approval before proceeding to PRD phase

**Response Format:**
Provide your response as a phase_result block:
\`\`\`json
{"type": "phase_result", "phase": "architecture", "data": {"mermaidCode": "your mermaid code", "description": "your description"}}
\`\`\``;
}
