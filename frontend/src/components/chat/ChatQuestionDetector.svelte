<script lang="ts" module>
  /**
   * ChatQuestionDetector - Types and utilities for detecting numbered questions
   */
  export interface ParsedQuestion {
    number: number;
    text: string;
    examples?: string;
    options?: string[];
  }

  /**
   * Extract ABCD options from a question string.
   * Handles patterns like:
   *  - "(WinUI 3, WPF, Win32, or all of the above?)"
   *  - "Visual drag-and-drop designer, project template wizard, code scaffolding tool, or all three?"
   *  - "professional developers, citizen developers/no-code users, or both?"
   */
  export function extractOptions(questionText: string): string[] | undefined {
    // First try: parenthetical options like "(opt1, opt2, or opt3)"
    const parenMatch = questionText.match(/\(([^)]{8,})\)/);
    const source = parenMatch ? parenMatch[1] : questionText;

    // Look for comma-separated items with an "or" before the last one
    // Pattern: "A, B, C, or D" or "A, B, or C"
    const orSplit = source.split(/,\s*or\s+/i);
    if (orSplit.length < 2) {
      // Try "A or B" (no commas)
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
      .map((s) => s.replace(/[?.!]+$/, '').trim()) // strip trailing punctuation
      .filter((s) => s.length > 0);

    // Need at least 2 options to be useful
    return allOpts.length >= 2 ? allOpts : undefined;
  }

  /**
   * Detect numbered questions in the AI response.
   * Looks for patterns like "1. ...?\n2. ...?" (at least 2 questions).
   * Extracts ABCD options from the question text when available.
   * Returns null if no questions detected.
   */
  export function detectNumberedQuestions(text: string): {
    questions: ParsedQuestion[];
    intro: string;
    outro: string;
  } | null {
    // Match numbered items: "1. some text?" where the line ends with ?
    // Also handle multiline questions that have parenthetical examples
    const questionPattern = /^\s*(\d+)\.\s+(.+?)\s*$/gm;
    const matches: ParsedQuestion[] = [];
    let m: RegExpExecArray | null;

    while ((m = questionPattern.exec(text)) !== null) {
      const num = parseInt(m[1], 10);
      let fullText = m[2].trim();

      // Strip markdown bold markers (**text** → text)
      fullText = fullText.replace(/\*\*([^*]+)\*\*/g, '$1');

      // Check if it ends with a question mark (or has one in the line)
      if (!fullText.includes('?')) continue;

      // Extract options for ABCD format
      const options = extractOptions(fullText);

      // Extract examples from parentheses e.g. "(e.g., WinUI 3, WPF)"
      let examples: string | undefined;
      const exMatch = fullText.match(/\(([^)]*e\.g\.[^)]+)\)/i);
      if (exMatch) {
        examples = exMatch[1].trim();
      }

      // Clean up question text: remove the options portion for display
      let cleanText = fullText;
      // Remove parenthetical options if they were the source
      cleanText = cleanText.replace(/\s*\([^)]{8,}\)\s*/g, ' ').trim();
      // Clean up trailing question marks or whitespace
      cleanText = cleanText.replace(/\s*\?\s*$/, '?');
      // If options were inline (no parens), extract just the question part before options
      if (options && !fullText.match(/\([^)]{8,}\)/)) {
        // Try to find the question mark that separates the question from the options
        const qMarkIdx = cleanText.indexOf('?');
        if (qMarkIdx !== -1) {
          // Check if options appear after the question mark (like "What's...? opt1, opt2, or opt3?")
          cleanText = cleanText.slice(0, qMarkIdx + 1);
        } else {
          // Options are part of the question text, extract up to the first option
          // Find where the first option appears to split the descriptive text from options
          const dashIdx = cleanText.indexOf('\u2014'); // em-dash
          if (dashIdx !== -1) {
            cleanText = cleanText.slice(0, dashIdx).trim() + '?';
          }
        }
      }

      matches.push({ number: num, text: cleanText || fullText, examples, options });
    }

    // Need at least 2 numbered questions to trigger the modal
    if (matches.length < 2) return null;

    // Extract intro (text before first question) and outro (text after last question)
    const firstQ = text.indexOf(`${matches[0].number}.`);
    const lastQNum = matches[matches.length - 1].number;
    // Find the end of the last question line
    const lastQPattern = new RegExp(`${lastQNum}\\.\\s+.*?(\\n|$)`, 's');
    const lastQMatch = lastQPattern.exec(text.slice(firstQ));
    const lastQEnd = lastQMatch ? firstQ + lastQMatch.index + lastQMatch[0].length : text.length;

    const intro = text.slice(0, firstQ).trim();
    const outro = text.slice(lastQEnd).trim();

    return { questions: matches, intro, outro };
  }
</script>

<script lang="ts">
  /**
   * ChatQuestionDetector Component
   *
   * Component wrapper for question detection display (if needed).
   * Main exports are the detectNumberedQuestions and extractOptions functions above.
   */

  interface Props {
    text: string;
    onDetect?: (
      result: { questions: ParsedQuestion[]; intro: string; outro: string } | null
    ) => void;
  }

  let { text, onDetect }: Props = $props();

  $effect(() => {
    if (onDetect) {
      const result = detectNumberedQuestions(text);
      onDetect(result);
    }
  });
</script>

<!-- This is a utility component, no visible UI unless detection results needed -->
