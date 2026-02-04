import archiver from "archiver";
import { PassThrough } from "stream";
import type { FileDefinition, TechStack } from "../types/index.js";
import type { GeneratedFile } from "../types/agents.js";

function generateReadme(
  files: FileDefinition[],
  projectName: string,
  techStack: TechStack,
): string {
  const stackInstructions: Record<TechStack, string> = {
    "react-express-prisma": `## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database

### Installation

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Set up environment:
\`\`\`bash
cp .env.example .env
# Edit .env with your database URL
\`\`\`

3. Generate Prisma client and run migrations:
\`\`\`bash
npx prisma generate
npx prisma migrate dev
\`\`\`

4. Start development server:
\`\`\`bash
npm run dev
\`\`\``,

    "fastapi-sqlalchemy": `## Setup

### Prerequisites
- Python 3.11+
- PostgreSQL database (or SQLite for development)

### Installation

1. Create virtual environment:
\`\`\`bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate
\`\`\`

2. Install dependencies:
\`\`\`bash
pip install -r requirements.txt
\`\`\`

3. Set up environment:
\`\`\`bash
cp .env.example .env
# Edit .env with your database URL
\`\`\`

4. Start development server:
\`\`\`bash
uvicorn main:app --reload
\`\`\``,

    "nextjs-prisma": `## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database

### Installation

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Set up environment:
\`\`\`bash
cp .env.example .env
# Edit .env with your database URL
\`\`\`

3. Generate Prisma client and run migrations:
\`\`\`bash
npx prisma generate
npx prisma migrate dev
\`\`\`

4. Start development server:
\`\`\`bash
npm run dev
\`\`\``,
  };

  const fileList = files.map((f) => `- \`${f.path}\``).join("\n");

  return `# ${projectName}

Generated with G-Rump Code Generator

${stackInstructions[techStack]}

## Project Structure

${fileList}

## Notes

This is a starter scaffold generated from a Mermaid diagram. Key points:

- Contains basic structure and placeholder implementations
- See codebase TODOs for implementation gaps
- Review and customize according to your specific requirements
- Add proper error handling and validation as needed

## Generated Files

${files.length} files generated for ${techStack} stack.
`;
}

export function createProjectZip(
  files: FileDefinition[],
  projectName: string,
  techStack: TechStack,
): PassThrough {
  const archive = archiver("zip", {
    zlib: { level: 9 },
  });

  const passThrough = new PassThrough();
  archive.pipe(passThrough);

  // Add each generated file
  files.forEach((file) => {
    archive.append(file.content, {
      name: `${projectName}/${file.path}`,
    });
  });

  // Add auto-generated README
  const readme = generateReadme(files, projectName, techStack);
  archive.append(readme, {
    name: `${projectName}/README.md`,
  });

  // Finalize the archive
  archive.finalize();

  return passThrough;
}

/**
 * Create ZIP from codegen GeneratedFile[]. Stream-only; no README.
 */
export function createCodegenZip(
  files: GeneratedFile[],
  projectName: string,
): PassThrough {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const passThrough = new PassThrough();
  archive.pipe(passThrough);

  for (const f of files) {
    archive.append(f.content, { name: `${projectName}/${f.path}` });
  }

  archive.finalize();
  return passThrough;
}
