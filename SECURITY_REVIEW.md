# SaaS Security & Code Quality Review

**Date:** 2026-02-21
**Scope:** Full codebase audit - security, bugs, redundancy
**Status:** REMEDIATION IN PROGRESS
**Last Updated:** 2026-02-21

---

## Overall Assessment: NOT PRODUCTION-READY

The application has solid architectural foundations but contains **critical security vulnerabilities** that must be resolved before SaaS deployment. The review identified issues across 7 categories totaling approximately **60+ distinct findings**.

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Authentication & Authorization | 4 | 5 | 7 | 0 |
| API Input Validation | 4 | 5 | 8 | 4 |
| File Upload & Storage | 3 | 2 | 7 | 0 |
| Stripe & Subscriptions | 6 | 4 | 4 | 0 |
| Frontend Security | 2 | 3 | 3 | 3 |
| Bugs & Logic Errors | 4 | 3 | 5 | 8 |
| Code Bloat & Redundancy | 2 | 5 | 5 | 4 |

---

## PART 1: CRITICAL SECURITY VULNERABILITIES

These must be fixed before any production deployment.

### SEC-01: All AI Endpoints Are Completely Unauthenticated
**Severity:** CRITICAL | **Status:** FIXED | **File:** `backend/app/routes/ai_routes.py:15-17`

~~Authentication is **commented out** on the router and all 4 endpoints.~~

**Resolution:** Enabled `dependencies=[Depends(get_current_user)]` on the router and uncommented `current_user: User = Depends(get_current_user)` parameter on all 4 endpoints (generate-description, analyze-image, suggest-outcomes, chat).

---

### SEC-02: CORS Allows ALL Origins With Credentials
**Severity:** CRITICAL | **Status:** FIXED | **File:** `backend/app/config/settings.py:46`

~~This regex matches **every HTTP/HTTPS origin**. Combined with `allow_credentials=True` in `main.py`, any website can make authenticated cross-origin requests as the logged-in user.~~

**Resolution:** Set `allowed_origin_regex = None`. The explicit `allowed_origins` list (localhost, production Vercel URL, Capacitor, Ionic) is sufficient and secure.

---

### SEC-03: Role Privilege Escalation via Supabase Metadata
**Severity:** CRITICAL | **Status:** FIXED | **File:** `backend/app/utils/auth_utils.py:55`

~~When auto-creating users on first login, the role is read from Supabase `user_metadata` which can be set by the client during signup.~~

**Resolution:** Hard-coded `role = "parent"` for all auto-created users. Admin/super_admin roles can only be assigned via dedicated admin endpoints or database scripts.

---

### SEC-04: File Access Authorization Always Bypassed
**Severity:** CRITICAL | **Status:** FIXED | **File:** `backend/app/services/file_storage_service.py:279-339`

~~Since FastAPI always runs in an async event loop, `loop.is_running()` is always `True`. This means `_verify_user_access()` **always returns True**.~~

**Resolution:** Refactored `_verify_user_access()` and `generate_user_signed_url()` to proper `async def` methods. DB queries now execute correctly — checks admin role, then verifies student access via `parent_access[]` and `parent_ids[]`. Updated the calling route in `file_routes.py` to `await` the async method.

---

### SEC-05: Trailing-Slash Endpoint Returns ALL Students
**Severity:** CRITICAL | **Status:** FIXED | **File:** `backend/app/routes/student_routes.py:57-62`

~~The `/students/` (with trailing slash) endpoint calls `get_all_students()`, returning every student in the database.~~

**Resolution:** Changed `/students/` endpoint to call `StudentService.get_students_for_parent(str(current_user.id))`, matching the behavior of the `/students` endpoint.

---

### SEC-06: Bulk Deletion Endpoints Accessible by Non-Super-Admins
**Severity:** CRITICAL | **Status:** FIXED | **File:** `backend/app/routes/file_routes.py:326-487`

~~Three bulk deletion endpoints use `is_admin_user()`, which allows regular admins to permanently delete all images.~~

