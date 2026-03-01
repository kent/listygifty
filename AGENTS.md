# NiftyGifty Development Guidelines

## Overview
NiftyGifty is a gift planning application built as a monorepo with:
- **Rails API** backend
- **Next.js** web frontend  
- **React Native/Expo** mobile app (Listy Gifty)
- **Shared packages** for types, API client, and services

## Architecture

### Monorepo Structure
```
niftygifty/
├── apps/
│   ├── api/              # Rails 8 API-only backend
│   ├── web/              # Next.js 16 frontend (NiftyGifty)
│   └── mobile/           # Expo/React Native app (Listy Gifty) ⚠️ SPECIAL
├── packages/
│   ├── types/            # Shared TypeScript types
│   ├── api-client/       # Shared API client
│   └── services/         # Shared service layer
├── package.json          # Root workspace config
└── turbo.json            # Turborepo config
```

### Technology Stack
- **Backend**: Rails 8.1, PostgreSQL (Cloud SQL for staging/prod; SQLite optional in local/dev), Devise + Clerk, Blueprinter
- **Web Frontend**: Next.js 16, React 19, Tailwind CSS, shadcn/ui
- **Mobile App**: Expo SDK 54, React Native 0.81, React 19.1
- **Shared**: TypeScript packages for types, API client, services
- **Auth**: Clerk (web + mobile)

---

## ⚠️ IMPORTANT: Mobile App Build Process

**The mobile app (`apps/mobile`) is intentionally DECOUPLED from the monorepo npm workspaces.**

### Why?
- React Native requires React 19.1.0
- Web app uses React 19.2.0
- npm workspace hoisting causes version conflicts

### How It Works
The mobile app:
1. Is **excluded** from root `package.json` workspaces (only `apps/web` is included)
2. Uses `file:` references to link shared packages:
   ```json
   "@niftygifty/types": "file:../../packages/types",
   "@niftygifty/api-client": "file:../../packages/api-client",
   "@niftygifty/services": "file:../../packages/services"
   ```
3. Has its **own `node_modules`** and `package-lock.json`
4. Should be **built and tested independently**

### Mobile App Commands
```bash
# Always run FROM the mobile directory
cd apps/mobile

# Install dependencies (use --legacy-peer-deps for Clerk compatibility)
npm install --legacy-peer-deps

# Start development
npx expo start

# Run tests
npm test

# Build for iOS/Android
npx expo build:ios
npx expo build:android
```

### Before Building Mobile
Ensure shared packages are built first:
```bash
# From repo root
npm run build  # Builds types, api-client, services, web
```

---

## Building & Testing

### Quick Reference
| App/Package | Build Command | Test Command |
|-------------|---------------|--------------|
| **All (except mobile)** | `npm run build` | `npm run test` |
| **API** | N/A (Ruby) | `cd apps/api && bin/rails test` |
| **Web** | `cd apps/web && npm run build` | `cd apps/web && npm run lint` |
| **Mobile** | `cd apps/mobile && npx expo start` | `cd apps/mobile && npm test` |
| **Types** | `cd packages/types && npm run build` | N/A |
| **API Client** | `cd packages/api-client && npm run build` | N/A |
| **Services** | `cd packages/services && npm run build` | N/A |

### Full Build (CI-style)
```bash
# 1. Install root dependencies
npm install

# 2. Build all packages and web
npm run build

# 3. Run API tests
cd apps/api && bin/rails test

# 4. Build and test mobile (separate process)
cd apps/mobile
npm install --legacy-peer-deps
npm test
```

### Lint All
```bash
./bin/lint  # Runs RuboCop + Next.js lint/typecheck
```

---

## Core Principles

### 1. Don't Repeat Yourself (DRY)

**Types**: All shared types live in `packages/types/src/index.ts`. Before creating a new type:
1. Search the types package first
2. If it exists, import it: `import type { Holiday } from "@niftygifty/types"`
3. Only create new types if they don't exist

**Services**: Shared services live in `packages/services/`:
- `holidays.service.ts`
- `gifts.service.ts`
- `gift-statuses.service.ts`

**API Client**: Shared API client in `packages/api-client/`

### 1.1 Clean Code Rules (Required)

1. Extract repeated logic before it appears in a third place.
2. Keep API access in service layers (`packages/services`, `@/lib/api`) and out of UI components.
3. Keep components focused on UI and screen orchestration, not request formatting/parsing.
4. Prefer existing shared utilities/components over copy/paste:
   - Mobile formatters: `apps/mobile/lib/formatters.ts`
   - Mobile status mapping: `apps/mobile/lib/gift-status-colors.ts`
   - Mobile reusable states: `apps/mobile/components/ScreenLoader.tsx`, `apps/mobile/components/InlineError.tsx`, `apps/mobile/components/FloatingActionButton.tsx`
5. For behavior changes, add or update tests in the affected app.

### 2. Service Layer Pattern

Components should NEVER make direct API calls. Always use services:

```typescript
// Web app
import { holidaysService } from "@/services";

// Mobile app
import { holidaysService } from "@/lib/api";

// Usage is identical
const holidays = await holidaysService.getAll();
```

### 3. Type Synchronization

Rails Blueprints and TypeScript types must stay in sync:

**Rails Blueprint** (`apps/api/app/blueprints/holiday_blueprint.rb`):
```ruby
class HolidayBlueprint < ApplicationBlueprint
  fields :name, :date, :created_at, :updated_at
end
```

