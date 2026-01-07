# Subscription System Setup Guide

This guide explains how to set up and configure the Stripe subscription system for the Homeschool LMS application.

## Overview

The subscription system provides two tiers with a 14-day free trial for the Basic plan:

| Feature | Free Tier | Basic Tier ($10/mo or $108/yr) |
|---------|-----------|-------------------------------|
| Free Trial | N/A | **14 days** |
| Students | 1 | 3 |
| Evidence Uploads | 15 | 1,000 |
| Report Generation | ❌ | ✅ |
| Progress Tracking | ✅ | ✅ |
| Curriculum Alignment | ✅ | ✅ |

### New Features (v2)

✅ **14-day free trial** - No payment required upfront
✅ **Webhook retry logic** - Automatic recovery from processing failures
✅ **Payment failure notifications** - In-app alerts when payments fail
✅ **Subscription expiry warnings** - Alerts 7 days before subscription ends
✅ **Trial ending alerts** - Notifications 3 days before trial expires
✅ **Rate limiting** - Protection against checkout session spam (5/hour per user)
✅ **Idempotency keys** - Prevents duplicate charges
✅ **Usage indicators** - Proactive warnings at 80% of evidence limit

## Stripe Setup

### 1. Create a Stripe Account

1. Go to [stripe.com](https://stripe.com) and create an account
2. Complete the account verification process

### 2. Create Products and Prices

In the Stripe Dashboard:

1. Go to **Products** → **Add Product**
2. Create a product called "Basic Plan"
3. Add two prices:
   - **Monthly**: $10.00 USD, recurring monthly
   - **Annual**: $108.00 USD, recurring yearly (saves 15%)

4. Note down the Price IDs (start with `price_`)

### 3. Configure Customer Portal

1. Go to **Settings** → **Billing** → **Customer Portal**
2. Enable the portal
3. Configure allowed actions:
   - ✅ Update payment methods
   - ✅ View invoices
   - ✅ Cancel subscriptions
   - ✅ Switch plans

### 4. Set Up Webhooks

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://your-api-domain.com/api/stripe/webhook`
4. Select these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

5. Copy the **Webhook Signing Secret** (starts with `whsec_`)

### 5. Get API Keys

1. Go to **Developers** → **API Keys**
2. Copy your **Secret Key** (starts with `sk_`)
3. For production, use the live keys; for testing, use test keys

## Backend Configuration

Add these environment variables to your backend `.env`:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
STRIPE_MONTHLY_PRICE_ID=price_your-monthly-price-id
STRIPE_ANNUAL_PRICE_ID=price_your-annual-price-id

# Frontend URL for redirects
FRONTEND_URL=https://your-frontend-domain.com
```

## Grandfathering Existing Users

To give existing users Basic tier features for free:

### Option 1: API Endpoint (Recommended)

Call the admin endpoint (requires admin authentication):

```bash
POST /api/stripe/grandfather-users
Authorization: Bearer <admin-token>
```

### Option 2: Migration Script

Run the migration script:

```bash
cd backend
python scripts/grandfather_users.py
```

This will:
1. Mark all existing users as `is_grandfathered: true`
2. They keep `subscription_tier: "free"` but get Basic tier limits
3. Log the migration to `system_logs` collection

## How It Works

### Subscription Flow

1. User clicks "Upgrade" on pricing page
2. Frontend calls `POST /api/stripe/checkout/session`
3. Backend creates Stripe Checkout session
4. User is redirected to Stripe's hosted checkout
5. After payment, user returns to `/subscription?success=true`
6. Stripe webhook updates user's subscription status

### Managing Subscriptions

1. User clicks "Manage Subscription" on profile/subscription page
2. Frontend calls `POST /api/stripe/portal/session`
3. User is redirected to Stripe Customer Portal
4. User can update payment, cancel, or change plans
5. Stripe webhook updates user's subscription status

### Feature Gating

The subscription system checks limits at these points:

| Action | Check | Location |
|--------|-------|----------|
| Add Student | `can_add_student` | `/api/students/` POST |
| Upload Evidence | `can_add_evidence` | `/api/evidence/` POST |
| Generate Report | `can_generate_reports` | `/api/reports/{id}/generate` POST |

## Frontend Integration

### User Context

The `UserContext` provides subscription helpers:

```jsx
const {
  subscription,          // Current subscription data
  usage,                 // Usage stats (student_count, evidence_count)
  canAddStudent,         // () => boolean
  canAddEvidence,        // () => boolean
  canGenerateReports,    // () => boolean
  isFreeTier,            // () => boolean
  isGrandfathered,       // () => boolean
  getEffectiveTier,      // () => 'free' | 'basic'
} = useUser()
```

### Upgrade Prompts

Use the `UpgradePrompt` components:

```jsx
import { UpgradeBanner, UpgradeModal } from '../components/subscription/UpgradePrompt'

// Inline banner
<UpgradeBanner 
  message="You've reached your limit"
  feature="more students"
  variant="warning" // or "info" or "premium"
/>

// Modal for blocking actions
<UpgradeModal 
  isOpen={isOpen}
  onClose={onClose}
  title="Upgrade Required"
  message="Custom message here"
/>
```

## Testing

### Test Mode

Use Stripe test mode with test API keys:
- Secret key: `sk_test_...`
- Use test card number: `4242 4242 4242 4242`
- Any future expiry date, any CVC

### Test Webhooks Locally

Use [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe listen --forward-to localhost:8000/api/stripe/webhook
```

Copy the webhook signing secret it provides.

## Database Schema

### Users Collection

Users get these subscription-related fields:

```json
{
  "subscription_tier": "free",          // "free" | "basic"
  "subscription_status": "active",      // "active" | "canceled" | "past_due" | "trialing"
  "stripe_customer_id": "cus_xxx",      // Stripe customer ID
  "stripe_subscription_id": "sub_xxx",  // Stripe subscription ID
  "current_period_end": "2025-01-01",   // Subscription end date
  "trial_end": "2025-01-15",           // Trial end date (new in v2)
  "is_grandfathered": false             // True for early adopters
}
```

### Webhook Events Collection (New in v2)

Logs all webhook events for debugging and retry:

```json
{
  "event_type": "customer.subscription.updated",
  "event_id": "evt_xxx",
  "data": { ... },                     // Full Stripe event data
  "success": true,                      // Processing status
  "error": null,                        // Error message if failed
  "processed_at": "2025-01-01T12:00:00Z",
  "retry_count": 0
}
```

### Notifications Collection (New in v2)

In-app notifications for users:

```json
{
  "user_id": ObjectId("xxx"),
  "type": "payment_failed",             // "payment_failed" | "subscription_expiring"
  "title": "Payment Failed",
  "message": "Your recent payment failed...",
  "link": "/subscription",
  "read": false,
  "created_at": "2025-01-01T12:00:00Z",
  "metadata": {
    "invoice_id": "in_xxx",
    "days_remaining": 7
  }
}
```

## Troubleshooting

### Webhook Not Receiving Events

1. Check webhook endpoint URL is correct
2. Verify webhook signing secret matches
3. Check server logs for signature verification errors
4. Ensure your server is publicly accessible (use ngrok for local dev)

### User Stuck on Free Tier After Payment

1. Check Stripe dashboard for successful payment
2. Check server logs for webhook processing
3. Verify `user_id` is in subscription metadata
4. Manually update user in database if needed

### Grandfathered Users Not Getting Basic Features

1. Verify `is_grandfathered: true` in user document
2. Check `getEffectiveTier()` returns "basic"
3. Clear frontend cache and re-fetch user data
