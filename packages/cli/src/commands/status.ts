import chalk from 'chalk';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { createSpinner } from '../utils/progress.js';
import { handleApiError, validateRequired } from '../utils/errors.js';

interface StatusOptions {
  watch: boolean;
  json: boolean;
  interval: string;
}

interface SessionStatus {
  sessionId: string;
  status: string;
  progress: number;
  phase: string;
  agents?: Array<{
    name: string;
    status: string;
    progress: number;
  }>;
  startedAt: string;
  updatedAt: string;
  error?: string;
}

/**
 * Check the status of a SHIP session
 */
export async function execute(sessionId: string, options: StatusOptions): Promise<void> {
  validateRequired(sessionId, 'session-id');
  
  const apiUrl = config.get('apiUrl');
  const headers = config.getHeaders();
  const interval = parseInt(options.interval, 10) || 5000;
  
  if (options.watch) {
    await watchStatus(apiUrl, sessionId, headers, interval, options.json);
  } else {
    await getStatusOnce(apiUrl, sessionId, headers, options.json);
  }
}

/**
 * Get status once
 */
async function getStatusOnce(
  apiUrl: string, 
  sessionId: string, 
  headers: Record<string, string>,
  json: boolean
): Promise<void> {
  const spinner = createSpinner({ text: 'Fetching session status...' });
  spinner.start();
  
  try {
    const response = await fetch(`${apiUrl}/api/ship/status/${sessionId}`, {
      headers
    });
    
    if (!response.ok) {
      spinner.fail();
      handleApiError(response);
    }
    
    const data = await response.json() as SessionStatus;
    spinner.stop();
    
    if (json) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      displayStatus(data);
    }
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

/**
 * Watch status continuously
 */
async function watchStatus(
  apiUrl: string, 
  sessionId: string, 
  headers: Record<string, string>,
  interval: number,
  json: boolean
): Promise<void> {
  console.log(branding.format(`Watching session: ${sessionId}`, 'subtitle'));
  console.log(chalk.dim(`Polling every ${interval}ms (Press Ctrl+C to stop)\n`));
  
  let isRunning = true;
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    isRunning = false;
    console.log('\n' + branding.getDivider());
    console.log(branding.status('Stopped watching', 'info'));
    process.exit(0);
  });
  
  while (isRunning) {
    try {
      const response = await fetch(`${apiUrl}/api/ship/status/${sessionId}`, {
        headers
      });
      
      if (!response.ok) {
        handleApiError(response);
      }
      
      const data = await response.json() as SessionStatus;
      
      // Clear previous output (if not first iteration)
      if (json) {
        console.log(JSON.stringify(data));
      } else {
        // Move cursor up and clear lines for live updating
        process.stdout.write('\x1B[2J\x1B[0f');
        console.log(branding.format(`Watching session: ${sessionId}`, 'subtitle'));
        console.log(chalk.dim(`Polling every ${interval}ms (Press Ctrl+C to stop)\n`));
        displayStatus(data);
      }
      
      // Check if session is complete
      if (data.status === 'completed' || data.status === 'failed') {
        console.log('\n' + branding.getDivider());
        console.log(branding.status(
          data.status === 'completed' ? 'Session completed!' : 'Session failed!',
          data.status === 'completed' ? 'success' : 'error'
        ));
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
    } catch (error) {
      console.error('\nError fetching status:', error);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
}

/**
 * Display status in a formatted way
 */
function displayStatus(data: SessionStatus): void {
  console.log(branding.getDivider());
  console.log(chalk.bold('Session ID: ') + chalk.white(data.sessionId));
  
  // Status with color
  let statusColor = chalk.gray;
  switch (data.status) {
    case 'completed':
      statusColor = chalk.greenBright;
      break;
    case 'running':
      statusColor = chalk.yellowBright;
      break;
    case 'failed':
      statusColor = chalk.redBright;
      break;
    case 'pending':
      statusColor = chalk.cyan;
      break;
  }
  
  console.log(chalk.bold('Status: ') + statusColor(data.status.toUpperCase()));
  console.log(chalk.bold('Phase: ') + chalk.white(data.phase));
  
  // Progress bar
  const progressBar = '█'.repeat(Math.floor(data.progress / 5)) + '░'.repeat(20 - Math.floor(data.progress / 5));
  console.log(chalk.bold('Progress: ') + branding.applyGradient(progressBar) + chalk.white(` ${data.progress}%`));
  
  // Timestamps
  console.log(chalk.bold('Started: ') + chalk.dim(new Date(data.startedAt).toLocaleString()));
  console.log(chalk.bold('Updated: ') + chalk.dim(new Date(data.updatedAt).toLocaleString()));
  
  // Error message if present
  if (data.error) {
    console.log('\n' + chalk.redBright('Error: ') + chalk.red(data.error));
  }
  
  // Agent statuses
  if (data.agents && data.agents.length > 0) {
    console.log('\n' + chalk.bold('Agents:'));
    data.agents.forEach(agent => {
      const agentStatusColor = agent.status === 'completed' ? chalk.green : 
                               agent.status === 'running' ? chalk.yellow : 
                               agent.status === 'failed' ? chalk.red : chalk.gray;
      console.log(`  ${chalk.white(agent.name.padEnd(20))} ${agentStatusColor(agent.status.padEnd(12))} ${chalk.dim(`${agent.progress}%`)}`);
    });
  }
  
  console.log(branding.getDivider());
}

export const statusCommand = { execute };
