# AiLert Frontend

Modern Next.js 14 frontend application for the AiLert professional newsletter platform.

## Features

- **Next.js 14** with App Router and TypeScript
- **Tailwind CSS** for responsive design system
- **Framer Motion** for smooth animations
- **React Query** for server state management
- **Zustand** for client state management
- **React Hook Form** with Zod validation
- **Jest & Testing Library** for comprehensive testing

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Query + Zustand
- **Forms**: React Hook Form + Zod
- **Animation**: Framer Motion
- **Testing**: Jest + Testing Library
- **Linting**: ESLint + Prettier

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.local.example .env.local
```

3. Update environment variables in `.env.local`

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components
│   ├── forms/          # Form components
│   ├── layout/         # Layout components
│   └── providers/      # Context providers
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries
│   ├── api/           # API client and endpoints
│   └── utils.ts       # Utility functions
├── store/              # Zustand stores
├── types/              # TypeScript type definitions
└── styles/             # Global styles
```

## Key Components

### State Management

- **Auth Store**: User authentication and profile management
- **UI Store**: Global UI state (sidebar, notifications, loading states)
- **React Query**: Server state management with caching and synchronization

### API Integration

- **API Client**: Axios-based client with interceptors for auth and error handling
- **Auth API**: Authentication endpoints (login, register, profile management)
- **Type-safe**: Full TypeScript integration with API responses

### UI Components

- **Design System**: Consistent component library with Tailwind CSS
- **Responsive**: Mobile-first responsive design
- **Accessible**: WCAG compliant components
- **Animated**: Smooth animations with Framer Motion

## Environment Variables

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Authentication
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3001

# OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

## Testing

Run tests with:
```bash
npm test
```

The test suite includes:
- Unit tests for components
- Integration tests for user flows
- API mocking for isolated testing
- Coverage reporting

## Deployment

### Production Build

```bash
npm run build
npm run start
```

### Docker

```bash
docker build -t ailert-frontend .
docker run -p 3000:3000 ailert-frontend
```

## Contributing

1. Follow the existing code style and patterns
2. Write tests for new components and features
3. Use TypeScript strictly (no `any` types)
4. Follow the component structure and naming conventions
5. Update documentation for new features

## Architecture Decisions

- **App Router**: Using Next.js 14 App Router for better performance and developer experience
- **TypeScript**: Strict TypeScript configuration for type safety
- **Tailwind CSS**: Utility-first CSS framework for rapid development
- **Component Library**: Custom component library built on Tailwind for consistency
- **State Management**: Zustand for client state, React Query for server state
- **Testing**: Jest and Testing Library for comprehensive testing coverage
