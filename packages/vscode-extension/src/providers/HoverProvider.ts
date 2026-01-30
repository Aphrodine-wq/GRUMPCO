import * as vscode from 'vscode';
import { GrumpApiClient } from '../api/GrumpApiClient';

export class GrumpHoverProvider implements vscode.HoverProvider {
  constructor(private readonly apiClient: GrumpApiClient) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    // Get the word at the current position
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
      return null;
    }

    const word = document.getText(wordRange);
    
    // Only provide hover for potential function/method calls
    const line = document.lineAt(position.line).text;
    const charAfter = line.charAt(wordRange.end.character);
    
    if (charAfter !== '(') {
      return null; // Not a function call
    }

    // Get some context around the word
    const startLine = Math.max(0, position.line - 5);
    const endLine = Math.min(document.lineCount - 1, position.line + 10);
    const contextRange = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
    const context = document.getText(contextRange);

    // Create a hover with a "quick explain" option
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportHtml = true;

    markdown.appendMarkdown(`**${word}**\n\n`);
    markdown.appendMarkdown(`[$(lightbulb) Explain with G-Rump](command:grump.explainCode)\n\n`);
    markdown.appendMarkdown(`---\n`);
    markdown.appendMarkdown(`*Powered by G-Rump AI*`);

    return new vscode.Hover(markdown, wordRange);
  }
}
