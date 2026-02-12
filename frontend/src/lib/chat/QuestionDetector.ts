/**
 * Question Detector
 *
 * Detects numbered questions from AI responses with ABCD options
 */

export interface ParsedQuestion {
  number: number;
  text: string;
  examples?: string;
  options?: string[];
}

export interface DetectedQuestions {
  questions: ParsedQuestion[];
  intro: string;
  outro: string;
}

/**
 * Extract ABCD options from a question string.
 * Handles patterns like:
 *  - "(WinUI 3, WPF, Win32, or all of the above?)"
 *  - "Visual drag-and-drop designer, project template wizard, code scaffolding tool, or all three?"
 *  - "A, B, C, or D"
 *  - Bullet-style: "- Option A\n- Option B"
 */
export function extractOptions(questionText: string): string[] | undefined {
  // First try: parenthetical options like "(opt1, opt2, or opt3)"
  const parenMatch = questionText.match(/\(([^)]{8,})\)/);
  if (parenMatch) {
    const inner = parenMatch[1];
    const opts = splitOptionsList(inner);
    if (opts && opts.length >= 2) return opts;
  }

  // Second try: colon-separated options "Question: opt1, opt2, or opt3?"
  const colonMatch = questionText.match(/:\s*(.+\s+or\s+.+)\??$/i);
  if (colonMatch) {
    const opts = splitOptionsList(colonMatch[1]);
    if (opts && opts.length >= 2) return opts;
  }

  // Third try: comma+or pattern anywhere in the question
  if (questionText.includes(',') && /\bor\b/i.test(questionText)) {
    const opts = splitOptionsList(questionText);
    if (opts && opts.length >= 2) return opts;
  }

  // Fourth try: simple "A or B" (no commas)
  const simpleOr = questionText.split(/\s+or\s+/i);
  if (simpleOr.length === 2) {
    const a = simpleOr[0]
      .replace(/^.*\?\s*/, '')
      .replace(/[?.!]+$/, '')
      .trim();
    const b = simpleOr[1].replace(/[?.!]+$/, '').trim();
    if (a.length > 1 && b.length > 1 && a.length < 60 && b.length < 60) {
      return [a, b];
    }
  }

  return undefined;
}

/** Split a comma + "or" separated list into clean option strings */
function splitOptionsList(source: string): string[] | undefined {
  const orSplit = source.split(/,\s*or\s+/i);
  if (orSplit.length < 2) {
    // Try simple "or" split for "A or B"
    const simpleOr = source.split(/\s+or\s+/i);
    if (simpleOr.length === 2) {
      return simpleOr.map((s) => s.replace(/[?.!]+$/, '').trim()).filter(Boolean);
    }
    return undefined;
  }

  // Split the first part by commas, then append the last part
  const beforeOr = orSplit.slice(0, -1).join(', ').split(/,\s*/);
  const afterOr = orSplit[orSplit.length - 1];
  const allOpts = [...beforeOr, afterOr]
    .map((s) => s.replace(/[?.!]+$/, '').trim())
    .filter((s) => s.length > 0);

  return allOpts.length >= 2 ? allOpts : undefined;
}

/** Default fallback options when no options can be parsed from the question text */
const DEFAULT_OPTIONS = ['Yes', 'No', 'Not sure — let me describe'];

/**
 * Detect numbered questions in the AI response.
 * Looks for patterns like "1. ...?\n2. ...?" (at least 2 questions).
 * Returns null if no questions detected.
 */
export function detectNumberedQuestions(text: string): DetectedQuestions | null {
  // Match numbered items: "1. some text?" where the line ends with ?
  const questionPattern = /^\s*(\d+)\.\s+(.+?)\s*$/gm;
  const matches: ParsedQuestion[] = [];
  let m: RegExpExecArray | null;

  while ((m = questionPattern.exec(text)) !== null) {
    const num = parseInt(m[1], 10);
    let fullText = m[2].trim();

    // Strip markdown bold markers
    fullText = fullText.replace(/\*\*([^*]+)\*\*/g, '$1');

    if (!fullText.includes('?')) continue;

    const options = extractOptions(fullText);

    // Extract examples from parentheses
    let examples: string | undefined;
    const exMatch = fullText.match(/\(([^)]*e\.g\.[^)]+)\)/i);
    if (exMatch) {
      examples = exMatch[1].trim();
    }

    // Clean up question text
    let cleanText = fullText;
    cleanText = cleanText.replace(/\s*\([^)]{8,}\)\s*/g, ' ').trim();
    cleanText = cleanText.replace(/\s*\?\s*$/, '?');

    if (options && !fullText.match(/\([^)]{8,}\)/)) {
      const qMarkIdx = cleanText.indexOf('?');
      if (qMarkIdx !== -1) {
        cleanText = cleanText.slice(0, qMarkIdx + 1);
      }
    }

    // If no options were parsed, use default fallback options
    // so the modal always renders in ABCD format
    const finalOptions = options ?? DEFAULT_OPTIONS;

    matches.push({ number: num, text: cleanText || fullText, examples, options: finalOptions });
  }

  // Need at least 2 numbered questions
  if (matches.length < 2) return null;

  // Extract intro and outro
  const firstQ = text.indexOf(`${matches[0].number}.`);
  const lastQNum = matches[matches.length - 1].number;
  const lastQPattern = new RegExp(`${lastQNum}\\.\\s+.*?(\\n|$)`, 's');
  const lastQMatch = lastQPattern.exec(text.slice(firstQ));
  const lastQEnd = lastQMatch ? firstQ + lastQMatch.index + lastQMatch[0].length : text.length;

  const intro = text.slice(0, firstQ).trim();
  const outro = text.slice(lastQEnd).trim();

  return { questions: matches, intro, outro };
}
