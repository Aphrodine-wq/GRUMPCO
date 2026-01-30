import chalk from 'chalk';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { withSpinner } from '../utils/progress.js';
import { handleApiError } from '../utils/errors.js';

interface ListOptions {
  all: boolean;
  format: string;
  limit: string;
}

interface Session {
  id: string;
  description: string;
  status: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * List all active SHIP sessions
 */
export async function execute(options: ListOptions): Promise<void> {
  const apiUrl = config.get('apiUrl');
  const headers = config.getHeaders();
  const limit = parseInt(options.limit, 10) || 50;
  
  console.log(branding.format('Listing SHIP sessions...', 'subtitle'));
  console.log(chalk.dim(`Filter: ${options.all ? 'All sessions' : 'Active only'}\n`));
  
  const result = await withSpinner(
    'Fetching sessions...',
    async () => {
      const statusFilter = options.all ? '' : `?status=active&limit=${limit}`;
      const response = await fetch(`${apiUrl}/api/ship/sessions${statusFilter}`, {
        headers
      });
      
      if (!response.ok) {
        handleApiError(response);
      }
      
      return response.json();
    },
    'Sessions fetched'
  );
  
  const sessions = (result as { sessions: Session[] }).sessions || [];
  
  if (sessions.length === 0) {
    console.log('\n' + branding.status('No sessions found', 'warning'));
    return;
  }
  
  switch (options.format) {
    case 'json':
      displayJson(sessions);
      break;
    case 'compact':
      displayCompact(sessions);
      break;
    case 'table':
    default:
      displayTable(sessions);
      break;
  }
  
  console.log('\n' + branding.status(`Total: ${sessions.length} sessions`, 'info'));
}

/**
 * Display sessions as JSON
 */
function displayJson(sessions: Session[]): void {
  console.log(JSON.stringify(sessions, null, 2));
}

/**
 * Display sessions in compact format
 */
function displayCompact(sessions: Session[]): void {
  console.log();
  sessions.forEach(session => {
    const statusColor = getStatusColor(session.status);
    console.log(`${chalk.gray(session.id.substring(0, 8))} ${statusColor(session.status.padEnd(10))} ${chalk.white(session.description.substring(0, 50))}${session.description.length > 50 ? '...' : ''}`);
  });
}

/**
 * Display sessions as a formatted table
 */
function displayTable(sessions: Session[]): void {
  console.log('\n' + branding.getDivider());
  
  // Header
  const headers = ['ID', 'Status', 'Progress', 'Description', 'Last Updated'];
  const colWidths = [12, 12, 10, 35, 20];
  
  let headerLine = '  ';
  headers.forEach((header, i) => {
    headerLine += chalk.bold(header.padEnd(colWidths[i])) + '  ';
  });
  console.log(headerLine);
  console.log(chalk.gray('  ' + '─'.repeat(95)));
  
  // Rows
  sessions.forEach(session => {
    const statusColor = getStatusColor(session.status);
    const progressBar = '█'.repeat(Math.floor(session.progress / 20)) + '░'.repeat(5 - Math.floor(session.progress / 20));
    
    const row = '  ' +
      chalk.white(session.id.substring(0, 10).padEnd(colWidths[0])) + '  ' +
      statusColor(session.status.padEnd(colWidths[1])) + '  ' +
      branding.applyGradient(progressBar.padEnd(colWidths[2])) + '  ' +
      chalk.white(session.description.substring(0, colWidths[3] - 1).padEnd(colWidths[3])) + '  ' +
      chalk.dim(new Date(session.updatedAt).toLocaleDateString().padEnd(colWidths[4]));
    
    console.log(row);
  });
  
  console.log(branding.getDivider());
}

/**
 * Get color function for a status
 */
function getStatusColor(status: string): (text: string) => string {
  switch (status) {
    case 'completed':
      return chalk.greenBright;
    case 'running':
      return chalk.yellowBright;
    case 'failed':
      return chalk.redBright;
    case 'pending':
      return chalk.cyan;
    default:
      return chalk.gray;
  }
}

export const listCommand = { execute };