**Resolution:** Changed all three endpoints (`delete-all-public`, `delete-all-private`, `delete-all-cloudinary`) to use `Depends(get_super_admin_user)` dependency injection. Only `super_admin` role can access these endpoints now. Confirmation string check retained as additional safeguard.

---

### SEC-07: JWT Audience Verification Disabled
**Severity:** HIGH | **Status:** FIXED | **File:** `backend/app/services/supabase_service.py:55-60`

~~Audience verification was disabled, allowing tokens from other Supabase projects sharing the same JWT secret to be accepted.~~

**Resolution:** Set `audience="authenticated"` and `options={"verify_aud": True}` on the verified decode. Tokens must now have `aud: "authenticated"` to pass verification.

---

### SEC-08: No Rate Limiting on Authentication Endpoints
**Severity:** HIGH | **Status:** FIXED | **File:** `backend/app/routes/auth.py`

~~Login and register endpoints had zero rate limiting, enabling unlimited brute-force password attempts and credential stuffing attacks.~~

**Resolution:** Added dual rate limiting to login (5 attempts per 15 min per email + 15 attempts per 15 min per IP) and registration (3 attempts per hour per IP) using the existing `RateLimiter` infrastructure.

---

### SEC-09: Unvalidated Price ID in Checkout
**Severity:** HIGH | **Status:** FIXED | **File:** `backend/app/services/subscription_service.py:202-248`

~~The `create_checkout_session()` method accepted any `price_id` from the client without validation, allowing users to reference arbitrary Stripe price IDs.~~

**Resolution:** Added whitelist validation at the start of `create_checkout_session()`. Only `settings.stripe_monthly_price_id` and `settings.stripe_annual_price_id` are accepted. Returns 400 for invalid price IDs, 503 if pricing is not configured.

---

### SEC-10: Missing File Upload Validation
**Severity:** HIGH | **Status:** FIXED | **File:** `backend/app/routes/learning_outcome_routes.py:265-330`

~~Evidence uploads accepted ANY file type with NO size limit on the backend. Frontend had a 1.5MB limit, but this was trivially bypassed via direct API calls.~~

**Resolution:** Added `validate_upload_file()` helper with three layers of validation: file extension whitelist (JPEG, PNG, WebP, GIF, PDF), content-type check, and magic byte verification. Hard 50MB size limit enforced server-side. Applied to both evidence upload endpoints.

---

### SEC-11: Exposed Credentials in Version Control
**Severity:** HIGH | **File:** `frontend/.env.development`

Contains real Supabase URL, anon key, and Cloudinary API key committed to the repository.

**Fix:** Add `.env.development` to `.gitignore`, rotate all exposed credentials, create `.env.example` with placeholders.

---

### SEC-12: Grandfather Function Grants Premium to All Users
**Severity:** HIGH | **File:** `backend/app/routes/stripe_routes.py:185-195`

Protected by `get_admin_user` (not `get_super_admin_user`). A single call sets `is_grandfathered: true` on **all users** in the system, granting permanent premium features.

**Fix:** Require `get_super_admin_user`, add one-time execution flag, add audit logging.

---

### SEC-13: Subscription Status Not Validated in Feature Checks
**Severity:** HIGH | **File:** `backend/app/services/subscription_service.py:159-168`

Functions like `can_generate_reports()` check the subscription tier but never check `subscription_status`. Users with `tier: basic + status: past_due` (failed payment) retain premium features.

**Fix:** Check that `subscription_status in ["active", "trialing"]` before granting tier-dependent features.

---

## PART 2: BUGS & LOGIC ERRORS

### BUG-01: Bare Exception Handlers Swallow All Errors
**Severity:** HIGH | **Files:** `report_service.py:80,178`, `learning_outcome_service.py:103,228,403,566`

```python
try:
    student_obj_id = ObjectId(student_id)
except:  # Catches KeyboardInterrupt, SystemExit, etc.
```