**TypeScript Type** (`packages/types/src/index.ts`):
```typescript
export interface Holiday extends BaseEntity {
  name: string;
  date: string;
  created_at: string;
  updated_at: string;
}
```

### 4. Authentication Flow

Both web and mobile use **Clerk** for authentication:

**Web**: Uses `@clerk/nextjs` with middleware
**Mobile**: Uses `@clerk/clerk-expo` with SecureStore for token caching

The Rails API validates Clerk JWTs and syncs users on first request.

### 5. Error Handling

Services throw `ApiError` on failure:

```typescript
import { ApiError } from "@niftygifty/api-client";

try {
  await holidaysService.getAll();
} catch (err) {
  if (err instanceof ApiError) {
    if (err.isUnauthorized) {
      // Handle 401
    }
    console.error(err.message);
  }
}
```

---

## Development Workflow

### Starting Development

```bash
# Terminal 1: API
cd apps/api && bin/rails server -p 3001

# Terminal 2: Web
cd apps/web && npm run dev

# Terminal 3: Mobile (optional)
cd apps/mobile && npx expo start
```

### Adding a New Feature

1. **Define types** in `packages/types/src/index.ts`
2. **Rebuild packages**: `npm run build` (from root)
3. **Create/update blueprint** in `apps/api/app/blueprints/`
4. **Create/update controller** in `apps/api/app/controllers/`
5. **Add service method** in `packages/services/` if shared
6. **Build UI** in web and/or mobile using shared services/utilities (no direct API calls in components)
7. **Run tests** in all touched apps
8. **Deploy to staging first**, then production after validation

### Adding a New API Endpoint

1. Add route to `apps/api/config/routes.rb`
2. Create controller action
3. Create/update blueprint for serialization
4. Add TypeScript types to `packages/types`
5. Add service method to `packages/services`
6. Rebuild: `npm run build`

---

## File Naming Conventions

- Services: `*.service.ts` (e.g., `holidays.service.ts`)
- Types: PascalCase interfaces (e.g., `Holiday`, `CreateHolidayRequest`)
- Components: PascalCase (e.g., `HolidayCard.tsx`)
- Pages: lowercase with hyphens

---

## API Endpoints

| Resource | Endpoint | Methods |
|----------|----------|---------|
| Auth | `/users`, `/users/sign_in`, `/users/sign_out` | POST, DELETE |
| Holidays | `/holidays` | GET, POST, PATCH, DELETE |
| People | `/people` | GET, POST, PATCH, DELETE |
| Gifts | `/gifts` | GET, POST, PATCH, DELETE |
| Gift Statuses | `/gift_statuses` | GET, POST, PATCH, DELETE |
| Gift Exchanges | `/gift_exchanges` | GET, POST, PATCH, DELETE |

---

## Environment Variables

### Web (`apps/web/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### Mobile (`apps/mobile/.env`)
```
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### API
Uses Rails credentials. Clerk keys configured in credentials or environment.

## GCP Deployment Profile (listygifty)

Use this profile for all Cloud Run/Cloud Build deploy actions so commands never target the wrong project.

- Project ID: `listygifty`
- Project number: `906707282968`
- Region: `us-central1`
- Deployer service account: `niftygifty-deployer@listygifty.iam.gserviceaccount.com`
- GitHub Actions SA: `github-actions@listygifty.iam.gserviceaccount.com`
- Local key file (gitignored): `.gcp/keys/listygifty-deployer.json`
- Local profile file (gitignored): `.gcp/listygifty-deploy.env`

### gcloud Configuration Profile

A named gcloud configuration `listygifty` is set up to avoid account switching issues:

```bash
# Activate the listygifty profile before running any gcloud commands
gcloud config configurations activate listygifty
```

This profile is pre-configured with:
- Account: `kent.fenwick@gmail.com`
- Project: `listygifty`

### Activate deploy profile

```bash
gcloud config configurations activate listygifty
source .gcp/listygifty-deploy.env
```

### Deploy commands (explicit staging/prod)

```bash
# API
ENVIRONMENT=staging HEROKU_SECRET_BINDINGS_FILE=infra/gcp/secret-bindings.staging.env bash infra/gcp/scripts/deploy-api.sh
ENVIRONMENT=production HEROKU_SECRET_BINDINGS_FILE=infra/gcp/secret-bindings.production.env bash infra/gcp/scripts/deploy-api.sh

# Web
ENVIRONMENT=staging HEROKU_SECRET_BINDINGS_FILE=infra/gcp/secret-bindings.staging.env bash infra/gcp/scripts/deploy-web.sh
ENVIRONMENT=production HEROKU_SECRET_BINDINGS_FILE=infra/gcp/secret-bindings.production.env bash infra/gcp/scripts/deploy-web.sh
```

### Standard release command (preferred)

```bash
source .gcp/listygifty-deploy.env
npm run gcp:release
```

This runs local checks, deploys staging + production, and executes smoke tests for both.

### Branch deploy policy

- Push to `staging` -> deploy staging
- Push to `main` -> deploy production

### If the deployer key is missing

```bash
mkdir -p .gcp/keys
CLOUDSDK_CORE_ACCOUNT=kent.fenwick@gmail.com CLOUDSDK_CORE_PROJECT=listygifty \
  gcloud iam service-accounts keys create .gcp/keys/listygifty-deployer.json \
  --iam-account=niftygifty-deployer@listygifty.iam.gserviceaccount.com
chmod 600 .gcp/keys/listygifty-deployer.json .gcp/listygifty-deploy.env
```
