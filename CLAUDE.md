# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A homeschool Learning Management System (LMS) built with React + FastAPI that helps parents track student progress against NSW curriculum standards. The system supports evidence collection, AI-assisted content generation, progress tracking, and report generation.

### Core Hierarchy
- **Stage** (e.g., Stage 2 - Years 3-4) → **Learning Areas** (e.g., Mathematics) → **Learning Outcomes** (e.g., MA2-RN-01)
- Progress = (Outcomes with evidence / Total outcomes) × 100

## Technology Stack

**Frontend:** React 18.3, Vite 6.0, Chakra UI, Redux Toolkit, React Router 7.1, Axios, Supabase client, Sentry
**Backend:** FastAPI 0.115, Motor (async MongoDB), Supabase auth, Cloudinary + Backblaze B2, Stripe, Google Gemini AI
**Database:** MongoDB
**Deployment:** Vercel (frontend), Render.com (backend)

## Development Commands

### Frontend
```bash
cd frontend
npm install
npm run dev          # Start dev server (default: http://localhost:5173)
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run icons        # Generate PWA icons
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload    # Start dev server (default: http://localhost:8000)
# API docs available at: http://localhost:8000/api/docs
```

### Deployment
```bash
git add .
git commit -m "deploy bug fix"
git push
# Auto-deploys to Vercel (frontend) and Render.com (backend)
```

## Architecture

### Monorepo Structure
```
/frontend          React SPA with Vite
  /src
    /pages         Route components (auth, students, progress, reports, ai, admin, etc.)
    /components    Reusable UI (navigation, common, students, reports, subscription)
    /services      api.js (936 lines - all endpoints), supabase.js, curriculum.js, imageService.js
    /state         Redux store (store.js, studentsSlice.js, userSlice.js, db.js for IndexedDB)
    /contexts      UserContext (user + subscription), StudentsContext, FileUploadModalContext
    /hooks         Custom React hooks
    /utils         logger.js (Sentry integration), authUtils.js
  /public
    /curriculum    NSW curriculum JSON files (early-stage-1 through stage-5)

/backend           FastAPI REST API
  /app
    /routes        API endpoints (auth, user, student, learning_outcome, report, ai, file, stripe, admin)
    /services      Business logic (student, learning_outcome, report, ai, file_storage, subscription, admin)
    /models/schemas  Pydantic models (user, student, report, subscription, evidence, learning_outcome)
    /utils         auth_utils.py (JWT + Supabase verification), database_utils.py, error_handlers.py
    /config        settings.py (env vars), api_description.py
  /curriculum      NSW curriculum JSON files (same as frontend)
  /scripts         Migration/utility scripts (grandfather_users.py, set_super_admin.py)

/docs              Documentation (auth, subscriptions, offline, mobile, image optimization)
```

### API Communication
- **Base URL:** Environment-aware (same-origin in production, `VITE_API_URL` in dev)
- **Auth:** Bearer token via Axios interceptor (Supabase session token)
- **Pattern:** Frontend calls `services/api.js` → Axios adds token → Backend verifies with `get_current_user()` dependency
- **Student Context:** Most endpoints scoped to `studentId` (e.g., `/api/learning-outcomes/{studentId}/{outcomeId}`)
- **File Uploads:** FormData with `multipart/form-data`
- **Signed URLs:** Backend generates time-limited Cloudinary URLs for authenticated content

### Authentication Architecture
**Dual-layer system:**
1. **Primary: Supabase** - Frontend uses `@supabase/supabase-js`, backend verifies JWT
2. **Fallback: Legacy JWT** - Supports old user tokens via `python-jose` (if `JWT_SECRET` configured)

**Authorization Flow:**
- Frontend: Supabase `onAuthStateChange` listener → session stored automatically → protected routes check `isAuthenticated`
- Backend: `get_current_user()` dependency tries Supabase verification first, falls back to legacy JWT, auto-creates MongoDB user if not exists

**Role-Based Access:**
- **Roles:** `parent` (default), `admin`, `super_admin`
- **Dependencies:** `get_current_user()`, `get_admin_user()`, `get_super_admin_user()`
- **Student Access Levels:** `admin` (full control), `content` (add evidence), `view` (read-only)

### Database Models (MongoDB Collections)

**users**
- Auth/profile data, subscription fields (tier, Stripe IDs, grandfathered status)
- Indexed: `email` (unique), `organization_id`, `family_id`

