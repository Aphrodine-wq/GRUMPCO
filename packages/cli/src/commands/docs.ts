import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';
import { extname } from 'path';
import { branding } from '../branding.js';

/**
 * grump docs - Generate docs with snarky comments
 * Documentation that tells the truth, with attitude
 */

const docTemplates = {
  header: [
    "# Documentation (Good Luck Understanding This)",
    "# README.md (Abandon Hope All Ye Who Enter)",
    "# Code Documentation (Written Under Duress)",
    "# Project Docs (What The Code Actually Does)",
    "# Documentation (May Contain Traces of Sarcasm)"
  ],
  
  intro: [
    "This project exists because someone thought it was a good idea.",
    "Welcome to the codebase. We have no idea how it works either.",
    "This documentation was written to fulfill legal requirements.",
    "By reading this, you agree that we're not responsible for what happens next.",
    "Congratulations on finding the documentation. You're one of the few."
  ],
  
  installation: [
    "## Installation (Or: How To Summon This Code)",
    "## Getting Started (Good Luck)",
    "## Prerequisites (A Computer, Hopefully)",
    "## Setup (May Require Sacrifices)"
  ],
  
  usage: [
    "## Usage (Abuse At Your Own Risk)",
    "## How To Use This (If You Must)",
    "## User Guide (For The Brave)",
    "## Running The Code (Pray First)"
  ],
  
  api: [
    "## API Reference (Or: What We Think It Does)",
    "## Functions And Methods (Good Luck)",
    "## API Documentation (May Be Fiction)",
    "## Interface Guide (Subject To Change)"
  ],
  
  contributing: [
    "## Contributing (Please Don't)",
    "## How To Help (Or Make It Worse)",
    "## Contributing Guidelines (Ignore At Will)",
    "## Join The Team (If You Dare)"
  ],
  
  troubleshooting: [
    "## Troubleshooting (Have You Tried Crying?)",
    "## Common Issues (And Uncommon Ones Too)",
    "## FAQ (Frequently Avoided Questions)",
    "## When Things Go Wrong (They Will)"
  ],
  
  snarkyComments: [
    "// This function works on my machine. Your mileage may vary.",
    "// TODO: Fix this before anyone sees it (they saw it).",
    "// WARNING: Here be dragons. And bugs. Mostly bugs.",
    "// This code is temporary. It's been temporary for 3 years.",
    "// If you're reading this, it's too late. The code has won.",
    "// Don't touch this. Seriously. The last person who did is still in therapy.",
    "// This is where the magic happens. Dark magic.",
    "// We have no idea what this does, but removing it breaks everything.",
    "// Legacy code: Too scary to touch, too important to delete.",
    "// Optimized for confusion. Readable code is for cowards.",
    "// This is a feature, not a bug. The bug is your understanding.",
    "// Comments written at 3 AM. Interpret accordingly.",
    "// Trust the process. The process is broken, but trust it anyway.",
    "// Refactor scheduled for never.",
    "// If it ain't broke, don't fix it. It's broke, but don't fix it."
  ],
  
  closing: [
    "## Conclusion (You Made It!)",
    "## The End (Finally)",
    "## That's All Folks",
    "## Documentation Complete (Or Is It?)"
  ]
};

const functionDescriptions = [
  "Does something. We think.",
  "Transforms data into confusion.",
  "Returns a value. Sometimes the right one.",
  "The heart of the system. Also the headache.",
  "Handles edge cases by creating more edge cases.",
  "Performs magic. The dark kind.",
  "Processes input. Output not guaranteed.",
  "A mystery wrapped in a function.",
  "Works as intended. Intentions may vary.",
  "Essential code. Do not question it."
];

interface DocsOptions {
  file?: string;
  output?: string;
  style?: 'sassy' | 'professional' | 'brutal';
}

