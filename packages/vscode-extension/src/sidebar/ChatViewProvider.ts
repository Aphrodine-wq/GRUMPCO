import * as vscode from 'vscode';
import { GrumpApiClient } from '../api/GrumpApiClient';

export class GrumpChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'grump.chatView';
  private _view?: vscode.WebviewView;
  private _messages: Array<{ role: string; content: string }> = [];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _apiClient: GrumpApiClient
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'sendMessage':
          await this._handleSendMessage(data.message);
          break;
        case 'clearChat':
          this._messages = [];
          this._updateMessages();
          break;
      }
    });

    // Listen for API events
    this._apiClient.onMessage((event) => {
      if (event.type === 'chat_response') {
        this._appendToLastMessage(event.content);
      }
    });
  }

  private async _handleSendMessage(message: string) {
    // Add user message
    this._messages.push({ role: 'user', content: message });
    this._updateMessages();

    // Add placeholder for assistant
    this._messages.push({ role: 'assistant', content: '' });
    this._updateMessages();

    try {
      // Stream response
      const stream = await this._apiClient.sendMessage(message);
      for await (const chunk of stream) {
        this._appendToLastMessage(chunk);
      }
    } catch (error: any) {
      this._messages[this._messages.length - 1].content = 
        `Error: ${error.message || 'Failed to get response'}`;
      this._updateMessages();
    }
  }

  private _appendToLastMessage(content: string) {
    if (this._messages.length > 0) {
      this._messages[this._messages.length - 1].content += content;
      this._updateMessages();
    }
  }

  private _updateMessages() {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'updateMessages',
        messages: this._messages,
      });
    }
  }

  public addMessage(role: string, content: string) {
    this._messages.push({ role, content });
    this._updateMessages();
  }

  public showPanel() {
    if (this._view) {
      this._view.show(true);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>G-Rump Chat</title>
    <style>
        :root {
            --bg-primary: var(--vscode-editor-background);
            --bg-secondary: var(--vscode-sideBar-background);
            --text-primary: var(--vscode-editor-foreground);
            --text-secondary: var(--vscode-descriptionForeground);
            --accent: var(--vscode-button-background);
            --accent-hover: var(--vscode-button-hoverBackground);
            --border: var(--vscode-panel-border);
            --input-bg: var(--vscode-input-background);
            --input-border: var(--vscode-input-border);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--text-primary);
            background: var(--bg-primary);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .header {
            padding: 12px 16px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .header-title {
            font-weight: 600;
            font-size: 14px;
        }

        .header-status {
            font-size: 11px;
            color: var(--text-secondary);
            margin-left: auto;
        }

        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .message {
            max-width: 90%;
            padding: 10px 14px;
            border-radius: 12px;
            line-height: 1.5;
            font-size: 13px;
        }

        .message.user {
            align-self: flex-end;
            background: var(--accent);
            color: var(--vscode-button-foreground);
            border-bottom-right-radius: 4px;
        }

        .message.assistant {
            align-self: flex-start;
            background: var(--bg-secondary);
            border-bottom-left-radius: 4px;
        }

        .message pre {
            background: rgba(0, 0, 0, 0.2);
            padding: 8px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 8px 0;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
        }

        .message code {
            font-family: var(--vscode-editor-font-family);
            background: rgba(0, 0, 0, 0.15);
            padding: 2px 4px;
            border-radius: 3px;
            font-size: 12px;
        }

        .input-container {
            padding: 12px 16px;
            border-top: 1px solid var(--border);
            display: flex;
            gap: 8px;
        }

        .input-container textarea {
            flex: 1;
            background: var(--input-bg);
            border: 1px solid var(--input-border);
            border-radius: 8px;
            padding: 10px 12px;
            color: var(--text-primary);
            font-family: var(--vscode-font-family);
            font-size: 13px;
            resize: none;
            min-height: 40px;
            max-height: 120px;
        }

        .input-container textarea:focus {
            outline: 1px solid var(--accent);
            border-color: var(--accent);
        }

        .input-container button {
            background: var(--accent);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 8px;
            padding: 10px 16px;
            cursor: pointer;
            font-weight: 500;
            font-size: 13px;
            transition: background 0.15s;
        }

        .input-container button:hover {
            background: var(--accent-hover);
        }

        .input-container button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .empty-state {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--text-secondary);
            text-align: center;
            padding: 32px;
        }

        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }

        .empty-state-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .empty-state-subtitle {
            font-size: 13px;
            line-height: 1.5;
        }

        .typing-indicator {
            display: inline-flex;
            gap: 4px;
            padding: 4px 0;
        }

        .typing-indicator span {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--text-secondary);
            animation: bounce 1.4s ease-in-out infinite;
        }

        .typing-indicator span:nth-child(2) {
            animation-delay: 0.2s;
        }

        .typing-indicator span:nth-child(3) {
            animation-delay: 0.4s;
        }

        @keyframes bounce {
            0%, 60%, 100% {
                transform: translateY(0);
            }
            30% {
                transform: translateY(-4px);
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <span class="header-title">G-Rump AI</span>
        <span class="header-status" id="status">Ready</span>
    </div>

    <div class="messages" id="messages">
        <div class="empty-state" id="emptyState">
            <div class="empty-state-icon">&#129302;</div>
            <div class="empty-state-title">Welcome to G-Rump AI</div>
            <div class="empty-state-subtitle">
                Ask me anything about your code, or start a SHIP workflow to generate architecture, PRDs, and code.
            </div>
        </div>
    </div>

    <div class="input-container">
        <textarea 
            id="input" 
            placeholder="Ask G-Rump anything..."
            rows="1"
        ></textarea>
        <button id="send">Send</button>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const messagesContainer = document.getElementById('messages');
        const emptyState = document.getElementById('emptyState');
        const input = document.getElementById('input');
        const sendButton = document.getElementById('send');
        const status = document.getElementById('status');

        let messages = [];
        let isLoading = false;

        function renderMessages() {
            if (messages.length === 0) {
                emptyState.style.display = 'flex';
                return;
            }

            emptyState.style.display = 'none';
            
            const html = messages.map((msg, i) => {
                const isTyping = msg.role === 'assistant' && msg.content === '' && i === messages.length - 1;
                const content = isTyping 
                    ? '<div class="typing-indicator"><span></span><span></span><span></span></div>'
                    : escapeHtml(msg.content);
                return '<div class="message ' + msg.role + '">' + formatMessage(content) + '</div>';
            }).join('');
            
            messagesContainer.innerHTML = html;
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function formatMessage(text) {
            // Simple code block formatting
            return text.replace(/\`\`\`(\\w*)?\\n([\\s\\S]*?)\`\`\`/g, '<pre><code>$2</code></pre>')
                       .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
                       .replace(/\\n/g, '<br>');
        }

        function sendMessage() {
            const text = input.value.trim();
            if (!text || isLoading) return;

            vscode.postMessage({ type: 'sendMessage', message: text });
            input.value = '';
            input.style.height = 'auto';
            isLoading = true;
            sendButton.disabled = true;
            status.textContent = 'Thinking...';
        }

        // Event listeners
        sendButton.addEventListener('click', sendMessage);
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });

        // Handle messages from extension
        window.addEventListener('message', (event) => {
            const data = event.data;
            switch (data.type) {
                case 'updateMessages':
                    messages = data.messages;
                    renderMessages();
                    
                    // Check if last message is complete
                    const lastMsg = messages[messages.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content !== '') {
                        isLoading = false;
                        sendButton.disabled = false;
                        status.textContent = 'Ready';
                    }
                    break;
            }
        });
    </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
