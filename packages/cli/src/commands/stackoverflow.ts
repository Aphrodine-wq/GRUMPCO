import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump stackoverflow - Simulate the StackOverflow experience
 * Because we're all just copying code from the internet
 */

const duplicateReasons = [
  "Closed as duplicate of a question from 2011 that doesn't answer your question.",
  "Marked as duplicate. The linked question is about Java, not JavaScript. Close enough.",
  "This has been answered before. We won't tell you where.",
  "Duplicate of a deleted question. Good luck.",
  "Closed as duplicate of itself somehow.",
  "Marked as duplicate by someone who didn't read either question."
];

const closedReasons = [
  "Needs more focus. Also less focus. Also different focus.",
  "Opinion-based. We only accept objective subjective answers.",
  "Off-topic. This is clearly a 'how to center a div' question in disguise.",
  "Needs debugging details. Also, stop posting debugging details.",
  "Too broad. Also too specific. It's Schrodinger's question.",
  "Closed for reasons that will be explained in 6-8 weeks."
];

const answersYouGet = [
  "Have you tried turning it off and on again?",
  "Works on my machine. (posted 8 years ago, no follow-up)",
  "You shouldn't do it that way. (no explanation provided)",
  "I have the same problem! (marked as answer, no solution)",
  "Here's a completely different solution to a problem you don't have.",
  "Update: Nevermind, I fixed it. (no explanation)",
  "Try using jQuery. (question is about Python)",
  "This is actually a feature, not a bug.",
  "Read the documentation. (links to 404)",
  "I downvoted because reasons."
];

const answersYouNeed = [
  "Here's the exact solution with explanation, copy-pasteable code, and edge cases handled.",
  "I wrote a library that solves this: npm install problem-solver",
  "The docs are wrong. Here's what actually works.",
  "This is an undocumented feature. Here's how to use it.",
  "I spent 3 years debugging this. You're welcome."
];

interface StackOverflowOptions {
  question?: string;
  simulate?: boolean;
  experience?: boolean;
}

