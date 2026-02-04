import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import chalk from 'chalk';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { withSpinner } from '../utils/progress.js';
import { handleApiError, validateRequired, GrumpError } from '../utils/errors.js';

interface CodegenOptions {
  output: string;
  format: string;
}

/**
 * Run code generation on a SHIP session
 */
export async function execute(sessionId: string, options: CodegenOptions): Promise<void> {
  validateRequired(sessionId, 'session-id');
  
  const apiUrl = config.get('apiUrl');
  const headers = config.getHeaders();
  const outputDir = resolve(options.output);
  
  console.log(branding.format('Running code generation...', 'subtitle'));
  console.log(chalk.dim(`Session ID: ${sessionId}`));
  console.log(chalk.dim(`Output: ${outputDir}\n`));
  
  // Check session status first
  const status = await withSpinner(
    'Checking session status...',
    async () => {
      const response = await fetch(`${apiUrl}/api/codegen/status/${sessionId}`, {
        headers
      });
      
      if (!response.ok) {
        handleApiError(response);
      }
      
      return response.json();
    },
    'Status checked'
  );
  
  const statusData = status as { status: string; progress?: number; agents?: unknown[] };
  
  // Check if session is ready for codegen
  if (statusData.status !== 'completed') {
    throw new GrumpError(
      `Session ${sessionId} is not ready for code generation (status: ${statusData.status})`,
      'SESSION_NOT_READY',
      undefined,
      ['Wait for the session to complete', `Run \`grump status ${sessionId}\` to monitor progress`]
    );
  }
  
  // Download generated code
  const downloadData = await withSpinner(
    'Downloading generated code...',
    async () => {
      const response = await fetch(`${apiUrl}/api/codegen/download/${sessionId}`, {
        headers
      });
      
      if (!response.ok) {
        handleApiError(response);
      }
      
      return response.arrayBuffer();
    },
    'Download complete'
  );
  
  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  // Save the file
  const filename = `codegen-${sessionId}.${options.format === 'zip' ? 'zip' : options.format}`;
  const outputPath = join(outputDir, filename);
  
  writeFileSync(outputPath, Buffer.from(downloadData as ArrayBuffer));
  
  console.log('\n' + branding.getDivider());
  console.log(branding.status(`Generated code saved to: ${outputPath}`, 'success'));
  
  if (options.format === 'zip') {
    console.log(chalk.dim('\nTip: Extract the ZIP file to access your generated code'));
  }
}

export const codegenCommand = { execute };
