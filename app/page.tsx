'use client';

import { useRouter } from 'next/navigation';
import { Button, Card } from '@/components/ui';

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Network Monitor
        </h1>
        <p className="text-xl text-gray-600 mb-12">
          Manage and monitor your network infrastructure
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/devices')}>
            <Card>
              <div className="flex flex-col items-center text-center p-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
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
          </div>

          <div className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/locations')}>
            <Card>
              <div className="flex flex-col items-center text-center p-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">Locations</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Manage infrastructure sites and physical locations
                </p>
                <Button size="sm" fullWidth variant="outline">
                  Manage Locations
                </Button>
              </div>
            </Card>
          </div>

          <div className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/device-models')}>
            <Card>
              <div className="flex flex-col items-center text-center p-6">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">Device Models</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Browse the hardware catalog
                </p>
                <Button size="sm" fullWidth variant="outline">
                  Browse Models
                </Button>
              </div>
            </Card>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button onClick={() => router.push('/devices/create')}>
              Add Device
            </Button>
            <Button variant="outline" onClick={() => router.push('/locations/create')}>
              Add Location
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
