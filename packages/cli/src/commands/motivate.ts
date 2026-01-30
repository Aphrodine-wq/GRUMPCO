import chalk from 'chalk';
import { branding } from '../branding.js';

/**
 * grump motivate - Backhanded motivation with purple sass
 * Because sometimes you need encouragement... with a side of reality
 */

const motivations = {
  gentle: [
    "You're not the worst coder I've seen today. Probably.",
    "Your code exists. That's... technically an achievement.",
    "Hey, at least you're trying. That's step one of... many steps.",
    "Your functions compile. Let's focus on that win.",
    "You've successfully turned caffeine into code. Mostly.",
    "Your determination is admirable. Your execution needs work.",
    "Rome wasn't built in a day. Your app won't be either. At this rate.",
    "Every expert was once a beginner. You're... somewhere in the middle.",
    "Your code has potential. Like a diamond in the rough. Very rough.",
    "Believe in yourself! Someone has to."
  ],
  realistic: [
    "You're not the worst coder... today. Check back tomorrow.",
    "Your code works! Don't ask how. Just accept it.",
    "You've got this! Or you'll figure it out eventually.",
    "Progress is progress, even if it's measured in StackOverflow tabs.",
    "Your debugging skills are... developing. Like a photo in darkroom.",
    "Keep coding! Eventually something will stick. Hopefully.",
    "You're learning! Mostly what not to do, but that's learning.",
    "Your persistence is inspiring. Your syntax is... present.",
    "Every bug you fix is a victory. You have many victories ahead.",
    "Code on, brave soldier. The compiler is your ally. Mostly."
  ],
  tough: [
    "Stop reading this and fix that bug. You know which one.",
    "Your code won't write itself. But looking at it, maybe it should.",
    "Get up. Coffee. Code. Repeat until something works.",
    "That error message isn't going to Google itself. Actually, you should.",
    "Your deadline is approaching faster than your understanding of async.",
    "Put down the phone. Pick up the keyboard. Write less terrible code.",
    "Those 47 console.logs won't delete themselves. Actually, they should.",
    "Your imposter syndrome is lying. Your incompetence might not be.",
    "Git commit -m 'stuff' isn't a commit message. Do better.",
    "That feature isn't going to implement itself. Unfortunately."
  ],
  sarcastic: [
    "Wow, you opened your IDE. Truly inspirational.",
    "You're one Google search away from being a senior dev. Or not.",
    "Your commit history reads like a cry for help. Keep crying.",
    "You've successfully survived another standup. The bar is low.",
    "Another day, another 'temporary' fix. Living the dream.",
    "Your code style is unique. Like a fingerprint. Of a criminal.",
    "Congratulations on making it compile. The runtime errors await!",
    "You're like a coding superhero. If the superpower was creating bugs.",
    "Your feature works! On your machine. In perfect conditions. For now.",
    "Keep pushing to main. What's the worst that could happen? (Don't answer that.)"
  ],
  chaotic: [
    "Embrace the chaos! Your code already has.",
    "Who needs clean code when you have... this?",