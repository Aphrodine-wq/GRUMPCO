import * as vscode from 'vscode';

export class StatusBarManager implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private spinnerInterval: NodeJS.Timeout | null = null;
  private spinnerFrames = ['$(sync~spin)', '$(loading~spin)'];
  private currentFrame = 0;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'grump.openChat';
    this.setDisconnected();
    this.statusBarItem.show();
  }

  setConnected(): void {
    this.stopSpinner();
    this.statusBarItem.text = '$(zap) G-Rump';
    this.statusBarItem.tooltip = 'G-Rump AI - Connected';
    this.statusBarItem.backgroundColor = undefined;
  }

  setDisconnected(): void {
    this.stopSpinner();
    this.statusBarItem.text = '$(circle-slash) G-Rump';
    this.statusBarItem.tooltip = 'G-Rump AI - Disconnected (click to open)';
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }

  setLoading(message?: string): void {
    this.statusBarItem.text = `$(sync~spin) G-Rump${message ? `: ${message}` : ''}`;
    this.statusBarItem.tooltip = message || 'G-Rump AI - Working...';
    this.statusBarItem.backgroundColor = undefined;
  }

  setError(): void {
    this.stopSpinner();
    this.statusBarItem.text = '$(error) G-Rump';
    this.statusBarItem.tooltip = 'G-Rump AI - Error (click to reconnect)';
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    this.statusBarItem.command = 'grump.connectToBackend';
  }

  private stopSpinner(): void {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }
  }

  dispose(): void {
    this.stopSpinner();
    this.statusBarItem.dispose();
  }
}