**Fix:** Change to `except (InvalidId, ValueError, TypeError):`.

---

### BUG-02: Inconsistent Datetime Usage
**Severity:** HIGH | **Files:** `learning_outcome_service.py:601` vs others

Mix of `datetime.now()` (local timezone) and `datetime.utcnow()` (UTC). Database comparisons and sorting become unreliable.

**Fix:** Standardize on `datetime.now(timezone.utc)` everywhere (the modern replacement for the deprecated `datetime.utcnow()`).

---

### BUG-03: Race Condition in Report Generation
**Severity:** HIGH | **File:** `backend/app/services/report_service.py:190-199`

Check-then-insert pattern allows duplicate reports for the same student/grade when concurrent requests arrive.

**Fix:** Use a MongoDB unique index on `(student_id, academic_year, report_period)` with upsert, or use application-level locking.

---

### BUG-04: No Timeout on Gemini AI Calls
**Severity:** MEDIUM | **File:** `backend/app/services/ai_service.py:142,265,449,673,779,889`

```python
response = await model.generate_content_async(content_parts)  # No timeout
```

If the Gemini API hangs, the request hangs indefinitely, consuming server resources.

**Fix:** Add timeout wrapper (e.g., `asyncio.wait_for(call, timeout=60)`).

---

### BUG-05: Wrong Port in imageUtils.js
**Severity:** MEDIUM | **File:** `frontend/src/utils/imageUtils.js:165`

```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
```

Backend runs on port 8000, not 3001. This breaks signed URL generation in development.

**Fix:** Change to `'http://localhost:8000'`.

---

### BUG-06: Missing Webhook Idempotency
**Severity:** MEDIUM | **File:** `backend/app/services/subscription_service.py:348-401`

Webhook handlers process events without checking if they've already been processed. Stripe can deliver the same webhook multiple times.

**Fix:** Store processed `event_id` values and skip duplicates.

---

### BUG-07: Evidence Counting Race Condition
**Severity:** MEDIUM | **File:** `backend/app/services/subscription_service.py:114-136`

Evidence limit is checked with `get_evidence_count()` before writing, but concurrent requests all see the same count and all pass. Users can exceed limits.

**Fix:** Use atomic MongoDB operations or database-level constraints.

---

### BUG-08: Incomplete Shutdown Sequence
**Severity:** LOW | **File:** `backend/app/main.py:124-131`

If `rate_limiter.stop_cleanup()` throws, `Database.close_db()` never runs.

**Fix:** Wrap in try/finally.

---

### BUG-09: Health Check Exposes Error Details
**Severity:** LOW | **File:** `backend/app/main.py`

```python
return {"status": "unhealthy", "database": str(e)}  # Leaks error details
```

**Fix:** Return generic message, log details server-side.

---

## PART 3: CODE QUALITY & REDUNDANCY

### BLOAT-01: api.js - 935 Lines, 69 Functions, Identical Pattern
**File:** `frontend/src/services/api.js`

Every function follows the same try/catch/log pattern. Could be reduced by ~84% using a wrapper function:

```javascript
const apiCall = (method, url, logName) => async (data) => {
  try {
    const response = await apiToUse[method](url, data);
    logger.debug(`${logName} success`);
    return response.data;
  } catch (error) {
    logger.error(`${logName} error`, error);
    throw error;
  }
};
```

**Recommendation:** Split into domain modules (auth, students, reports, evidence, ai, subscription, admin).

---

### BLOAT-02: ImageViewerModal.jsx - 1004 Lines
**File:** `frontend/src/components/common/ImageViewerModal.jsx`

A single component handling image display, edit, delete, metadata management, and learning outcome assignment.

**Recommendation:** Extract into 4-5 focused components.

---

### BLOAT-03: Duplicated Curriculum Mapping
**Files:** `frontend/src/services/curriculum.js:202-231` and `backend/app/services/curriculum_service.py:25-42`

Identical grade-to-stage mapping maintained in two locations.