**students**
- Profile (name, DOB, grade, avatar), `parent_access[]` array, `slug` (URL-friendly ID)
- Indexed: `parent_ids`, `slug`, `organization_id`

**student_reports**
- Generated reports per student/year/period, `learning_area_summaries[]` (AI + user edits), `evidence_examples[]`
- Indexed: `student_id`, `(student_id, academic_year, report_period)` (unique)

**Evidence:** Embedded documents in learning outcome records (not separate collection)

### State Management

**Frontend:**
- **Redux Toolkit:** Students + user slices with IndexedDB persistence (rehydrated on app startup)
- **React Context:** UserContext (user + subscription helpers), StudentsContext (wraps Redux), FileUploadModalContext
- **Component State:** Local UI state via `useState`

**Backend:**
- **Database Singleton:** `Database` class in `database_utils.py`, initialized on app startup, accessed via `Database.get_db()`

## Key Service Layers

### Backend Services (Business Logic)

**student_service.py** - Student CRUD, slug generation, parent access management, avatar uploads

**learning_outcome_service.py** (43KB) - Evidence CRUD, batch fetching, progress calculation, thumbnail generation, multi-outcome uploads

**report_service.py** (49KB) - Report generation orchestration, AI prompt construction, evidence selection, report CRUD

**ai_service.py** (45KB) - Gemini AI integration, multi-image descriptions, outcome suggestions, AI chat, curriculum context prompts

**file_storage_service.py** (20KB) - Dual storage (Cloudinary delivery + B2 backup), migration modes (public/private/hybrid), thumbnails, signed URLs

**subscription_service.py** (14KB) - Stripe checkout/webhooks, usage tracking, limit enforcement (per tier), grandfathered user support

**admin_service.py** (22KB) - Platform statistics, user management, impersonation, image migration tools

**curriculum_service.py** - NSW Curriculum file loader for backend AI context

**supabase_service.py** - Supabase client wrapper for backend auth verification

### Frontend Services

**api.js** (935 lines) - Central API client, all backend endpoints wrapped, token injection, error handling with Sentry

**curriculum.js** - NSW Curriculum loader with IndexedDB caching, grade-to-stage mapping, lazy loading

**supabase.js** - Supabase client wrapper, auth helpers (signUp, signIn, signOut, resetPassword)

## Data Flow Examples

### Evidence Upload
1. User uploads file(s) via `AIEvidenceUploadPage`
2. AI generates description: `POST /api/v1/ai/generate-description`
3. AI suggests outcomes: `POST /api/v1/ai/suggest-outcomes`
4. Submit: `POST /api/learning-outcomes/{studentId}/{outcomeId}/evidence`
5. Backend uploads to Cloudinary + B2, stores in MongoDB, updates progress

### Report Generation
1. User initiates on `ReportsPage`
2. Frontend calls: `POST /api/reports/{studentId}/generate`
3. Backend gathers evidence, calls Gemini AI for summaries per subject
4. Backend stores with status `generating` → `draft`
5. Frontend polls/receives update, navigates to report view

### Curriculum Loading
- **Static Files:** JSON in `public/curriculum/` (frontend) and `backend/curriculum/`
- **Frontend:** `curriculumService.load(stage)` lazy-loads from `/curriculum/{stage}-curriculum.json`
- **IndexedDB:** Curriculum cached locally for offline
- **Backend:** `CurriculumService` loads from filesystem for AI context

## Subscription System

**Tiers:**
- `free`: 1 student, 15 evidence items
- `basic`: 3 students, 1000 evidence items, unlimited reports

**Enforcement:**
- Backend checks limits before operations
- Frontend uses `UserContext` helpers: `canAddStudent()`, `canGenerateReports()`, etc.
- Grandfathered users get basic features on free tier

**Stripe Integration:**
- Checkout sessions via `/api/stripe/create-checkout-session`
- Webhooks at `/api/stripe/webhook` for subscription events
- Price IDs: `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_ANNUAL_PRICE_ID`

## File Storage Configuration

**Dual Storage:** Every file → Cloudinary (CDN) + Backblaze B2 (backup)

**Migration Modes** (`CLOUDINARY_MIGRATION_MODE`):
- `public` - Public Cloudinary uploads
- `private` - Authenticated Cloudinary uploads (recommended)
- `hybrid` - Both (for migration)

