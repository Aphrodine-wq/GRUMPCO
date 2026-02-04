import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import chalk from 'chalk';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { withSpinner } from '../utils/progress.js';
import { handleApiError, validateRequired } from '../utils/errors.js';

interface ArchitectureOptions {
  format: string;
  output?: string;
  workspace?: string;
}

/**
 * Generate system architecture diagrams and documentation
 */
export async function execute(description: string, options: ArchitectureOptions): Promise<void> {
  validateRequired(description, 'description');
  
  const apiUrl = config.get('apiUrl');
  const headers = config.getHeaders();
  const workspacePath = options.workspace ? resolve(options.workspace) : process.cwd();
  
  console.log(branding.format('Generating system architecture...', 'subtitle'));
  console.log(chalk.dim(`Description: ${description}`));
  console.log(chalk.dim(`Format: ${options.format}\n`));
  
  // Call the architecture API
  const result = await withSpinner(
    'Analyzing requirements and generating architecture...',
    async () => {
      const response = await fetch(`${apiUrl}/api/analyze/architecture`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          description,
          workspacePath,
          diagramType: options.format,
          includeRecommendations: true
        })
      });
      
      if (!response.ok) {
        handleApiError(response);
      }
      
      return response.json();
    },
    'Architecture generated'
  );
  
  const data = result as { 
    mermaidDiagram?: string; 
    dotGraph?: string;
    jsonSchema?: unknown;
    summary?: string;
    recommendations?: string[];
  };
  
  // Display summary if available
  if (data.summary) {
    console.log('\n' + branding.format('Architecture Summary:', 'subtitle'));
    console.log(chalk.white(data.summary));
  }
  
  // Display recommendations
  if (data.recommendations && data.recommendations.length > 0) {
    console.log('\n' + branding.format('Recommendations:', 'subtitle'));
    data.recommendations.forEach((rec, i) => {
      console.log(chalk.yellow(`  ${i + 1}. ${rec}`));
    });
  }
  
  // Determine output content based on format
  let outputContent: string;
  let extension: string;
  
  switch (options.format) {
    case 'mermaid':
      outputContent = data.mermaidDiagram || '';
      extension = 'mmd';
      break;
    case 'dot':
      outputContent = data.dotGraph || '';
      extension = 'dot';
      break;
    case 'json':
      outputContent = JSON.stringify(data.jsonSchema || data, null, 2);
      extension = 'json';
      break;
    default:
      outputContent = data.mermaidDiagram || '';
      extension = 'mmd';
  }
  
  // Save to file or output to console
  if (options.output) {
    const outputPath = resolve(options.output);
    
    // Ensure directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    
    writeFileSync(outputPath, outputContent, 'utf-8');
    
    console.log('\n' + branding.getDivider());
    console.log(branding.status(`Architecture saved to: ${outputPath}`, 'success'));
  } else {
    console.log('\n' + branding.getDivider());
    console.log(branding.format('Generated Architecture:', 'subtitle'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(outputContent);
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.dim('\nTip: Use --output to save to a file'));
  }
  
  // Show format-specific tips
  if (options.format === 'mermaid') {
    console.log(chalk.dim('Tip: View this diagram at https://mermaid.live'));
  }
}

export const architectureCommand = { execute };
