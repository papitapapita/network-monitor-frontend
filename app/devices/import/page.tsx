/**
 * CSV Bulk Import Page
 *
 * Import multiple network devices from CSV file
 */

'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { BulkImportResponseDTO } from '@/types/device.types';
import {
  Card,
  Button,
  LoadingSpinner,
  Badge
} from '@/components/ui';

export default function BulkImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activateImmediately, setActivateImmediately] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkImportResponseDTO | null>(null);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        setError('File size exceeds 10MB limit');
        return;
      }

      setSelectedFile(file);
      setError(null);
      setResult(null);
    }
  };

  // Handle file upload
  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a CSV file');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const response = await apiService.bulkImportDevices(
        selectedFile,
        activateImmediately
      );

      if (response.success && response.data) {
        setResult(response.data);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setError(response.error || 'Failed to import devices');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsUploading(false);
    }
  };

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      await apiService.downloadCSVTemplate();
    } catch (err) {
      setError('Failed to download template');
    }
  };

  // Clear file
  const handleClearFile = () => {
    setSelectedFile(null);
    setError(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            ← Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Bulk Import Devices</h1>
        </div>
        <p className="text-gray-600">
          Import multiple network devices from a CSV file
        </p>
      </div>

      {/* Instructions */}
      <Card className="mb-6">
        <Card.Header>
          <h2 className="text-lg font-semibold">Import Instructions</h2>
        </Card.Header>
        <Card.Body>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">CSV Format Requirements</h3>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li>File must be in CSV format (.csv extension)</li>
                <li>Maximum file size: 10MB</li>
                <li>Maximum 1000 devices per import</li>
                <li>Required columns: ipAddress, macAddress, deviceId</li>
                <li>
                  Optional columns for ACTIVE mode: name, deviceType, description,
                  location, connectivityType, managementProtocol, managementPort,
                  enabledRemoteAccess
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">Validation Rules</h3>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li>IP addresses must be unique and in valid IPv4/IPv6 format</li>
                <li>MAC addresses must be unique and in valid format (AA:BB:CC:DD:EE:FF)</li>
                <li>Device IDs must be unique</li>
                <li>CSV injection prevention: Leading =, +, -, @ characters are stripped</li>
                <li>Duplicate devices (same IP or MAC) will be rejected</li>
              </ul>
            </div>

            <div>
              <Button variant="outline" onClick={handleDownloadTemplate}>
                Download CSV Template
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Import Mode Selection */}
      <Card className="mb-6">
        <Card.Header>
          <h2 className="text-lg font-semibold">Import Mode</h2>
        </Card.Header>
        <Card.Body>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setActivateImmediately(false)}
              className={`
                p-4 border-2 rounded-lg text-left transition-all
                ${
                  !activateImmediately
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="font-semibold text-lg mb-1">Draft Mode</div>
              <p className="text-sm text-gray-600">
                Import devices as DRAFT. They can be activated later individually.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setActivateImmediately(true)}
              className={`
                p-4 border-2 rounded-lg text-left transition-all
                ${
                  activateImmediately
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="font-semibold text-lg mb-1">Active Mode</div>
              <p className="text-sm text-gray-600">
                Import and activate devices immediately. Requires all fields in CSV.
              </p>
            </button>
          </div>
          {activateImmediately && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Active mode requires name and deviceType columns
                in your CSV file. Devices missing these fields will fail validation.
              </p>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* File Upload */}
      <Card className="mb-6">
        <Card.Header>
          <h2 className="text-lg font-semibold">Upload CSV File</h2>
        </Card.Header>
        <Card.Body>
          <div className="space-y-4">
            {/* File Input */}
            <div>
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg
                    className="w-10 h-10 mb-3 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">CSV file (max 10MB)</p>
                </div>
                <input
                  id="file-upload"
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".csv"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                />
              </label>
            </div>

            {/* Selected File */}
            {selectedFile && (
              <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3">
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-600">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFile}
                  disabled={isUploading}
                >
                  Remove
                </Button>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {/* Upload Button */}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={handleClearFile}
                disabled={!selectedFile || isUploading}
              >
                Clear
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                isLoading={isUploading}
                variant={activateImmediately ? 'success' : 'primary'}
              >
                {activateImmediately ? 'Import and Activate' : 'Import as Draft'}
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Import Results */}
      {result && (
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Import Results</h2>
              <Badge variant={result.failed > 0 ? 'warning' : 'success'}>
                {result.success ? 'Completed' : 'Completed with Errors'}
              </Badge>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{result.total}</div>
                  <div className="text-sm text-gray-600">Total</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {result.created}
                  </div>
                  <div className="text-sm text-gray-600">Created</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{result.failed}</div>
                  <div className="text-sm text-gray-600">Failed</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {result.duration}ms
                  </div>
                  <div className="text-sm text-gray-600">Duration</div>
                </div>
              </div>

              {/* Validation Errors */}
              {result.validationErrors && result.validationErrors.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">
                    Validation Errors ({result.validationErrors.length})
                  </h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-red-200">
                          <th className="text-left py-2 pr-4">Row</th>
                          <th className="text-left py-2 pr-4">Field</th>
                          <th className="text-left py-2 pr-4">Value</th>
                          <th className="text-left py-2">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.validationErrors.map((error, index) => (
                          <tr key={index} className="border-b border-red-100">
                            <td className="py-2 pr-4 text-red-700">{error.row}</td>
                            <td className="py-2 pr-4 text-red-700 font-mono">
                              {error.field}
                            </td>
                            <td className="py-2 pr-4 text-red-700 font-mono">
                              {error.value}
                            </td>
                            <td className="py-2 text-red-800">{error.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => router.push('/devices')}>
                  View Devices
                </Button>
                <Button
                  onClick={() => {
                    setResult(null);
                    setError(null);
                  }}
                >
                  Import More
                </Button>
              </div>
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