**Signed URLs:** Backend generates time-limited signed URLs for authenticated content

## NSW Curriculum Files

**Location:** `frontend/public/curriculum/` and `backend/curriculum/`
**Stages:** `early-stage-1-curriculum.json` through `stage-5-curriculum.json`
**Format:** JSON with `subjects[]` → `outcomes[]`
**Frontend:** Lazy-loaded and cached in IndexedDB
**Backend:** Loaded for AI context during report generation

**Grade to Stage Mapping:**
- K, 1, 2 → early-stage-1, stage-1
- 3, 4 → stage-2
- 5, 6 → stage-3
- 7, 8 → stage-4
- 9, 10 → stage-5

## Environment Variables

### Frontend (.env.development / .env.production)
```bash
VITE_API_URL=                 # Optional, defaults to same-origin
VITE_REMOTE_API_URL=          # Fallback remote API
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SENTRY_DSN=
```

### Backend (.env)
```bash
MONGODB_URL=
JWT_SECRET=                   # Legacy (optional)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
SUPABASE_JWT_SECRET=
GOOGLE_API_KEY=               # Gemini AI
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_MONTHLY_PRICE_ID=
STRIPE_ANNUAL_PRICE_ID=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_MIGRATION_MODE=    # public/private/hybrid
BACKBLAZE_ENDPOINT=
BACKBLAZE_KEY_ID=
BACKBLAZE_APPLICATION_KEY=
BACKBLAZE_BUCKET_NAME=
FRONTEND_URL=                 # For CORS and redirects
```

## Common Gotchas

1. **ObjectId Handling:** Convert to string for JSON, use `PyObjectId` in Pydantic models
2. **Date Handling:** Convert Python `date` to ISO string for MongoDB
3. **Token Refresh:** Supabase handles automatically, legacy requires manual refresh
4. **File Path Formats:** Cloudinary needs path without extension for transformations
5. **Student Access:** Check `parent_access[]` array, not just `parent_ids[]`
6. **Report IDs:** Use canonical string IDs, handle both ObjectId and string inputs
7. **Curriculum Stage Mapping:** "Year 3" → "stage-2", "K" → "early-stage-1"
8. **Evidence Storage:** Embedded in outcome documents, not separate collection

## Code Style (from .cursorrules)

### Frontend
- Functional components, no classes
- Use `function` keyword for pure functions, omit semicolons
- TypeScript interfaces (though this project uses JSX)
- Lowercase with dashes for directories (e.g., `components/auth-wizard`)
- Named exports for components
- Error handling: early returns, guard clauses, happy path last

### Backend
- Functional programming, avoid classes where possible
- Type hints for all function signatures, Pydantic models over raw dicts
- Lowercase with underscores for files (e.g., `routers/user_routes.py`)
- `async def` for I/O-bound operations, `def` for synchronous
- Error handling: early returns, guard clauses, HTTPException for expected errors
- Dependency injection for managing state

## Productivity Tips

1. **Auth:** Always use `get_current_user` dependency - handles both Supabase and legacy JWT
2. **Student Operations:** Use `StudentService` methods - handle slug generation and access control
3. **File Uploads:** Use `FileStorageService` - handles both Cloudinary and B2
4. **Evidence Access:** Via `learning_outcome_service`, not direct DB queries
5. **Logging:** Use `logger` utility in frontend for Sentry integration
6. **Subscriptions:** Check limits in `UserContext` before enabling features
7. **API Calls:** All endpoints in `services/api.js` - don't create new axios instances
8. **Curriculum:** Use `curriculumService.load(stage)` for on-demand loading
9. **Never skip auth dependencies** - security critical
10. **Test subscription limits** - use grandfathered flag for testing

## Documentation

- **API Docs:** Run backend → visit `http://localhost:8000/api/docs` (Swagger UI)
- **Auth Setup:** `docs/supabase-auth-setup.md`
- **Subscriptions:** `docs/subscription-setup.md`
- **Mobile:** `docs/mobile-app-implementation.md`
- **Offline:** `docs/OFFLINE_ARCHITECTURE.md`
- **Image Optimization:** `docs/image-optimization.md`, `docs/signed-images-guide.md`
- **Cloudinary Migration:** `docs/cloudinary-private-migration-guide.md`
- **Admin Tools:** `docs/admin-tools-implementation-plan.md`