export async function execute(options: StackOverflowOptions = {}): Promise<void> {
  console.log(branding.getLogo('sassy'));
  console.log(branding.format('\n  📚 STACKOVERFLOW SIMULATOR 📚\n', 'title'));
  
  if (options.question) {
    await simulateQuestion(options.question);
    return;
  }
  
  if (options.experience) {
    await fullExperience();
    return;
  }
  
  // Default: Show stats
  console.log(chalk.hex(branding.colors.mediumPurple)('  📊 YOUR STACKOVERFLOW JOURNEY:\n'));
  
  const stats = {
    questionsAsked: Math.floor(Math.random() * 50) + 10,
    questionsClosed: Math.floor(Math.random() * 40) + 5,
    duplicates: Math.floor(Math.random() * 30) + 3,
    reputation: Math.floor(Math.random() * 1000) + 1,
    downvotes: Math.floor(Math.random() * 100) + 20,
    answers: Math.floor(Math.random() * 20) + 1,
    helpfulAnswers: Math.floor(Math.random() * 3)
  };
  
  console.log(chalk.hex(branding.colors.white)(`    Questions asked: ${stats.questionsAsked}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Questions closed: ${stats.questionsClosed} (${Math.round(stats.questionsClosed/stats.questionsAsked*100)}%)`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Marked as duplicate: ${stats.duplicates}`));
  console.log(chalk.hex(branding.colors.white)(`    Reputation: ${stats.reputation}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Unexplained downvotes: ${stats.downvotes}`));
  console.log(chalk.hex(branding.colors.white)(`    Answers received: ${stats.answers}`));
  console.log(chalk.hex(branding.colors.lightPurple)(`    Actually helpful answers: ${stats.helpfulAnswers}`));
  
  console.log('\n' + branding.getDivider());
  
  const randomAnswer = answersYouGet[Math.floor(Math.random() * answersYouGet.length)];
  console.log(branding.box(`Latest Answer: "${randomAnswer}"`, 'warning'));
  
  console.log(branding.format(`\n  ${branding.getSass()}\n`, 'sassy'));
  console.log(branding.status('Remember: Every question is a duplicate of something.', 'sassy'));
}

async function simulateQuestion(question: string): Promise<void> {
  console.log(chalk.hex(branding.colors.mediumPurple)(`  📝 YOUR QUESTION:\n`));
  console.log(chalk.hex(branding.colors.white)(`    "${question}"\n`));
  
  await delay(1000);
  
  console.log(chalk.hex(branding.colors.lightPurple)('  ⏳ Processing...'));
  await delay(500);
  console.log(chalk.hex(branding.colors.lightPurple)('  👀 Moderators viewing...'));
  await delay(500);
  
  // Random outcome
  const outcome = Math.random();
  
  if (outcome < 0.4) {
    // Closed as duplicate
    const reason = duplicateReasons[Math.floor(Math.random() * duplicateReasons.length)];
    console.log(chalk.hex('#FF6B6B')(`\n  ❌ CLOSED AS DUPLICATE`));
    console.log(chalk.hex(branding.colors.lightPurple)(`    ${reason}`));
  } else if (outcome < 0.7) {
    // Closed for other reason
    const reason = closedReasons[Math.floor(Math.random() * closedReasons.length)];
    console.log(chalk.hex('#FF6B6B')(`\n  ❌ CLOSED`));
    console.log(chalk.hex(branding.colors.lightPurple)(`    ${reason}`));
  } else if (outcome < 0.9) {
    // Unhelpful answer
    const answer = answersYouGet[Math.floor(Math.random() * answersYouGet.length)];
    console.log(chalk.hex('#FFD700')(`\n  ✓ ANSWER RECEIVED`));
    console.log(chalk.hex(branding.colors.white)(`    "${answer}"`));
    console.log(chalk.hex(branding.colors.lightPurple)(`    (This doesn't help at all)`));
  } else {
    // Actually helpful!
    const answer = answersYouNeed[Math.floor(Math.random() * answersYouNeed.length)];
    console.log(chalk.hex('#00FF00')(`\n  ✓ ACTUALLY HELPFUL ANSWER!`));
    console.log(chalk.hex(branding.colors.white)(`    "${answer}"`));
    console.log(chalk.hex(branding.colors.lightPurple)(`    (Rare occurrence! Screenshot this.)`));
  }
  
  console.log('\n' + branding.getDivider());
}

async function fullExperience(): Promise<void> {
  console.log(chalk.hex(branding.colors.mediumPurple)('  🎭 THE FULL STACKOVERFLOW EXPERIENCE:\n'));
  
  const stages = [
    { text: "You have a question...", emoji: "🤔" },
    { text: "You search for 30 minutes...", emoji: "🔍" },
    { text: "You find nothing relevant...", emoji: "😕" },
    { text: "You carefully craft your question...", emoji: "✍️" },
    { text: "You add code examples...", emoji: "💻" },
    { text: "You explain what you've tried...", emoji: "📝" },
    { text: "You hit 'Post'...", emoji: "🚀" },
    { text: "Immediately downvoted...", emoji: "👎" },
    { text: "Closed as duplicate in 30 seconds...", emoji: "❌" },
    { text: "The 'duplicate' is from 2009...", emoji: "📅" },
    { text: "It's about a different language...", emoji: "🤦" },
    { text: "You give up and figure it out yourself...", emoji: "🧠" },
    { text: "6 months later someone asks the same thing...", emoji: "😠" },
    { text: "It gets answered perfectly...", emoji: "😭" }
  ];
  
  for (const stage of stages) {
    console.log(chalk.hex(branding.colors.white)(`    ${stage.emoji} ${stage.text}`));
    await delay(600);
  }
  
  console.log('\n' + branding.getDivider());
  console.log(branding.box("Welcome to StackOverflow. Suffering is a feature.", 'error'));
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const stackoverflowCommand = { execute };