**Recommendation:** Make backend the single source of truth; frontend fetches mapping via API.

---

### BLOAT-04: Dead Legacy Component
**File:** `frontend/src/pages/content/ContentCreatePage_LEGACY.jsx`

Never imported anywhere. Contains `TODO: Implement actual upload logic`.

**Recommendation:** Delete.

---

### BLOAT-05: Redux + Context Duplication
**Files:** `frontend/src/state/studentsSlice.js` + `frontend/src/contexts/StudentsContext.jsx`

StudentsContext just wraps Redux `useSelector` with zero added logic.

**Recommendation:** Use Redux directly or Context, not both.

---

### BLOAT-06: Redundant Axios Instance
**File:** `frontend/src/services/api.js:17-22`

`productionApi` is only used if `VITE_REMOTE_API_URL` is set. Dead weight in normal deployments.

**Recommendation:** Remove the secondary instance; use a single configurable instance.

---

### BLOAT-07: Direct Axios Usage Bypassing Interceptor
**File:** `frontend/src/utils/imageUtils.js:163,202-209`

Imports `axios` directly and manually extracts token from `localStorage`, bypassing the auth interceptor in `api.js`.

**Recommendation:** Use the centralized `getSignedUrl()` from `api.js`.

---

### BLOAT-08: Missing prop-types Dependency
**File:** `frontend/src/components/common/Image.js:2`

Imports `prop-types` which is NOT listed in `package.json`. Will fail on fresh `npm install`.

**Fix:** Add `prop-types` to dependencies or remove usage.

---

### BLOAT-09: Repeated Report Ownership Verification
**File:** `backend/app/routes/report_routes.py` (lines 112-134, 177-206, 220-246, 268-296, 310-321)

The same ownership verification pattern is copy-pasted across 5+ endpoints.

**Recommendation:** Extract into a `verify_report_ownership()` helper function.

---

### BLOAT-10: 7 Migration-Only API Functions
**File:** `frontend/src/services/api.js:480-539`

Used exclusively by `ImageMigrationManager.jsx`. If migration is complete, these are dead code.

**Recommendation:** Remove after migration is confirmed complete.

---

## PART 4: FRONTEND-SPECIFIC SECURITY

### FE-01: XSS via dangerouslySetInnerHTML
**Severity:** MEDIUM | **File:** `frontend/src/components/reports/LearningAreaSummaryCard.jsx:175`

Uses `dangerouslySetInnerHTML` with `formatMarkdownToHTML()`. The function does escape HTML entities before markdown processing (good), but there's no defense-in-depth.

**Fix:** Add DOMPurify as a second layer: `DOMPurify.sanitize(formatMarkdownToHTML(text))`.

---

### FE-02: Unsafe HTML String Interpolation in Report Export
**Severity:** HIGH | **File:** `frontend/src/components/reports/exportUtils.js:206,213-216,236,271`

`generatePrintableHTML()` interpolates user data (student names, parent_overview) directly into HTML strings without escaping:

```javascript
<h2>${student?.first_name} ${student?.last_name}</h2>
<p>${(report.parent_overview || '').replace(/\n/g, '<br>')}</p>
```

**Fix:** Escape all user-provided values before interpolation into HTML.

---

### FE-03: Debug UI Exposed in Production
**Severity:** LOW | **File:** `frontend/src/pages/students/StudentSelection.jsx:118-130`

Debug button shows token existence, length, and backend URL to any user.

**Fix:** Gate behind `import.meta.env.DEV` check or remove.

---

### FE-04: No Content Security Policy Headers
**Severity:** MEDIUM | **Location:** Not configured anywhere

Without CSP, any successful XSS can execute arbitrary JavaScript, steal tokens, and exfiltrate data.

**Fix:** Add CSP middleware in FastAPI backend.

---

## PART 5: REMEDIATION ROADMAP

### Phase 1: Critical Security (Must do before any production traffic)