export async function execute(filePath: string | undefined, options: DocsOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  📚 G-RUMP DOCUMENTATION GENERATOR 📚\n', 'title'));
  
  const target = filePath;
  const style = options.style || 'sassy';
  
  if (!target) {
    console.log(branding.status('No file specified. Generating general project docs instead.', 'sassy'));
    await generateProjectDocs(style);
    return;
  }
  
  if (!existsSync(target)) {
    console.log(branding.status(`File not found: ${target}. Can't document what doesn't exist.`, 'error'));
    return;
  }
  
  console.log(branding.format(`  Target: ${target}`, 'subtitle'));
  console.log(chalk.hex(branding.colors.lightPurple)(`  Style: ${style.toUpperCase()}`));
  console.log(branding.getThinDivider());
  
  // Read and analyze file
  let content: string;
  try {
    content = readFileSync(target, 'utf-8');
  } catch {
    console.log(branding.status("Can't read this file. It's playing hard to get.", 'error'));
    return;
  }
  
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📝 GENERATING DOCUMENTATION...\n`));
  
  // Generate file-specific docs
  const docs = generateFileDocs(target, content, style);
  
  // Display docs
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  📄 GENERATED DOCUMENTATION:\n'));
  console.log(docs);
  
  console.log('\n' + branding.getDivider());
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Docs generated. Truthfulness not guaranteed.', 'sassy'));
  
  // Easter egg
  if (Math.random() > 0.85) {
    console.log(chalk.hex(branding.colors.lightPurple)(`\n  💜 Fun fact: 90% of documentation is written after the code breaks in production.`));
  }
}

async function generateProjectDocs(style: string): Promise<void> {
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n  📝 GENERATING PROJECT DOCUMENTATION...\n`));
  
  const header = docTemplates.header[Math.floor(Math.random() * docTemplates.header.length)];
  const intro = docTemplates.intro[Math.floor(Math.random() * docTemplates.intro.length)];
  const install = docTemplates.installation[Math.floor(Math.random() * docTemplates.installation.length)];
  const usage = docTemplates.usage[Math.floor(Math.random() * docTemplates.usage.length)];
  const api = docTemplates.api[Math.floor(Math.random() * docTemplates.api.length)];
  const contribute = docTemplates.contributing[Math.floor(Math.random() * docTemplates.contributing.length)];
  const troubleshoot = docTemplates.troubleshooting[Math.floor(Math.random() * docTemplates.troubleshooting.length)];
  const closing = docTemplates.closing[Math.floor(Math.random() * docTemplates.closing.length)];
  
  const docs = `
${header}

${intro}

${install}

1. Clone this repository (if you dare)
2. Run \`npm install\` (pray it works)
3. Set up environment variables (good luck finding them)
4. Run \`npm start\` (and hope for the best)

${usage}

\`\`\`javascript
// Basic usage
const result = await doSomething();
// result may or may not be what you expect
\`\`\`

${api}

### Important Functions

- \`doSomething()\`: ${functionDescriptions[Math.floor(Math.random() * functionDescriptions.length)]}
- \`processData()\`: ${functionDescriptions[Math.floor(Math.random() * functionDescriptions.length)]}
- \`handleError()\`: ${functionDescriptions[Math.floor(Math.random() * functionDescriptions.length)]}

${troubleshoot}

**Q: Why doesn't it work?**
A: Have you tried turning it off and on again?

**Q: Is this production-ready?**
A: Define "production." Define "ready."

**Q: Who do I contact for help?**
A: Your therapist.

${contribute}

We welcome contributions! Please note:
- All PRs will be judged harshly but fairly
- Code review is just another word for roast session
- Tests are appreciated (by us, not the code)

${closing}

Thank you for reading this documentation. 
You're now qualified to be confused like the rest of us.

---
*Generated by G-Rump with ${Math.floor(Math.random() * 100)}% accuracy and ${Math.floor(Math.random() * 100)}% sass.*
`;
  
  await delay(500);
  console.log('\n' + branding.getDivider());
  console.log(chalk.hex(branding.colors.mediumPurple)('\n  📄 GENERATED README:\n'));
  console.log(chalk.hex(branding.colors.white)(docs));
}

function generateFileDocs(filePath: string, content: string, style: string): string {
  const ext = extname(filePath).slice(1);
  const lines = content.split('\n').length;
  
  // Count functions/classes
  const functionMatches = content.match(/function\s+\w+|const\s+\w+\s*=\s*\(|class\s+\w+/g) || [];
  const todoMatches = content.match(/TODO|FIXME|HACK/g) || [];
  
  const docs = `
# Documentation for ${filePath}

## Overview

This ${ext} file contains ${lines} lines of ${functionMatches.length > 0 ? 'questionable' : 'mysterious'} code.

## File Statistics

- **Total Lines**: ${lines} (approximately ${Math.floor(lines / 10)} of them actually do something)
- **Functions/Classes**: ${functionMatches.length} (names subject to change without notice)
- **TODOs/FIXMEs**: ${todoMatches.length} (signs of unfinished business)
- **Coffee Required**: ${Math.ceil(lines / 50)} cups minimum

${functionMatches.length > 0 ? `## Functions

${functionMatches.slice(0, 5).map((match, i) => {
  const name = match.replace(/function|const|class/g, '').replace(/[=\s\(\)]/g, '');
  return `### ${name || 'AnonymousFunction'}

${docTemplates.snarkyComments[Math.floor(Math.random() * docTemplates.snarkyComments.length)]}

**Purpose**: ${functionDescriptions[Math.floor(Math.random() * functionDescriptions.length)]}

**Returns**: Hopefully something useful. Sometimes \`undefined\`.

**Side Effects**: Yes.`;
}).join('\n\n')}` : ''}

## Snarky Comments Found

${Array.from(new Set(todoMatches.map(() => 
  docTemplates.snarkyComments[Math.floor(Math.random() * docTemplates.snarkyComments.length)]
))).slice(0, 3).join('\n\n')}

## Quality Assessment

- **Readability**: ${['Questionable', 'Challenging', 'Adventurous', 'Cryptic'][Math.floor(Math.random() * 4)]}
- **Maintainability**: ${['Nightmare', 'Difficult', 'Possible', 'If you must'][Math.floor(Math.random() * 4)]}
- **Documentation**: ${['Fiction', 'Aspirational', 'Outdated', 'Creative Writing'][Math.floor(Math.random() * 4)]}

---
*Documentation generated with G-Rump. Accuracy not guaranteed. Attitude guaranteed.*
`;
  
  return docs;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const docsCommand = { execute };
