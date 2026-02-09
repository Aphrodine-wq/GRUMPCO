/**
 * Generate README and .env.example for a generated project when missing.
 * Used after codegen so every generated app has basic docs and env template.
 */

import * as fs from "fs";
import * as path from "path";

export interface GenerateProjectDocsResult {
  readmeWritten: boolean;
  envExampleWritten: boolean;
  error?: string;
}

/**
 * Ensure README and .env.example exist in the workspace.
 * Writes minimal templates if files are missing; does not overwrite existing.
 */
export async function generateProjectDocs(
  workspaceRoot: string,
  options: { projectName?: string; hasBackend?: boolean } = {},
): Promise<GenerateProjectDocsResult> {
  const resolvedRoot = path.resolve(workspaceRoot);
  const projectName =
    (options.projectName ?? path.basename(resolvedRoot)) || "Generated App";
  const result: GenerateProjectDocsResult = {
    readmeWritten: false,
    envExampleWritten: false,
  };

  try {
    if (
      !fs.existsSync(resolvedRoot) ||
      !fs.statSync(resolvedRoot).isDirectory()
    ) {
      result.error = "Workspace root is not a directory";
      return result;
    }

    const readmePath = path.join(resolvedRoot, "README.md");
    if (!fs.existsSync(readmePath)) {
      const readme = `# ${projectName}

## Run locally

\`\`\`bash
npm install
npm run dev
\`\`\`

## Scripts

- \`npm run dev\` – start development server
- \`npm run build\` – build for production
- \`npm test\` – run tests

## Environment

Copy \`.env.example\` to \`.env\` and set required variables.
`;
      fs.writeFileSync(readmePath, readme, "utf-8");
      result.readmeWritten = true;
    }

    const envExamplePath = path.join(resolvedRoot, ".env.example");
    if (!fs.existsSync(envExamplePath)) {
      const lines = ["# Required environment variables", ""];
      if (options.hasBackend !== false) {
        lines.push("# API_URL=http://localhost:3000");
      }
      lines.push("");
      fs.writeFileSync(envExamplePath, lines.join("\n"), "utf-8");
      result.envExampleWritten = true;
    }

    return result;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  }
}
