/**
 * Hot Reload System
 * WebSocket server for live reload with browser extension support
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { CompilerConfig, HotReloadMessage } from './types.js';

/** Default hot reload port */
const DEFAULT_PORT = 3456;

/** Client connection info */
interface ClientConnection {
  ws: WebSocket;
  id: string;
  userAgent?: string;
  connectedAt: number;
  lastPing: number;
}

/**
 * Hot reload server
 */
export class HotReloadServer {
  private config: CompilerConfig;
  private port: number;
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientConnection> = new Map();
  private isRunning: boolean = false;
  private updateId: number = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(config: CompilerConfig) {
    this.config = config;
    this.port = config.hotReloadPort || DEFAULT_PORT;
  }

  /**
   * Start the hot reload server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Hot reload server already running');
    }

    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      console.error('Hot reload server error:', error);
    });

    // Start heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.checkClientHealth();
    }, 30000);

    this.isRunning = true;

    return new Promise((resolve, reject) => {
      this.wss!.once('listening', resolve);
      this.wss!.once('error', reject);
    });
  }

  /**
   * Stop the hot reload server
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.wss) {
      return;
    }

    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      client.ws.close();
    }
    this.clients.clear();

    // Close server
    return new Promise((resolve) => {
      this.wss!.close(() => {
        this.isRunning = false;
        this.wss = null;
        resolve();
      });
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: import('http').IncomingMessage): void {
    const clientId = this.generateClientId();
    const userAgent = req.headers['user-agent'];

    const client: ClientConnection = {
      ws,
      id: clientId,
      userAgent,
      connectedAt: Date.now(),
      lastPing: Date.now()
    };

    this.clients.set(clientId, client);

    console.log(`Hot reload client connected: ${clientId} (${userAgent || 'unknown'})`);

    // Send connected message
    this.sendToClient(client, {
      type: 'connected',
      timestamp: Date.now()
    });

    // Handle messages from client
    ws.on('message', (data) => {
      this.handleClientMessage(client, data);
    });

    // Handle disconnection
    ws.on('close', () => {
      console.log(`Hot reload client disconnected: ${clientId}`);
      this.clients.delete(clientId);
    });

    ws.on('error', (error) => {
      console.error(`Hot reload client error (${clientId}):`, error);
      this.clients.delete(clientId);
    });
  }

  /**
   * Handle message from client
   */
  private handleClientMessage(client: ClientConnection, data: import('ws').RawData): void {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'ping':
          client.lastPing = Date.now();
          this.sendToClient(client, { type: 'connected', timestamp: Date.now() });
          break;
        
        case 'ready':
          console.log(`Client ${client.id} ready for updates`);
          break;
        
        case 'error':
          console.error(`Client ${client.id} reported error:`, message.error);
          break;
        
        default:
          console.log(`Unknown message from client ${client.id}:`, message.type);
      }
    } catch (error) {
      console.error(`Failed to parse message from client ${client.id}:`, error);
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(client: ClientConnection, message: HotReloadMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: HotReloadMessage): void {
    const messageStr = JSON.stringify(message);
    
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    }
  }

  /**
   * Notify clients of full page reload
   */
  reload(changedFiles?: string[]): void {
    this.updateId++;
    
    this.broadcast({
      type: 'reload',
      updateId: this.updateId.toString(),
      changedFiles,
      timestamp: Date.now()
    });

    console.log(`Hot reload triggered (update #${this.updateId})`);
  }

  /**
   * Notify clients of partial update (HMR)
   */
  update(changedFiles: string[]): void {
    this.updateId++;
    
    this.broadcast({
      type: 'update',
      updateId: this.updateId.toString(),
      changedFiles,
      timestamp: Date.now()
    });

    console.log(`Hot update triggered for ${changedFiles.length} files (update #${this.updateId})`);
  }

  /**
   * Broadcast error to all clients
   */
  broadcastError(error: Error | string): void {
    const errorMessage = error instanceof Error ? error.message : error;
    
    this.broadcast({
      type: 'error',
      error: {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      },
      timestamp: Date.now()
    });

    console.error('Hot reload error broadcasted:', errorMessage);
  }

  /**
   * Check client health and remove stale connections
   */
  private checkClientHealth(): void {
    const now = Date.now();
    const staleThreshold = 60000; // 60 seconds

    for (const [id, client] of this.clients) {
      if (now - client.lastPing > staleThreshold) {
        console.log(`Removing stale client: ${id}`);
        client.ws.close();
        this.clients.delete(id);
      }
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get server status
   */
  getStatus(): {
    isRunning: boolean;
    port: number;
    connectedClients: number;
  } {
    return {
      isRunning: this.isRunning,
      port: this.port,
      connectedClients: this.clients.size
    };
  }

  /**
   * Get client list
   */
  getClients(): Array<{
    id: string;
    userAgent?: string;
    connectedAt: number;
    lastPing: number;
  }> {
    return Array.from(this.clients.values()).map(c => ({
      id: c.id,
      userAgent: c.userAgent,
      connectedAt: c.connectedAt,
      lastPing: c.lastPing
    }));
  }

  /**
   * Generate client-side hot reload script
   */
  generateClientScript(): string {
    return `
(function() {
  'use strict';
  
  const WS_URL = 'ws://localhost:${this.port}';
  let ws = null;
  let reconnectAttempts = 0;
  let reconnectTimeout = null;
  const MAX_RECONNECT_ATTEMPTS = 10;
  const RECONNECT_DELAY = 1000;
  
  function connect() {
    if (ws) return;
    
    try {
      ws = new WebSocket(WS_URL);
      
      ws.onopen = function() {
        console.log('[G-Rump HMR] Connected to hot reload server');
        reconnectAttempts = 0;
        ws.send(JSON.stringify({ type: 'ready' }));
      };
      
      ws.onmessage = function(event) {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (e) {
          console.error('[G-Rump HMR] Failed to parse message:', e);
        }
      };
      
      ws.onclose = function() {
        console.log('[G-Rump HMR] Disconnected from hot reload server');
        ws = null;
        scheduleReconnect();
      };
      
      ws.onerror = function(error) {
        console.error('[G-Rump HMR] WebSocket error:', error);
        ws = null;
      };
    } catch (e) {
      console.error('[G-Rump HMR] Failed to connect:', e);
      scheduleReconnect();
    }
  }
  
  function scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('[G-Rump HMR] Max reconnection attempts reached');
      return;
    }
    
    if (reconnectTimeout) return;
    
    reconnectTimeout = setTimeout(function() {
      reconnectTimeout = null;
      reconnectAttempts++;
      console.log('[G-Rump HMR] Reconnecting... (attempt ' + reconnectAttempts + ')');
      connect();
    }, RECONNECT_DELAY * Math.min(reconnectAttempts + 1, 5));
  }
  
  function handleMessage(message) {
    switch (message.type) {
      case 'connected':
        // Server acknowledged connection
        break;
        
      case 'reload':
        console.log('[G-Rump HMR] Full page reload triggered');
        window.location.reload();
        break;
        
      case 'update':
        console.log('[G-Rump HMR] Partial update:', message.changedFiles);
        // In a real implementation, this would use HMR API
        // For now, we just reload
        window.location.reload();
        break;
        
      case 'error':
        console.error('[G-Rump HMR] Compilation error:', message.error);
        showErrorOverlay(message.error);
        break;
    }
  }
  
  function showErrorOverlay(error) {
    // Remove existing overlay
    const existing = document.getElementById('grump-hmr-error');
    if (existing) existing.remove();
    
    // Create error overlay
    const overlay = document.createElement('div');
    overlay.id = 'grump-hmr-error';
    overlay.innerHTML = '<h3>Compilation Error</h3><pre>' + (error.message || error) + '</pre>';
    overlay.style.cssText = 
      'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);' +
      'color:#ff6b6b;padding:20px;z-index:99999;font-family:monospace;' +
      'overflow:auto;white-space:pre-wrap;';
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'position:fixed;top:20px;right:20px;padding:10px;';
    closeBtn.onclick = function() { overlay.remove(); };
    overlay.appendChild(closeBtn);
    
    document.body.appendChild(overlay);
  }
  
  // Send periodic pings
  setInterval(function() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 30000);
  
  // Start connection
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect);
  } else {
    connect();
  }
})();
`;
  }

  /**
   * Get URL for client script
   */
  getClientScriptUrl(): string {
    return `http://localhost:${this.port}/client.js`;
  }
}

/**
 * Create hot reload server instance
 */
export function createHotReloadServer(config: CompilerConfig): HotReloadServer {
  return new HotReloadServer(config);
}

/**
 * Start hot reload server (convenience function)
 */
export async function startHotReload(config: CompilerConfig): Promise<HotReloadServer> {
  const server = createHotReloadServer(config);
  await server.start();
  return server;
}

/**
 * Generate HTML snippet to include hot reload client
 */
export function generateHotReloadSnippet(port?: number): string {
  const actualPort = port || DEFAULT_PORT;
  return `<script src="http://localhost:${actualPort}/client.js"></script>`;
}
