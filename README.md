# Network Management System - Frontend

A comprehensive Next.js frontend application for managing network devices with real-time monitoring and lifecycle management.

## Features

### REQ-002: Network Device CRUD Operations

This frontend implements all features from REQ-002 Network Device CRUD requirements:

#### 1. Device Lifecycle Management
- **DRAFT Mode**: Create placeholder devices with minimal information (IP, MAC, Device ID)
- **ACTIVE Mode**: Create fully-configured devices or activate DRAFT devices
- **Activation Workflow**: Complete form to transition devices from DRAFT to ACTIVE
- **Soft Delete**: 7-day grace period before permanent deletion
- **Restore**: Recover soft-deleted devices within grace period

#### 2. CRUD Operations
- **Create**: Form with DRAFT/ACTIVE mode selection
- **Read**: Device list with pagination and filtering
- **Update**: Edit device details (immutable fields protected)
- **Delete**: Both hard delete and soft delete with confirmation
- **List**: Paginated table with status and type filters

#### 3. Bulk Import
- CSV file upload with validation
- Support for up to 1000 devices per import
- DRAFT/ACTIVE mode selection
- Real-time validation feedback
- Detailed error reporting
- CSV template download

#### 4. Real-time Updates
- WebSocket integration for live device status changes
- Automatic list refresh on device lifecycle events
- Connection status indicator in header

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks
- **Real-time**: WebSocket (custom service)
- **API Client**: Fetch API with singleton service

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set environment variables:
```bash
# Create .env.local file
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WS_URL=ws://localhost:3000
```

3. Run development server:
```bash
npm run dev
```

4. Open http://localhost:3001

## Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
frontend/
├── app/                          # Next.js App Router pages
│   ├── devices/                  # Device management pages
│   │   ├── page.tsx             # Device list with pagination
│   │   ├── create/              # Device creation form
│   │   ├── import/              # CSV bulk import
│   │   └── [id]/                # Device detail routes
│   ├── layout.tsx               # Root layout with header
│   └── page.tsx                 # Home page
├── src/
│   ├── components/
│   │   ├── ui/                  # Reusable UI components
│   │   └── layout/              # Layout components
│   ├── services/
│   │   ├── api.service.ts       # Backend API client
│   │   └── websocket.service.ts # WebSocket manager
│   ├── hooks/                   # React hooks
│   └── types/                   # TypeScript definitions
└── public/
```

## Key Features

### Real-time Updates
The application automatically updates when devices change status or lifecycle events occur via WebSocket.

### Type Safety
All backend DTOs are mirrored in TypeScript for complete type safety.

### Validation
Client-side validation for IP addresses, MAC addresses, field lengths, and required fields.

### Responsive Design
Mobile-friendly interface with Tailwind CSS.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
