/**
 * Home Page
 *
 * Landing page with navigation to main features
 */

'use client';

import { useRouter } from 'next/navigation';
import { Button, Card } from '@/components/ui';

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Network Management System
        </h1>
        <p className="text-xl text-gray-600 mb-12">
          Manage and monitor your network infrastructure with ease
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="text-left cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/devices')}>
            <div className="flex flex-col items-center text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-blue-600"
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
              <h3 className="text-lg font-semibold mb-2">Device Management</h3>
              <p className="text-sm text-gray-600 mb-4">
                Create, update, and monitor network devices
              </p>
              <Button size="sm" fullWidth>
                Go to Devices
              </Button>
            </div>
          </Card>

          <Card className="text-left cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/monitoring')}>
            <div className="flex flex-col items-center text-center p-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Real-time Monitoring</h3>
              <p className="text-sm text-gray-600 mb-4">
                Track device status and performance metrics
              </p>
              <Button size="sm" fullWidth variant="outline">
                View Monitoring
              </Button>
            </div>
          </Card>

          <Card className="text-left cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/reports')}>
            <div className="flex flex-col items-center text-center p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Reports & Analytics</h3>
              <p className="text-sm text-gray-600 mb-4">
                Generate insights and performance reports
              </p>
              <Button size="sm" fullWidth variant="outline">
                View Reports
              </Button>
            </div>
          </Card>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Quick Actions</h2>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button onClick={() => router.push('/devices/create')}>
              Create New Device
            </Button>
            <Button variant="outline" onClick={() => router.push('/devices/import')}>
              Import from CSV
            </Button>
            <Button variant="outline" onClick={() => router.push('/devices')}>
              View All Devices
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
