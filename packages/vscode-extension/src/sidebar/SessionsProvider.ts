import * as vscode from 'vscode';
import { GrumpApiClient } from '../api/GrumpApiClient';

export class GrumpSessionsProvider implements vscode.TreeDataProvider<SessionItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SessionItem | undefined | null | void> = 
    new vscode.EventEmitter<SessionItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<SessionItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  private sessions: any[] = [];

  constructor(private readonly apiClient: GrumpApiClient) {
    this.refresh();
  }

  refresh(): void {
    this.apiClient.getSessions().then(sessions => {
      this.sessions = sessions;
      this._onDidChangeTreeData.fire();
    });
  }

  getTreeItem(element: SessionItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SessionItem): Thenable<SessionItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    if (this.sessions.length === 0) {
      return Promise.resolve([
        new SessionItem(
          'No sessions',
          'empty',
          vscode.TreeItemCollapsibleState.None,
          undefined
        )
      ]);
    }

    return Promise.resolve(
      this.sessions.map(session => 
        new SessionItem(
          session.title || `Session ${session.id.slice(0, 8)}`,
          session.id,
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'grump.loadSession',
            title: 'Load Session',
            arguments: [session.id]
          }
        )
      )
    );
  }
}

export class SessionItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly sessionId: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    
    this.tooltip = `Session: ${sessionId}`;
    this.contextValue = sessionId === 'empty' ? 'empty' : 'session';
    
    if (sessionId !== 'empty') {
      this.iconPath = new vscode.ThemeIcon('comment-discussion');
    }
  }
}
