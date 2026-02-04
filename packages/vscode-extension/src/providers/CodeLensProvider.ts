import * as vscode from 'vscode';

export class GrumpCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  constructor() {
    // Watch for configuration changes
    vscode.workspace.onDidChangeConfiguration((_) => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const config = vscode.workspace.getConfiguration('grump');
    const showInlineHints = config.get<boolean>('showInlineHints');
    
    if (!showInlineHints) {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();

    // Find function/method definitions
    const functionPatterns = [
      // JavaScript/TypeScript functions
      /^(\s*)(export\s+)?(async\s+)?function\s+(\w+)/gm,
      // Arrow functions assigned to variables
      /^(\s*)(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(/gm,
      // Class methods
      /^(\s*)(public|private|protected|static|async)?\s*(async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/gm,
      // Python functions
      /^(\s*)(async\s+)?def\s+(\w+)/gm,
      // Go functions
      /^func\s+(\w+)/gm,
      // Rust functions
      /^(\s*)(pub\s+)?(async\s+)?fn\s+(\w+)/gm,
    ];

    for (const pattern of functionPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const line = document.positionAt(match.index).line;
        const range = new vscode.Range(line, 0, line, 0);
        
        // Add "Explain" code lens
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: '$(lightbulb) Explain',
            command: 'grump.explainCode',
            tooltip: 'Explain this function with G-Rump AI',
          })
        );

        // Add "Generate Tests" code lens
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: '$(beaker) Tests',
            command: 'grump.generateTests',
            tooltip: 'Generate tests for this function',
          })
        );

        // Add "Refactor" code lens
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: '$(tools) Refactor',
            command: 'grump.refactorCode',
            tooltip: 'Refactor this function with G-Rump AI',
          })
        );
      }
    }

    return codeLenses;
  }

  resolveCodeLens(codeLens: vscode.CodeLens): vscode.CodeLens {
    return codeLens;
  }
}
