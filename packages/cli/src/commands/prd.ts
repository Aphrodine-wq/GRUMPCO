import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import chalk from 'chalk';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { withSpinner, MultiStepProgress } from '../utils/progress.js';
import { handleApiError, validateRequired } from '../utils/errors.js';

interface PrdOptions {
  output: string;
  template: string;
}

/**
 * Generate a Product Requirements Document (PRD)
 */
export async function execute(description: string, options: PrdOptions): Promise<void> {
  validateRequired(description, 'description');
  
  const apiUrl = config.get('apiUrl');
  const headers = config.getHeaders();
  
  console.log(branding.format('Generating Product Requirements Document...', 'subtitle'));
  console.log(chalk.dim(`Description: ${description}`));
  console.log(chalk.dim(`Template: ${options.template}\n`));
  
  const progress = new MultiStepProgress([
    'Analyzing product requirements...',
    'Defining user stories...',
    'Creating feature specifications...',
    'Generating technical requirements...',
    'Formatting PRD document...'
  ]);
  
  progress.start();
  
  // Step 1: Analyze
  await new Promise(resolve => setTimeout(resolve, 500));
  progress.next();
  
  // Call the PRD generation API
  const result = await withSpinner(
    'Generating comprehensive PRD...',
    async () => {
      const response = await fetch(`${apiUrl}/api/prd/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          description,
          template: options.template,
          includeSections: [
            'overview',
            'objectives',
            'user_stories',
            'features',
            'technical_requirements',
            'acceptance_criteria',
            'timeline'
          ]
        })
      });
      
      if (!response.ok) {
        handleApiError(response);
      }
      
      return response.json();
    }
  );
  
  progress.next();
  progress.next();
  progress.next();
  progress.succeed();
  
  const data = result as {
    title: string;
    overview: string;
    objectives: string[];
    userStories: Array<{ role: string; want: string; benefit: string }>;
    features: Array<{ name: string; description: string; priority: string }>;
    technicalRequirements: string[];
    acceptanceCriteria: string[];
    timeline?: string;
    markdown?: string;
  };
  
  // Generate markdown content
  let prdContent: string;
  
  if (data.markdown) {
    prdContent = data.markdown;
  } else {
    prdContent = generatePrdMarkdown(data);
  }
  
  // Save to file
  const outputPath = resolve(options.output);
  const outputDir = dirname(outputPath);
  
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  writeFileSync(outputPath, prdContent, 'utf-8');
  
  // Display summary
  console.log('\n' + branding.format('PRD Summary:', 'subtitle'));
  console.log(chalk.white(`Title: ${data.title}`));
  console.log(chalk.white(`Features: ${data.features?.length || 0}`));
  console.log(chalk.white(`User Stories: ${data.userStories?.length || 0}`));
  
  console.log('\n' + branding.getDivider());
  console.log(branding.status(`PRD saved to: ${outputPath}`, 'success'));
}

/**
 * Generate PRD markdown from structured data
 */
function generatePrdMarkdown(data: {
  title: string;
  overview: string;
  objectives: string[];
  userStories: Array<{ role: string; want: string; benefit: string }>;
  features: Array<{ name: string; description: string; priority: string }>;
  technicalRequirements: string[];
  acceptanceCriteria: string[];
  timeline?: string;
}): string {
  const date = new Date().toISOString().split('T')[0];
  
  let markdown = `# ${data.title}\n\n`;
  markdown += `**Generated:** ${date}\n\n`;
  markdown += `---\n\n`;
  
  // Overview
  markdown += `## 1. Overview\n\n`;
  markdown += `${data.overview}\n\n`;
  
  // Objectives
  markdown += `## 2. Objectives\n\n`;
  data.objectives.forEach((obj, i) => {
    markdown += `${i + 1}. ${obj}\n`;
  });
  markdown += '\n';
  
  // User Stories
  markdown += `## 3. User Stories\n\n`;
  data.userStories.forEach((story, i) => {
    markdown += `- **${story.role}**: As a ${story.role}, I want ${story.want} so that ${story.benefit}\n`;
  });
  markdown += '\n';
  
  // Features
  markdown += `## 4. Features\n\n`;
  data.features.forEach((feature, i) => {
    const priority = feature.priority === 'high' ? '🔴' : feature.priority === 'medium' ? '🟡' : '🟢';
    markdown += `### ${i + 1}. ${feature.name} ${priority}\n\n`;
    markdown += `${feature.description}\n\n`;
  });
  
  // Technical Requirements
  markdown += `## 5. Technical Requirements\n\n`;
  data.technicalRequirements.forEach((req, i) => {
    markdown += `- ${req}\n`;
  });
  markdown += '\n';
  
  // Acceptance Criteria
  markdown += `## 6. Acceptance Criteria\n\n`;
  data.acceptanceCriteria.forEach((criteria, i) => {
    markdown += `- [ ] ${criteria}\n`;
  });
  markdown += '\n';
  
  // Timeline
  if (data.timeline) {
    markdown += `## 7. Timeline\n\n`;
    markdown += `${data.timeline}\n\n`;
  }
  
  markdown += `---\n\n`;
  markdown += `*Generated by G-Rump CLI* ☹️\n`;
  
  return markdown;
}

export const prdCommand = { execute };
