import chalk from 'chalk';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { withSpinner } from '../utils/progress.js';
import { handleApiError, validateRequired } from '../utils/errors.js';

interface ShipOptions {
  stream: boolean;
  workspace: string;
  output?: string;
}

/**
 * Start a SHIP (Structured Human-In-the-Loop Process) workflow
 */
export async function execute(description: string, options: ShipOptions): Promise<void> {
  validateRequired(description, 'description');
  
  const apiUrl = config.get('apiUrl');
  const headers = config.getHeaders();
  
  console.log(branding.format('Starting SHIP workflow...', 'subtitle'));
  console.log(chalk.dim(`Description: ${description}\n`));
  
  // Start the SHIP session
  const sessionData = await withSpinner(
    'Initializing SHIP session...',
    async () => {
      const response = await fetch(`${apiUrl}/api/ship/start`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          projectDescription: description,
          workspacePath: options.workspace
        })
      });
      
      if (!response.ok) {
        handleApiError(response);
      }
      
      return response.json();
    },
    'SHIP session created'
  );
  
  const { sessionId } = sessionData as { sessionId: string };
  
  console.log(branding.status(`Session ID: ${sessionId}`, 'info'));
  
  if (options.stream) {
    await streamExecution(apiUrl, sessionId, headers);
  } else {
    await executeAsync(apiUrl, sessionId, headers);
  }
  
  if (options.output) {
    console.log(branding.status(`Output directory: ${options.output}`, 'info'));
  }
  
  console.log('\n' + branding.getDivider());
  console.log(branding.status('SHIP workflow complete!', 'success'));
  console.log(chalk.dim(`\nNext steps:`));
  console.log(chalk.dim(`  grump status ${sessionId}     - Check status`));
  console.log(chalk.dim(`  grump codegen ${sessionId}    - Generate code`));
}

/**
 * Stream execution output in real-time
 */
async function streamExecution(apiUrl: string, sessionId: string, headers: Record<string, string>): Promise<void> {
  console.log('\n' + branding.format('Executing (streaming mode)...', 'subtitle'));
  
  const response = await fetch(`${apiUrl}/api/ship/${sessionId}/execute/stream`, {
    method: 'POST',
    headers
  });
  
  if (!response.ok) {
    handleApiError(response);
  }
  
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body available');
  }
  
  const decoder = new TextDecoder();
  let buffer = '';
  
  console.log();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        try {
          const event = JSON.parse(data) as { type?: string; phase?: string; message?: string; progress?: number };
          handleStreamEvent(event);
        } catch {
          // Skip malformed events
        }
      }
    }
  }
  
  console.log();
}

/**
 * Handle individual stream events
 */
function handleStreamEvent(event: { type?: string; phase?: string; message?: string; progress?: number }): void {
  switch (event.type) {
    case 'phase':
      const phaseColor = chalk.hex('#FF6B35');
      console.log(`${phaseColor(`[${event.phase?.toUpperCase()}]`)} ${event.message || ''}`);
      break;
    case 'progress':
      if (event.progress !== undefined) {
        const bar = '█'.repeat(Math.floor(event.progress / 5)) + '░'.repeat(20 - Math.floor(event.progress / 5));
        process.stdout.write(`\r${chalk.dim('Progress:')} ${branding.applyGradient(bar)} ${event.progress}%`);
      }
      break;
    case 'done':
      console.log('\n' + branding.status('Complete!', 'success'));
      break;
    case 'error':
      console.log('\n' + branding.status(event.message || 'Error occurred', 'error'));
      break;
  }
}

/**
 * Execute without streaming (async mode)
 */
async function executeAsync(apiUrl: string, sessionId: string, headers: Record<string, string>): Promise<void> {
  const result = await withSpinner(
    'Executing workflow...',
    async () => {
      const response = await fetch(`${apiUrl}/api/ship/${sessionId}/execute`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        handleApiError(response);
      }
      
      return response.json();
    },
    'Execution started'
  );
  
  const data = result as { status?: string; jobId?: string };
  console.log(branding.status(`Job ID: ${data.jobId || 'N/A'}`, 'info'));
  console.log(branding.status(`Status: ${data.status || 'running'}`, 'pending'));
}

export const shipCommand = { execute };
