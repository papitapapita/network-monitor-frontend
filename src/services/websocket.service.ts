/**
 * WebSocket Service
 *
 * Manages WebSocket connections for real-time device updates
 */

import { WebSocketMessage, WebSocketMessageType } from '../types/device.types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000';

type MessageHandler<T = any> = (payload: T) => void;

export enum ConnectionState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR'
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private messageHandlers: Map<WebSocketMessageType, Set<MessageHandler>> = new Map();
  private connectionStateHandlers: Set<(state: ConnectionState) => void> = new Set();
  private currentState: ConnectionState = ConnectionState.DISCONNECTED;

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected');
      return;
    }

    this.setConnectionState(ConnectionState.CONNECTING);

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.setConnectionState(ConnectionState.CONNECTED);
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.setConnectionState(ConnectionState.ERROR);
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.setConnectionState(ConnectionState.DISCONNECTED);
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      this.setConnectionState(ConnectionState.ERROR);
      this.attemptReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
      this.ws.close();
      this.ws = null;
      this.setConnectionState(ConnectionState.DISCONNECTED);
    }
  }

  /**
   * Subscribe to specific message type
   */
  subscribe<T = any>(
    messageType: WebSocketMessageType,
    handler: MessageHandler<T>
  ): () => void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, new Set());
    }

    this.messageHandlers.get(messageType)!.add(handler as MessageHandler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(messageType);
      if (handlers) {
        handlers.delete(handler as MessageHandler);
      }
    };
  }

  /**
   * Subscribe to connection state changes
   */
  onConnectionStateChange(handler: (state: ConnectionState) => void): () => void {
    this.connectionStateHandlers.add(handler);

    // Immediately call with current state
    handler(this.currentState);

    // Return unsubscribe function
    return () => {
      this.connectionStateHandlers.delete(handler);
    };
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.currentState;
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(message: WebSocketMessage): void {
    console.log('[WebSocket] Received message:', message.type);

    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(message.payload);
        } catch (error) {
          console.error(`[WebSocket] Handler error for ${message.type}:`, error);
        }
      });
    }
  }

  /**
   * Set connection state and notify handlers
   */
  private setConnectionState(state: ConnectionState): void {
    this.currentState = state;
    this.connectionStateHandlers.forEach((handler) => {
      try {
        handler(state);
      } catch (error) {
        console.error('[WebSocket] State handler error:', error);
      }
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WebSocket] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Send message to WebSocket server
   */
  send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send message: not connected');
    }
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
export default webSocketService;
