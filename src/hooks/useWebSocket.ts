/**
 * WebSocket React Hook
 *
 * Provides WebSocket connection management for React components
 */

import { useEffect, useState } from 'react';
import { webSocketService, ConnectionState } from '../services/websocket.service';
import { WebSocketMessageType } from '../types/device.types';

type MessageHandler<T = any> = (payload: T) => void;

interface UseWebSocketOptions {
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  connectionState: ConnectionState;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  subscribe: <T = any>(
    messageType: WebSocketMessageType,
    handler: MessageHandler<T>
  ) => void;
}

/**
 * Hook for managing WebSocket connection
 *
 * @example
 * const { isConnected, connectionState, subscribe } = useWebSocket();
 *
 * useEffect(() => {
 *   const unsubscribe = subscribe(
 *     WebSocketMessageType.DEVICE_STATUS_CHANGED,
 *     (payload) => console.log('Status changed:', payload)
 *   );
 *   return unsubscribe;
 * }, [subscribe]);
 */
export function useWebSocket(
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const { autoConnect = true } = options;
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    webSocketService.getConnectionState()
  );

  useEffect(() => {
    // Subscribe to connection state changes
    const unsubscribe = webSocketService.onConnectionStateChange(
      setConnectionState
    );

    // Auto-connect if enabled
    if (autoConnect) {
      webSocketService.connect();
    }

    // Cleanup on unmount
    return () => {
      unsubscribe();
      if (autoConnect) {
        webSocketService.disconnect();
      }
    };
  }, [autoConnect]);

  const subscribe = <T = any>(
    messageType: WebSocketMessageType,
    handler: MessageHandler<T>
  ) => {
    return webSocketService.subscribe(messageType, handler);
  };

  return {
    connectionState,
    isConnected: connectionState === ConnectionState.CONNECTED,
    connect: () => webSocketService.connect(),
    disconnect: () => webSocketService.disconnect(),
    subscribe
  };
}
