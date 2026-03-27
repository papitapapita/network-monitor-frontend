/**
 * Device Updates React Hook
 *
 * Specialized hook for subscribing to device-specific WebSocket events
 */

import { useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import {
  WebSocketMessageType,
  DeviceStatusChangedPayload,
  DeviceLifecyclePayload
} from '../types/device.types';

interface DeviceUpdateHandlers {
  onStatusChanged?: (payload: DeviceStatusChangedPayload) => void;
  onDeviceCreated?: (payload: DeviceLifecyclePayload) => void;
  onDeviceUpdated?: (payload: DeviceLifecyclePayload) => void;
  onDeviceDeleted?: (payload: DeviceLifecyclePayload) => void;
  onDeviceActivated?: (payload: DeviceLifecyclePayload) => void;
  onDeviceRestored?: (payload: DeviceLifecyclePayload) => void;
}

/**
 * Hook for subscribing to device update events
 *
 * @example
 * useDeviceUpdates({
 *   onStatusChanged: (payload) => {
 *     console.log(`Device ${payload.deviceId} changed from ${payload.previousStatus} to ${payload.newStatus}`);
 *   },
 *   onDeviceCreated: (payload) => {
 *     console.log(`New device created: ${payload.deviceName}`);
 *     refetchDevices();
 *   }
 * });
 */
export function useDeviceUpdates(handlers: DeviceUpdateHandlers): void {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Subscribe to status changes
    if (handlers.onStatusChanged) {
      const unsubscribe = subscribe<DeviceStatusChangedPayload>(
        WebSocketMessageType.DEVICE_STATUS_CHANGED,
        handlers.onStatusChanged
      );
      unsubscribers.push(unsubscribe);
    }

    // Subscribe to device created
    if (handlers.onDeviceCreated) {
      const unsubscribe = subscribe<DeviceLifecyclePayload>(
        WebSocketMessageType.DEVICE_CREATED,
        handlers.onDeviceCreated
      );
      unsubscribers.push(unsubscribe);
    }

    // Subscribe to device updated
    if (handlers.onDeviceUpdated) {
      const unsubscribe = subscribe<DeviceLifecyclePayload>(
        WebSocketMessageType.DEVICE_UPDATED,
        handlers.onDeviceUpdated
      );
      unsubscribers.push(unsubscribe);
    }

    // Subscribe to device deleted
    if (handlers.onDeviceDeleted) {
      const unsubscribe = subscribe<DeviceLifecyclePayload>(
        WebSocketMessageType.DEVICE_DELETED,
        handlers.onDeviceDeleted
      );
      unsubscribers.push(unsubscribe);
    }

    // Subscribe to device activated
    if (handlers.onDeviceActivated) {
      const unsubscribe = subscribe<DeviceLifecyclePayload>(
        WebSocketMessageType.DEVICE_ACTIVATED,
        handlers.onDeviceActivated
      );
      unsubscribers.push(unsubscribe);
    }

    // Subscribe to device restored
    if (handlers.onDeviceRestored) {
      const unsubscribe = subscribe<DeviceLifecyclePayload>(
        WebSocketMessageType.DEVICE_RESTORED,
        handlers.onDeviceRestored
      );
      unsubscribers.push(unsubscribe);
    }

    // Cleanup all subscriptions
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [
    subscribe,
    handlers.onStatusChanged,
    handlers.onDeviceCreated,
    handlers.onDeviceUpdated,
    handlers.onDeviceDeleted,
    handlers.onDeviceActivated,
    handlers.onDeviceRestored
  ]);
}
