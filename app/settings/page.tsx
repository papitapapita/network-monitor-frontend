'use client';

import React from 'react';
import { useSettings } from '@/contexts/settings.context';

export default function SettingsPage() {
  const { theme, setTheme } = useSettings();

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Configuración</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Preferencias de la aplicación</p>
      </div>

      {/* Apariencia */}
      <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Apariencia</h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Selecciona el tema de la interfaz
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setTheme('light')}
              className={`
                rounded-lg border-2 p-3 text-left transition-all
                ${theme === 'light'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}
              `}
            >
              <div className="w-full h-16 bg-white border border-gray-200 rounded-md mb-2 flex flex-col gap-1 p-2">
                <div className="h-2 bg-gray-200 rounded w-3/4" />
                <div className="h-2 bg-gray-100 rounded w-1/2" />
                <div className="h-2 bg-blue-200 rounded w-2/3" />
              </div>
              <p className={`text-xs font-medium ${
                theme === 'light' ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400'
              }`}>
                Claro
              </p>
            </button>

            <button
              onClick={() => setTheme('dark')}
              className={`
                rounded-lg border-2 p-3 text-left transition-all
                ${theme === 'dark'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}
              `}
            >
              <div className="w-full h-16 bg-gray-900 border border-gray-700 rounded-md mb-2 flex flex-col gap-1 p-2">
                <div className="h-2 bg-gray-700 rounded w-3/4" />
                <div className="h-2 bg-gray-800 rounded w-1/2" />
                <div className="h-2 bg-blue-800 rounded w-2/3" />
              </div>
              <p className={`text-xs font-medium ${
                theme === 'dark' ? 'text-blue-400' : 'text-gray-600 dark:text-gray-400'
              }`}>
                Oscuro
              </p>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
