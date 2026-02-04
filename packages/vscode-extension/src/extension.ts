import * as vscode from 'vscode';
import { GrumpChatViewProvider } from './sidebar/ChatViewProvider';
import { GrumpSessionsProvider } from './sidebar/SessionsProvider';
import { GrumpApiClient } from './api/GrumpApiClient';
import { registerCommands } from './commands';
import { GrumpCodeLensProvider } from './providers/CodeLensProvider';
import { GrumpHoverProvider } from './providers/HoverProvider';
import { StatusBarManager } from './StatusBarManager';

let apiClient: GrumpApiClient;
let statusBar: StatusBarManager;

export async function activate(context: vscode.ExtensionContext) {
  console.log('G-Rump AI extension activating...');

  // Initialize API client
  const config = vscode.workspace.getConfiguration('grump');
  const backendUrl = config.get<string>('backendUrl') || 'http://localhost:3000';
  const apiKey = config.get<string>('apiKey') || '';
  
  apiClient = new GrumpApiClient(backendUrl, apiKey);
  
  // Initialize status bar
  statusBar = new StatusBarManager();
  context.subscriptions.push(statusBar);

  // Register chat webview provider
  const chatProvider = new GrumpChatViewProvider(context.extensionUri, apiClient);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('grump.chatView', chatProvider)
  );

  // Register sessions tree view
  const sessionsProvider = new GrumpSessionsProvider(apiClient);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('grump.sessionsView', sessionsProvider)
  );

  // Register commands
  registerCommands(context, apiClient, chatProvider, statusBar);

  // Register code lens provider for supported languages
  const codeLensProvider = new GrumpCodeLensProvider();
  const codeLensDisposable = vscode.languages.registerCodeLensProvider(
    [
      { language: 'typescript' },
      { language: 'javascript' },
      { language: 'python' },
      { language: 'go' },
      { language: 'rust' },
      { language: 'java' },
      { language: 'csharp' },
    ],
    codeLensProvider
  );
  context.subscriptions.push(codeLensDisposable);

  // Register hover provider
  const hoverProvider = new GrumpHoverProvider(apiClient);
  const hoverDisposable = vscode.languages.registerHoverProvider(
    [
      { language: 'typescript' },
      { language: 'javascript' },
      { language: 'python' },
    ],
    hoverProvider
  );
  context.subscriptions.push(hoverDisposable);

  // Auto-connect if enabled
  const autoConnect = config.get<boolean>('autoConnect');
  if (autoConnect) {
    try {
      const connected = await apiClient.connect();
      if (connected) {
        statusBar.setConnected();
        vscode.window.showInformationMessage('G-Rump AI: Connected to backend');
      } else {
        statusBar.setDisconnected();
      }
    } catch (error) {
      statusBar.setError();
      console.error('Failed to auto-connect:', error);
    }
  }

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('grump')) {
        const newConfig = vscode.workspace.getConfiguration('grump');
        const newUrl = newConfig.get<string>('backendUrl') || 'http://localhost:3000';
        const newKey = newConfig.get<string>('apiKey') || '';
        apiClient.updateConfig(newUrl, newKey);
      }
    })
  );

  console.log('G-Rump AI extension activated!');
}

export function deactivate() {
  if (apiClient) {
    apiClient.disconnect();
  }
  console.log('G-Rump AI extension deactivated');
}

// Export for use in other modules
export function getApiClient(): GrumpApiClient {
  return apiClient;
}

export function getStatusBar(): StatusBarManager {
  return statusBar;
}
