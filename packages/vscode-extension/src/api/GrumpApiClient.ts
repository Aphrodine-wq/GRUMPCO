import axios, { AxiosInstance } from 'axios';
import * as vscode from 'vscode';
import WebSocket from 'ws';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface ShipSession {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  phase: string;
  spec?: object;
  plan?: object;
  architecture?: object;
}

export interface GenerationResult {
  success: boolean;
  content: string;
  error?: string;
}

export class GrumpApiClient {
  private client: AxiosInstance;
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private backendUrl: string;
  private apiKey: string;
  private eventEmitter: vscode.EventEmitter<any> = new vscode.EventEmitter();
  
  public onMessage = this.eventEmitter.event;

  constructor(backendUrl: string, apiKey: string) {
    this.backendUrl = backendUrl;
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: backendUrl,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
    });
  }

  updateConfig(backendUrl: string, apiKey: string): void {
    this.backendUrl = backendUrl;
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: backendUrl,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
    });
    
    // Reconnect WebSocket if connected
    if (this.connected) {
      this.disconnect();
      this.connect();
    }
  }

  async connect(): Promise<boolean> {
    try {
      // Health check
      const response = await this.client.get('/health/quick');
      if (response.status === 200) {
        this.connected = true;
        this.setupWebSocket();
        return true;
      }
    } catch (error) {
      console.error('Failed to connect to G-Rump backend:', error);
      this.connected = false;
    }
    return false;
  }

  private setupWebSocket(): void {
    const wsUrl = this.backendUrl.replace('http', 'ws') + '/api/events/ws';
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        console.log('WebSocket connected to G-Rump');
      });
      
      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.eventEmitter.fire(message);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      });
      
      this.ws.on('close', () => {
        console.log('WebSocket disconnected');
        this.ws = null;
      });
      
      this.ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
      });
    } catch (error) {
      console.error('Failed to setup WebSocket:', error);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Chat API
  async sendMessage(message: string, sessionId?: string): Promise<AsyncGenerator<string>> {
    const response = await this.client.post('/api/chat/stream', {
      message,
      sessionId,
      stream: true,
    }, {
      responseType: 'stream',
    });
    
    return this.streamResponse(response.data);
  }

  private async *streamResponse(stream: any): AsyncGenerator<string> {
    for await (const chunk of stream) {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              yield parsed.content;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  // SHIP Workflow
  async startShip(description: string): Promise<ShipSession> {
    const response = await this.client.post('/api/ship/start', { description });
    return response.data;
  }

  async getShipStatus(sessionId: string): Promise<ShipSession> {
    const response = await this.client.get(`/api/ship/${sessionId}/status`);
    return response.data;
  }

  async executeShip(sessionId: string): Promise<void> {
    await this.client.post(`/api/ship/${sessionId}/execute`);
  }

  // Architecture
  async generateArchitecture(description: string): Promise<GenerationResult> {
    try {
      const response = await this.client.post('/api/architecture/generate', {
        description,
        outputFormat: 'mermaid',
      });
      return { success: true, content: response.data.diagram || response.data.mermaid };
    } catch (error: any) {
      return { success: false, content: '', error: error.message };
    }
  }

  // PRD
  async generatePrd(description: string): Promise<GenerationResult> {
    try {
      const response = await this.client.post('/api/prd/generate', { description });
      return { success: true, content: response.data.prd || response.data.content };
    } catch (error: any) {
      return { success: false, content: '', error: error.message };
    }
  }

  // Code Generation
  async generateCode(architecture: string, options?: { framework?: string; language?: string }): Promise<GenerationResult> {
    try {
      const response = await this.client.post('/api/codegen/generate', {
        architecture,
        ...options,
      });
      return { success: true, content: response.data.code || JSON.stringify(response.data.files, null, 2) };
    } catch (error: any) {
      return { success: false, content: '', error: error.message };
    }
  }

  // Code Explanation
  async explainCode(code: string, language: string): Promise<GenerationResult> {
    try {
      const response = await this.client.post('/api/chat', {
        message: `Explain this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``,
      });
      return { success: true, content: response.data.response || response.data.content };
    } catch (error: any) {
      return { success: false, content: '', error: error.message };
    }
  }

  // Code Refactoring
  async refactorCode(code: string, language: string, instructions?: string): Promise<GenerationResult> {
    try {
      const response = await this.client.post('/api/chat', {
        message: `Refactor this ${language} code${instructions ? ` with these instructions: ${instructions}` : ''}:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nReturn only the refactored code.`,
      });
      return { success: true, content: response.data.response || response.data.content };
    } catch (error: any) {
      return { success: false, content: '', error: error.message };
    }
  }

  // Test Generation
  async generateTests(code: string, language: string, framework?: string): Promise<GenerationResult> {
    try {
      const response = await this.client.post('/api/chat', {
        message: `Generate unit tests for this ${language} code${framework ? ` using ${framework}` : ''}:\n\n\`\`\`${language}\n${code}\n\`\`\``,
      });
      return { success: true, content: response.data.response || response.data.content };
    } catch (error: any) {
      return { success: false, content: '', error: error.message };
    }
  }

  // Documentation Generation
  async generateDocs(code: string, language: string): Promise<GenerationResult> {
    try {
      const response = await this.client.post('/api/chat', {
        message: `Generate documentation for this ${language} code. Include JSDoc/docstrings and a README section:\n\n\`\`\`${language}\n${code}\n\`\`\``,
      });
      return { success: true, content: response.data.response || response.data.content };
    } catch (error: any) {
      return { success: false, content: '', error: error.message };
    }
  }

  // Sessions
  async getSessions(): Promise<any[]> {
    try {
      const response = await this.client.get('/api/sessions');
      return response.data.sessions || [];
    } catch (error) {
      return [];
    }
  }

  async getSession(id: string): Promise<any> {
    const response = await this.client.get(`/api/sessions/${id}`);
    return response.data;
  }
}
