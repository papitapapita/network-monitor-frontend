/**
 * Header Component
 *
 * Main navigation header for the application
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge, getStatusBadgeVariant } from '../ui';
import { ConnectionState } from '@/services/websocket.service';
import { useWebSocket } from '@/hooks/useWebSocket';

export function Header() {
  const pathname = usePathname();
  const { connectionState, isConnected } = useWebSocket({ autoConnect: true });

  const isActive = (path: string) => pathname.startsWith(path);

  const getConnectionBadge = () => {
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return <Badge variant="success">Connected</Badge>;
      case ConnectionState.CONNECTING:
        return <Badge variant="info">Connecting...</Badge>;
      case ConnectionState.DISCONNECTED:
        return <Badge variant="neutral">Disconnected</Badge>;
      case ConnectionState.ERROR:
        return <Badge variant="danger">Error</Badge>;
      default:
        return null;
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                  />
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900">
                Network Manager
              </span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/devices"
                className={`
                  text-sm font-medium transition-colors
                  ${
                    isActive('/devices')
                      ? 'text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                Devices
              </Link>
              <Link
                href="/monitoring"
                className={`
                  text-sm font-medium transition-colors
                  ${
                    isActive('/monitoring')
                      ? 'text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                Monitoring
              </Link>
              <Link
                href="/reports"
                className={`
                  text-sm font-medium transition-colors
                  ${
                    isActive('/reports')
                      ? 'text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                Reports
              </Link>
            </nav>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {/* WebSocket Status */}
            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs text-gray-500">Status:</span>
              {getConnectionBadge()}
            </div>

            {/* User Menu (Placeholder) */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