| # | Fix | Files | Priority | Status |
|---|-----|-------|----------|--------|
| 1 | Enable AI endpoint authentication | `ai_routes.py:15-17` | CRITICAL | FIXED |
| 2 | Remove CORS wildcard regex | `settings.py:46` | CRITICAL | FIXED |
| 3 | Hard-code `role = "parent"` on user creation | `auth_utils.py:55` | CRITICAL | FIXED |
| 4 | Fix async authorization bypass | `file_storage_service.py:290-298` | CRITICAL | FIXED |
| 5 | Fix trailing-slash student endpoint | `student_routes.py:57-62` | CRITICAL | FIXED |
| 6 | Remove/restrict bulk deletion endpoints | `file_routes.py:326-487` | CRITICAL | FIXED |
| 7 | Enable JWT audience verification | `supabase_service.py:55-60` | HIGH | FIXED |
| 8 | Add rate limiting to auth endpoints | `auth.py` | HIGH | FIXED |
| 9 | Validate Stripe price IDs | `subscription_service.py:202-248` | HIGH | FIXED |
| 10 | Add file upload validation | `learning_outcome_routes.py:265-330` | HIGH | FIXED |

### Phase 2: Important Fixes (Before paid customers)

| # | Fix | Files | Status |
|---|-----|-------|--------|
| 11 | Validate subscription status in feature checks | `subscription_service.py:159-168` | TODO |
| 12 | Fix bare exception handlers | Multiple service files | TODO |
| 13 | Standardize datetime usage | Multiple service files | TODO |
| 14 | Add AI call timeouts | `ai_service.py` | TODO |
| 15 | Fix report generation race condition | `report_service.py:190-199` | TODO |
| 16 | Add webhook idempotency | `subscription_service.py:348-401` | TODO |
| 17 | Fix imageUtils.js wrong port | `imageUtils.js:165` | TODO |
| 18 | Restrict grandfather endpoint | `stripe_routes.py:185-195` | TODO |
| 19 | Sanitize error messages | Multiple route files | TODO |
| 20 | Rotate exposed credentials | `.env.development` + credential providers | TODO |

### Phase 3: Code Quality (Ongoing)

| # | Fix | Impact | Status |
|---|-----|--------|--------|
| 21 | Split api.js into domain modules | Maintainability | TODO |
| 22 | Split ImageViewerModal | Maintainability | TODO |
| 23 | Consolidate curriculum mapping | Single source of truth | TODO |
| 24 | Delete dead code (ContentCreatePage_LEGACY) | Cleanliness | TODO |
| 25 | Add CSP headers | Defense-in-depth | TODO |
| 26 | Add audit logging | Compliance | TODO |
| 27 | Add DOMPurify for HTML rendering | XSS prevention | TODO |
| 28 | Fix missing prop-types dependency | Build reliability | TODO |
| 29 | Remove debug UI from production | Information disclosure | TODO |
| 30 | Implement token revocation mechanism | Session management | TODO |

---

## What's Working Well

The codebase is not all problems. These are solid:

1. **FastAPI dependency injection** - Clean `Depends(get_current_user)` pattern on most routes
2. **Role-based access control** - Three-tier system (parent/admin/super_admin) is well-designed
3. **Secret management** - All secrets loaded from environment variables (no hardcoded keys in Python)
4. **Stripe webhook signature verification** - Properly uses `stripe.Webhook.construct_event()`
5. **Dual storage strategy** - Cloudinary + B2 backup provides redundancy
6. **Pydantic models** - Good use of typed schemas for request/response validation
7. **Supabase + legacy JWT fallback** - Smooth migration path for existing users
8. **IndexedDB caching** - Curriculum data cached client-side for offline capability
9. **Sentry integration** - Error tracking configured in frontend

---

## Summary

The application's architecture is sound, but implementation gaps - particularly the commented-out AI authentication, wildcard CORS, role escalation via metadata, and the async authorization bypass - create **critical security holes** that would be exploited quickly in a SaaS context. The 10 critical/high items in Phase 1 should be treated as blockers for any production deployment.
