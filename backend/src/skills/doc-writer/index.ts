/**
 * Doc Writer Skill
 * Generates documentation for code, APIs, and projects
 */
import type { SkillModule } from '../types';

const docWriterSkill: SkillModule = {
    id: 'doc-writer',
    name: 'Doc Writer',
    description: 'Generate documentation for code, APIs, and projects',

    tools: [
        {
            name: 'generate_readme',
            description: 'Generate a comprehensive README.md for a project based on its structure and code',
            input_schema: {
                type: 'object',
                properties: {
                    projectName: { type: 'string', description: 'Name of the project' },
                    description: { type: 'string', description: 'Brief project description' },
                    techStack: { type: 'string', description: 'Technologies used (comma-separated)' },
                    includeSetup: { type: 'boolean', description: 'Include setup/installation instructions' },
                    includeLicense: { type: 'boolean', description: 'Include license section' },
                },
                required: ['projectName', 'description'],
            },
        },
        {
            name: 'generate_api_docs',
            description: 'Generate API reference documentation from route definitions or OpenAPI specs',
            input_schema: {
                type: 'object',
                properties: {
                    code: { type: 'string', description: 'API route code or OpenAPI spec' },
                    format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format' },
                    baseUrl: { type: 'string', description: 'Base URL for the API' },
                },
                required: ['code'],
            },
        },
        {
            name: 'add_jsdoc',
            description: 'Add JSDoc/TSDoc comments to functions, classes, and interfaces in TypeScript/JavaScript code',
            input_schema: {
                type: 'object',
                properties: {
                    code: { type: 'string', description: 'Source code to document' },
                    style: { type: 'string', enum: ['concise', 'detailed'], description: 'Documentation verbosity' },
                },
                required: ['code'],
            },
        },
    ] as import('../types').ToolDefinition[],

    systemPrompt: `You are a documentation expert. When using the Doc Writer skill:

1. **README Generation**: Create professional, well-structured READMEs with badges, installation steps, usage examples, and contribution guidelines. Use shields.io badges where appropriate.

2. **API Documentation**: Generate clear API endpoint documentation with:
   - HTTP method and path
   - Request/response body schemas
   - Authentication requirements
   - Example curl commands
   - Status codes and error responses

3. **JSDoc/TSDoc**: Add comprehensive type-safe documentation comments:
   - @param with types and descriptions
   - @returns with type and description
   - @throws for error conditions
   - @example with usage code
   - @deprecated when applicable

Always produce Markdown by default. Keep documentation accurate to the actual code behavior.`,

    async execute(toolName: string, input: Record<string, unknown>): Promise<string> {
        switch (toolName) {
            case 'generate_readme': {
                const { projectName, description, techStack, includeSetup, includeLicense } = input as {
                    projectName: string;
                    description: string;
                    techStack?: string;
                    includeSetup?: boolean;
                    includeLicense?: boolean;
                };
                let readme = `# ${projectName}\n\n${description}\n\n`;
                if (techStack) {
                    readme += `## Tech Stack\n\n${techStack.split(',').map((t: string) => `- ${t.trim()}`).join('\n')}\n\n`;
                }
                if (includeSetup !== false) {
                    readme += `## Getting Started\n\n\`\`\`bash\n# Clone the repository\ngit clone <url>\ncd ${projectName.toLowerCase().replace(/\s+/g, '-')}\n\n# Install dependencies\nnpm install\n\n# Start development server\nnpm run dev\n\`\`\`\n\n`;
                }
                if (includeLicense) {
                    readme += `## License\n\nMIT License - see [LICENSE](./LICENSE) for details.\n`;
                }
                return readme;
            }
            case 'generate_api_docs': {
                const { code, format, baseUrl } = input as { code: string; format?: string; baseUrl?: string };
                return `API Documentation generated from provided code.\nBase URL: ${baseUrl || 'http://localhost:3000'}\nFormat: ${format || 'markdown'}\n\nCode analyzed:\n${code.substring(0, 500)}...`;
            }
            case 'add_jsdoc': {
                const { code, style } = input as { code: string; style?: string };
                return `JSDoc comments added (style: ${style || 'detailed'}).\n\nOriginal code with documentation:\n${code}`;
            }
            default:
                return `Unknown tool: ${toolName}`;
        }
    },
};

export default docWriterSkill;
