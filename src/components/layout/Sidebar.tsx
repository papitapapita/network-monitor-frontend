'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NavItem } from '../ui/NavItem';
import { useAuth } from '@/contexts/auth.context';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  OPERATOR: 'Operador',
  VIEWER: 'Lector',
};

const icon = (d: string | string[]) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    {(Array.isArray(d) ? d : [d]).map((path) => (
      <path key={path} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    ))}
  </svg>
);

const DEVICE_ICON =
  'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z';

const NAV_ITEMS: { href: string; label: string; icon: React.ReactNode }[] = [
  {
    href: '/',
    label: 'Panel',
    icon: icon(
      'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
    ),
  },
  { href: '/devices', label: 'Dispositivos', icon: icon(DEVICE_ICON) },
  {
    href: '/locations',
    label: 'Ubicaciones',
    icon: icon([
      'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
      'M15 11a3 3 0 11-6 0 3 3 0 016 0z',
    ]),
  },
  {
    href: '/map',
    label: 'Mapa',
    icon: icon(
      'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7'
    ),
  },
  // Live throughput sits with the monitoring views, ahead of the alerts it is
  // the leading indicator for.
  {
    href: '/wireless',
    label: 'Tráfico en vivo',
    icon: icon('M13 10V3L4 14h7v7l9-11h-7z'),
  },
  {
    href: '/alerts',
    label: 'Alertas',
    icon: icon(
      'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
    ),
  },
  // Work orders sit next to the alerts they are opened from, and the day sheet
  // next to the tickets it draws on.
  {
    href: '/tickets',
    label: 'Tickets',
    icon: icon(
      'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z'
    ),
  },
  {
    href: '/jornada',
    label: 'Jornada',
    icon: icon(
      'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
    ),
  },
  {
    href: '/device-models',
    label: 'Modelos',
    icon: icon(
      'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4'
    ),
  },
  {
    href: '/vendors',
    label: 'Fabricantes',
    icon: icon(
      'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
    ),
  },
  {
    href: '/customers',
    label: 'Clientes',
    icon: icon(
      'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'
    ),
  },
  {
    href: '/technicians',
    label: 'Técnicos',
    icon: icon(
      'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
    ),
  },
  {
    href: '/service-plans',
    label: 'Planes',
    icon: icon(
      'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
    ),
  },
  {
    href: '/bills',
    label: 'Facturas',
    icon: icon(
      'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z'
    ),
  },
  {
    href: '/network-scan',
    label: 'Escaneo',
    icon: icon('M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z'),
  },
];

const SETTINGS_ICON = icon([
  'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
]);

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  /** Desktop icon-only mode. Hovering the rail temporarily expands it. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function Sidebar({ isOpen = false, onClose, collapsed = false, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [hovered, setHovered] = useState(false);

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  // Only ever collapsed on desktop; the mobile drawer is always full width.
  const isRail = collapsed && !hovered;

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <aside
      onMouseEnter={() => collapsed && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={[
        'fixed inset-y-0 left-0 z-30 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700',
        'flex flex-col shrink-0 overflow-hidden transition-[transform,width] duration-200',
        // On mobile: full-width drawer that slides in/out. On desktop: fixed to the left edge.
        'w-56 md:fixed md:translate-x-0',
        collapsed ? (hovered ? 'md:w-56 md:shadow-xl' : 'md:w-16') : 'md:w-56',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
    >
      {/* Brand */}
      <div className="h-16 flex items-center gap-2 px-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <Link href="/" className="flex items-center gap-2 min-w-0" onClick={onClose}>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={DEVICE_ICON} />
            </svg>
          </div>
          <span
            className={`text-base font-bold text-gray-900 dark:text-gray-100 leading-tight whitespace-nowrap ${
              isRail ? 'md:sr-only' : ''
            }`}
          >
            Network<br />Monitor
          </span>
        </Link>

        {/* Collapse toggle — desktop only; in rail mode it appears on hover */}
        {onToggleCollapsed && !isRail && (
          <button
            onClick={onToggleCollapsed}
            className="hidden md:flex ml-auto p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label={collapsed ? 'Fijar menú expandido' : 'Contraer menú'}
            title={collapsed ? 'Fijar menú expandido' : 'Contraer menú'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={collapsed ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7m8 14l-7-7 7-7'}
              />
            </svg>
          </button>
        )}
      </div>

      {/* Main nav — scrolls if items overflow */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            active={isActive(item.href)}
            onClick={onClose}
            collapsed={isRail}
            icon={item.icon}
            label={item.label}
          />
        ))}
      </nav>

      {/* Bottom: settings + user */}
      <div className="shrink-0 px-2 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-0.5">
        <NavItem
          href="/settings"
          active={isActive('/settings')}
          onClick={onClose}
          collapsed={isRail}
          icon={SETTINGS_ICON}
          label="Configuración"
        />

        {/* User info + logout */}
        {user && (
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className={`px-3 py-2 ${isRail ? 'md:hidden' : ''}`}>
              <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{user.email}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{ROLE_LABELS[user.role] ?? user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              title={isRail ? 'Cerrar sesión' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors ${
                isRail ? 'md:justify-center md:px-0' : ''
              }`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className={isRail ? 'md:sr-only' : 'whitespace-nowrap'}>Cerrar sesión</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
