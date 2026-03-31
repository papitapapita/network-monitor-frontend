'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Header() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname.startsWith(path);

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
                Network Monitor
              </span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/devices"
                className={`text-sm font-medium transition-colors ${
                  isActive('/devices') ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Devices
              </Link>
              <Link
                href="/locations"
                className={`text-sm font-medium transition-colors ${
                  isActive('/locations') ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Locations
              </Link>
              <Link
                href="/device-models"
                className={`text-sm font-medium transition-colors ${
                  isActive('/device-models') ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Device Models
              </Link>
            </nav>
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
    </header>
  );
}
