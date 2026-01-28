/**
 * G-Rump VS Code Extension
 * Commands: "G-Rump: New from description", "G-Rump: Open chat"
 * Chat view uses /api/chat/stream; settings: grump.apiUrl, grump.apiKey
 */

import * as vscode from 'vscode';

let chatViewProvider: ChatViewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
  const config = () => vscode.workspace.getConfiguration('grump');
  const apiUrl = () => (config().get<string>('apiUrl') || 'http://localhost:3000').replace(/\/$/, '');
  const apiKey = () => config().get<string>('apiKey') || '';

  context.subscriptions.push(
    vscode.commands.registerCommand('grump.newFromDescription', async () => {
      const description = await vscode.window.showInputBox({
        prompt: 'Describe the app or feature',
        placeHolder: 'e.g. A todo app with auth and React frontend',
      });
      if (!description) return;
      const session = await startShipFromDescription(apiUrl(), apiKey(), description);
      if (session?.sessionId) {
        vscode.window.showInformationMessage(`G-Rump SHIP started: ${session.sessionId}`);
      } else {
        vscode.window.showErrorMessage('Failed to start G-Rump SHIP. Check API URL and key.');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grump.openChat', () => {
      vscode.commands.executeCommand('grump.chatView.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grump.statusBarOpenChat', () => {
      vscode.commands.executeCommand('grump.chatView.focus');
    })
  );

  chatViewProvider = new ChatViewProvider(context.extensionUri, apiUrl, apiKey);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('grump.chatView', chatViewProvider)
  );
}

export function deactivate() {
  chatViewProvider = undefined;
}

async function startShipFromDescription(
  baseUrl: string,
  _apiKey: string,
  projectDescription: string
): Promise<{ sessionId: string } | null> {
  try {
    const res = await fetch(`${baseUrl}/api/ship/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectDescription }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { sessionId: string };
  } catch {
    return null;
  }
}

class ChatViewProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly getApiUrl: () => string,
    private readonly getApiKey: () => string
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this._html(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((msg: { type: string; text?: string }) => {
      if (msg.type === 'send' && msg.text) {
        this.streamChat(msg.text, webviewView.webview);
      }
    });
  }

  private _html(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body>
  <div style="padding:8px;">
    <input id="input" placeholder="Message G-Rump..." style="width:100%;padding:6px;margin-bottom:8px;" />
    <button id="send" style="padding:6px 12px;">Send</button>
  </div>
  <pre id="out" style="white-space:pre-wrap;font-size:12px;padding:8px;max-height:300px;overflow:auto;"></pre>
  <script>
    (function() {
      const vscode = acquireVsCodeApi();
      const input = document.getElementById('input');
      const out = document.getElementById('out');
      window.addEventListener('message', function(ev) {
        const d = ev.data;
        if (d && d.type === 'append' && d.text) { out.textContent += d.text; out.scrollTop = 1e9; }
        if (d && d.type === 'clear') out.textContent = '';
      });
      document.getElementById('send').onclick = function() {
        const t = input.value.trim();
        if (t) { vscode.postMessage({ type: 'send', text: t }); input.value = ''; }
      };
      input.onkeydown = function(e) { if (e.key === 'Enter') document.getElementById('send').click(); };
    })();
  </script>
</body></html>`;
  }

  private async streamChat(text: string, webview: vscode.Webview) {
    const base = this.getApiUrl();
    webview.postMessage({ type: 'clear' });
    try {
      const res = await fetch(`${base}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: text }] }),
      });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const j = JSON.parse(line.slice(6));
              if (j.type === 'text' && j.text) webview.postMessage({ type: 'append', text: j.text });
            } catch (_) {}
          }
        }
      }
    } catch (e) {
      webview.postMessage({ type: 'append', text: `Error: ${(e as Error).message}` });
    }
  }
}
