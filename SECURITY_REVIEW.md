# SaaS Security & Code Quality Review

**Date:** 2026-02-21
**Scope:** Full codebase audit - security, bugs, redundancy
**Status:** READ-ONLY ANALYSIS - findings only, no code changes

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
**Severity:** CRITICAL | **File:** `backend/app/routes/ai_routes.py:15-17`

Authentication is **commented out** on the router and all 4 endpoints:

```python
router = APIRouter(
    # dependencies=[Depends(get_current_user)] # Uncomment to protect endpoint
)
```

**Affected endpoints:**
- `POST /api/v1/ai/generate-description` (line 19)
- `POST /api/v1/ai/analyze-image` (line 140)
- `POST /api/v1/ai/suggest-outcomes` (line 222)
- `POST /api/v1/ai/chat` (line 323)

**Impact:** Anyone on the internet can upload files, consume Gemini API quota, and access student data through the AI chat endpoint. This bypasses subscription limits entirely.

**Fix:** Uncomment the `dependencies=[Depends(get_current_user)]` on the router (line 16) and uncomment `current_user` parameters in each endpoint.

---

### SEC-02: CORS Allows ALL Origins With Credentials
**Severity:** CRITICAL | **File:** `backend/app/config/settings.py:46`

```python
allowed_origin_regex: Optional[str] = r"https?://.*"
```

This regex matches **every HTTP/HTTPS origin**. Combined with `allow_credentials=True` in `main.py`, any website can make authenticated cross-origin requests as the logged-in user.

**Impact:** Any malicious website a user visits can silently make API calls using their session - reading student data, modifying reports, deleting evidence.

**Fix:** Remove line 46 entirely. The explicit `allowed_origins` list on lines 36-43 is correct and sufficient.

---

### SEC-03: Role Privilege Escalation via Supabase Metadata
**Severity:** CRITICAL | **File:** `backend/app/utils/auth_utils.py:55`

```python
role = user_metadata.get("role", "parent")
```

When auto-creating users on first login, the role is read from Supabase `user_metadata` which can be set by the client during signup. An attacker can set `role: "super_admin"` in their signup metadata and gain full admin access.

**Impact:** Complete privilege escalation - access to admin panel, user management, impersonation, all student data.

**Fix:** Hard-code `role = "parent"` for all auto-created users. Admin/super_admin roles should only be assigned through a dedicated admin endpoint or database script.

---

### SEC-04: File Access Authorization Always Bypassed
**Severity:** CRITICAL | **File:** `backend/app/services/file_storage_service.py:290-298`

```python
loop = asyncio.get_event_loop()
if loop.is_running():
    logger.warning("_verify_user_access called in async context - allowing access for now...")
    return True  # BYPASSES ALL VERIFICATION
```

Since FastAPI always runs in an async event loop, `loop.is_running()` is always `True`. This means `_verify_user_access()` **always returns True**, allowing any authenticated user to access any student's files.

**Impact:** Complete bypass of file-level authorization. Any parent can view any other student's evidence files.

**Fix:** Refactor `_verify_user_access()` to be a proper `async def` method, or pass the already-verified user context from the route handler.

---

### SEC-05: Trailing-Slash Endpoint Returns ALL Students
**Severity:** CRITICAL | **File:** `backend/app/routes/student_routes.py:57-62`

```python
@router.get("/students/", response_model=List[Student])
async def get_students_with_slash(current_user: UserInDB = Depends(get_current_user)):
    return await StudentService.get_all_students()  # Returns ALL students!
```

The `/students` endpoint (line 50) correctly returns only the user's students via `get_students_for_parent()`. But `/students/` (with trailing slash) calls `get_all_students()`, returning every student in the database.

**Impact:** Any authenticated user can see all students in the system by adding a trailing slash.

**Fix:** Change line 62 to `return await StudentService.get_students_for_parent(str(current_user.id))`.

---

### SEC-06: Bulk Deletion Endpoints Accessible by Non-Super-Admins
**Severity:** CRITICAL | **File:** `backend/app/routes/file_routes.py:326-487`

Three endpoints allow permanent deletion of **all** images from Cloudinary:
- `POST /migration/cleanup/delete-all-public` (line 326)
- `POST /migration/cleanup/delete-all-private` (line 377)
- `POST /migration/cleanup/delete-all-cloudinary` (line 428)

These use `is_admin_user()` (line 334), which allows regular admins. The only safety check is a hardcoded confirmation string.

**Impact:** A compromised admin account can permanently delete all student evidence with a single API call.

