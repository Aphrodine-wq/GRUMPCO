import * as vscode from 'vscode';
import { GrumpApiClient } from './api/GrumpApiClient';
import { GrumpChatViewProvider } from './sidebar/ChatViewProvider';
import { StatusBarManager } from './StatusBarManager';

export function registerCommands(
  context: vscode.ExtensionContext,
  apiClient: GrumpApiClient,
  chatProvider: GrumpChatViewProvider,
  statusBar: StatusBarManager
): void {
  // Open chat command
  context.subscriptions.push(
    vscode.commands.registerCommand('grump.openChat', () => {
      chatProvider.showPanel();
    })
  );

  // SHIP workflow command
  context.subscriptions.push(
    vscode.commands.registerCommand('grump.ship', async () => {
      const description = await vscode.window.showInputBox({
        prompt: 'Describe what you want to build',
        placeHolder: 'e.g., A REST API for a todo app with user authentication',
      });

      if (!description) return;

      statusBar.setLoading('Starting SHIP...');
      
      try {
        const session = await apiClient.startShip(description);
        vscode.window.showInformationMessage(`SHIP session started: ${session.id}`);
        
        // Execute SHIP workflow
        await apiClient.executeShip(session.id);
        
        // Poll for status
        let completed = false;
        while (!completed) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const status = await apiClient.getShipStatus(session.id);
          statusBar.setLoading(`SHIP: ${status.phase}`);
          
          if (status.status === 'completed' || status.status === 'failed') {
            completed = true;
            if (status.status === 'completed') {
              vscode.window.showInformationMessage('SHIP workflow completed!');
              statusBar.setConnected();
            } else {
              vscode.window.showErrorMessage('SHIP workflow failed');
              statusBar.setError();
            }
          }
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`SHIP failed: ${error.message}`);
        statusBar.setError();
      }
    })
  );

  // Generate architecture command
  context.subscriptions.push(
    vscode.commands.registerCommand('grump.architecture', async () => {
      const description = await vscode.window.showInputBox({
        prompt: 'Describe the system architecture',
        placeHolder: 'e.g., Microservices architecture for an e-commerce platform',
      });

      if (!description) return;

      statusBar.setLoading('Generating architecture...');
      
      try {
        const result = await apiClient.generateArchitecture(description);
        if (result.success) {
          // Create new document with diagram
          const doc = await vscode.workspace.openTextDocument({
            content: result.content,
            language: 'markdown',
          });
          await vscode.window.showTextDocument(doc);
          vscode.window.showInformationMessage('Architecture diagram generated!');
        } else {
          vscode.window.showErrorMessage(`Failed: ${result.error}`);
        }
        statusBar.setConnected();
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed: ${error.message}`);
        statusBar.setError();
      }
    })
  );

  // Generate PRD command
  context.subscriptions.push(
    vscode.commands.registerCommand('grump.prd', async () => {
      const description = await vscode.window.showInputBox({
        prompt: 'Describe the product',
        placeHolder: 'e.g., A mobile app for tracking fitness goals',
      });

      if (!description) return;

      statusBar.setLoading('Generating PRD...');
      
      try {
        const result = await apiClient.generatePrd(description);
        if (result.success) {
          const doc = await vscode.workspace.openTextDocument({
            content: result.content,
            language: 'markdown',
          });
          await vscode.window.showTextDocument(doc);
          vscode.window.showInformationMessage('PRD generated!');
        } else {
          vscode.window.showErrorMessage(`Failed: ${result.error}`);
        }
        statusBar.setConnected();
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed: ${error.message}`);
        statusBar.setError();
      }
    })
  );

  // Generate code command
  context.subscriptions.push(
    vscode.commands.registerCommand('grump.codegen', async () => {
      const editor = vscode.window.activeTextEditor;
      const architecture = editor ? editor.document.getText() : '';
      
      if (!architecture) {
        vscode.window.showWarningMessage('Please open a file with architecture/specification first');
        return;
      }

      statusBar.setLoading('Generating code...');
      
      try {
        const result = await apiClient.generateCode(architecture);
        if (result.success) {
          const doc = await vscode.workspace.openTextDocument({
            content: result.content,
            language: 'json',
          });
          await vscode.window.showTextDocument(doc);
          vscode.window.showInformationMessage('Code generated!');
        } else {
          vscode.window.showErrorMessage(`Failed: ${result.error}`);
        }
        statusBar.setConnected();
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed: ${error.message}`);
        statusBar.setError();
      }
    })
  );

  // Explain code command
  context.subscriptions.push(
    vscode.commands.registerCommand('grump.explainCode', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.selection;
      const code = editor.document.getText(selection);
      
      if (!code) {
        vscode.window.showWarningMessage('Please select some code first');
        return;
      }

      const language = editor.document.languageId;
      statusBar.setLoading('Explaining code...');

      try {
        const result = await apiClient.explainCode(code, language);
        if (result.success) {
          chatProvider.addMessage('user', `Explain this ${language} code:\n\`\`\`${language}\n${code}\n\`\`\``);
          chatProvider.addMessage('assistant', result.content);
          chatProvider.showPanel();
        } else {
          vscode.window.showErrorMessage(`Failed: ${result.error}`);
        }
        statusBar.setConnected();
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed: ${error.message}`);
        statusBar.setError();
      }
    })
  );

  // Refactor code command
  context.subscriptions.push(
    vscode.commands.registerCommand('grump.refactorCode', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.selection;
      const code = editor.document.getText(selection);
      
      if (!code) {
        vscode.window.showWarningMessage('Please select some code first');
        return;
      }

      const instructions = await vscode.window.showInputBox({
        prompt: 'Refactoring instructions (optional)',
        placeHolder: 'e.g., Convert to async/await, add error handling',
      });

      const language = editor.document.languageId;
      statusBar.setLoading('Refactoring code...');

      try {
        const result = await apiClient.refactorCode(code, language, instructions);
        if (result.success) {
          // Show diff
          chatProvider.addMessage('user', `Refactor this ${language} code${instructions ? `: ${instructions}` : ''}`);
          chatProvider.addMessage('assistant', result.content);
          chatProvider.showPanel();
        } else {
          vscode.window.showErrorMessage(`Failed: ${result.error}`);
        }
        statusBar.setConnected();
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed: ${error.message}`);
        statusBar.setError();
      }
    })
  );

  // Generate tests command
  context.subscriptions.push(
    vscode.commands.registerCommand('grump.generateTests', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.selection;
      const code = editor.document.getText(selection);
      
      if (!code) {
        vscode.window.showWarningMessage('Please select some code first');
        return;
      }

      const framework = await vscode.window.showQuickPick(
        ['Jest', 'Vitest', 'Mocha', 'pytest', 'Go testing', 'JUnit', 'Auto-detect'],
        { placeHolder: 'Select test framework' }
      );

      const language = editor.document.languageId;
      statusBar.setLoading('Generating tests...');

      try {
        const result = await apiClient.generateTests(code, language, framework === 'Auto-detect' ? undefined : framework);
        if (result.success) {
          const doc = await vscode.workspace.openTextDocument({
            content: result.content,
            language,
          });
          await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
          vscode.window.showInformationMessage('Tests generated!');
        } else {
          vscode.window.showErrorMessage(`Failed: ${result.error}`);
        }
        statusBar.setConnected();
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed: ${error.message}`);
        statusBar.setError();
      }
    })
  );

  // Generate docs command
  context.subscriptions.push(
    vscode.commands.registerCommand('grump.generateDocs', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.selection;
      const code = selection.isEmpty ? editor.document.getText() : editor.document.getText(selection);

      const language = editor.document.languageId;
      statusBar.setLoading('Generating documentation...');

      try {
        const result = await apiClient.generateDocs(code, language);
        if (result.success) {
          const doc = await vscode.workspace.openTextDocument({
            content: result.content,
            language: 'markdown',
          });
          await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
          vscode.window.showInformationMessage('Documentation generated!');
        } else {
          vscode.window.showErrorMessage(`Failed: ${result.error}`);
        }
        statusBar.setConnected();
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed: ${error.message}`);
        statusBar.setError();
      }
    })
  );

  // Set API key command
  context.subscriptions.push(
    vscode.commands.registerCommand('grump.setApiKey', async () => {
      const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your G-Rump API key',
        password: true,
        placeHolder: 'sk-...',
      });

      if (apiKey) {
        const config = vscode.workspace.getConfiguration('grump');
        await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('API key saved!');
      }
    })
  );

  // Connect to backend command
  context.subscriptions.push(
    vscode.commands.registerCommand('grump.connectToBackend', async () => {
      statusBar.setLoading('Connecting...');
      
      try {
        const connected = await apiClient.connect();
        if (connected) {
          statusBar.setConnected();
          vscode.window.showInformationMessage('Connected to G-Rump backend!');
        } else {
          statusBar.setDisconnected();
          vscode.window.showWarningMessage('Failed to connect to backend');
        }
      } catch (error: any) {
        statusBar.setError();
        vscode.window.showErrorMessage(`Connection failed: ${error.message}`);
      }
    })
  );
}