**Fix:** Either remove these endpoints entirely (they're migration tools), or restrict to `get_super_admin_user()` dependency with additional safeguards (email confirmation, cooling-off period).

---

### SEC-07: JWT Audience Verification Disabled
**Severity:** HIGH | **File:** `backend/app/services/supabase_service.py:55-60`

```python
payload = jwt.decode(
    token, supabase_jwt_secret, algorithms=["HS256"],
    options={"verify_aud": False}  # Audience NOT verified
)
```

**Impact:** Tokens from other Supabase projects sharing the same JWT secret are accepted.

**Fix:** Set `audience="authenticated"` and `options={"verify_aud": True}`.

---

### SEC-08: No Rate Limiting on Authentication Endpoints
**Severity:** HIGH | **File:** `backend/app/routes/auth.py`

Login and register endpoints have zero rate limiting. The Stripe checkout endpoint has rate limiting (5 req/hour), showing the pattern exists but wasn't applied to auth.

**Impact:** Unlimited brute-force password attempts, credential stuffing attacks.

**Fix:** Add rate limiting (e.g., 5 login attempts per 15 minutes per IP+email).

---

### SEC-09: Unvalidated Price ID in Checkout
**Severity:** HIGH | **File:** `backend/app/services/subscription_service.py:202-248`

The `create_checkout_session()` method accepts any `price_id` from the client without validating it against configured price IDs (`STRIPE_MONTHLY_PRICE_ID`, `STRIPE_ANNUAL_PRICE_ID`).

**Impact:** Users could potentially reference arbitrary Stripe price IDs.

**Fix:** Whitelist only `settings.stripe_monthly_price_id` and `settings.stripe_annual_price_id`.

---

### SEC-10: Missing File Upload Validation
**Severity:** HIGH | **File:** `backend/app/routes/learning_outcome_routes.py:265-330`

Evidence uploads accept ANY file type with NO size limit on the backend. Frontend has a 1.5MB limit, but this is trivially bypassed via direct API calls.

**Impact:** Malware uploads, storage exhaustion via multi-GB files, XSS via SVG uploads.

**Fix:** Add server-side file type whitelist (JPEG, PNG, WebP, GIF, PDF) with magic byte validation and a hard size limit (e.g., 50MB).

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

| # | Fix | Files | Priority |
|---|-----|-------|----------|
| 1 | Enable AI endpoint authentication | `ai_routes.py:15-17` | CRITICAL |
| 2 | Remove CORS wildcard regex | `settings.py:46` | CRITICAL |
| 3 | Hard-code `role = "parent"` on user creation | `auth_utils.py:55` | CRITICAL |
| 4 | Fix async authorization bypass | `file_storage_service.py:290-298` | CRITICAL |
| 5 | Fix trailing-slash student endpoint | `student_routes.py:57-62` | CRITICAL |
| 6 | Remove/restrict bulk deletion endpoints | `file_routes.py:326-487` | CRITICAL |
| 7 | Enable JWT audience verification | `supabase_service.py:55-60` | HIGH |
| 8 | Add rate limiting to auth endpoints | `auth.py` | HIGH |
| 9 | Validate Stripe price IDs | `subscription_service.py:202-248` | HIGH |
| 10 | Add file upload validation | `learning_outcome_routes.py:265-330` | HIGH |

### Phase 2: Important Fixes (Before paid customers)

| # | Fix | Files |
|---|-----|-------|
| 11 | Validate subscription status in feature checks | `subscription_service.py:159-168` |
| 12 | Fix bare exception handlers | Multiple service files |
| 13 | Standardize datetime usage | Multiple service files |
| 14 | Add AI call timeouts | `ai_service.py` |
| 15 | Fix report generation race condition | `report_service.py:190-199` |
| 16 | Add webhook idempotency | `subscription_service.py:348-401` |
| 17 | Fix imageUtils.js wrong port | `imageUtils.js:165` |
| 18 | Restrict grandfather endpoint | `stripe_routes.py:185-195` |
| 19 | Sanitize error messages | Multiple route files |
| 20 | Rotate exposed credentials | `.env.development` + credential providers |

### Phase 3: Code Quality (Ongoing)

| # | Fix | Impact |
|---|-----|--------|
| 21 | Split api.js into domain modules | Maintainability |
| 22 | Split ImageViewerModal | Maintainability |
| 23 | Consolidate curriculum mapping | Single source of truth |
| 24 | Delete dead code (ContentCreatePage_LEGACY) | Cleanliness |
| 25 | Add CSP headers | Defense-in-depth |
| 26 | Add audit logging | Compliance |
| 27 | Add DOMPurify for HTML rendering | XSS prevention |
| 28 | Fix missing prop-types dependency | Build reliability |
| 29 | Remove debug UI from production | Information disclosure |
| 30 | Implement token revocation mechanism | Session management |

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
