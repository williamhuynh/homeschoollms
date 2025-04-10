# Supabase Authentication Setup Guide

This guide explains how to set up and use Supabase authentication in the Homeschool LMS application.

## Overview

Supabase provides a robust authentication system with features like:
- Email/password authentication
- Social login (Google, Facebook, etc.)
- Magic link authentication
- Multi-factor authentication
- Password reset
- Email verification
- User management

## Setup Steps

### 1. Create a Supabase Project

1. Go to [Supabase](https://supabase.com/) and sign up or log in
2. Create a new project
3. Note your project URL and API keys (public anon key and secret key)

### 2. Configure Environment Variables

#### Frontend (.env.development and .env.production)

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### Backend (.env)

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_JWT_SECRET=your-jwt-secret
```

To get your JWT secret:
1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Scroll down to "JWT Settings"
4. Copy the JWT Secret

### 3. Migrate Existing Users (Optional)

If you have existing users in your MongoDB database, you can migrate them to Supabase using the provided migration script:

```bash
python -m backend.app.scripts.migrate_users_to_supabase
```

This script will:
1. Fetch all users from MongoDB
2. Create corresponding users in Supabase
3. Update MongoDB users with their Supabase IDs

After migration, users will need to reset their passwords to use Supabase authentication.

## Authentication Flow

### Sign Up

1. User enters email, password, and other required information
2. Frontend calls Supabase signUp method
3. Supabase creates the user and sends a confirmation email (if enabled)
4. User confirms their email (if required)
5. User can now sign in

### Sign In

1. User enters email and password
2. Frontend calls Supabase signIn method
3. Supabase verifies credentials and returns a session
4. Frontend stores the session
5. Backend verifies the session token for API requests

### Password Reset

1. User requests a password reset
2. Supabase sends a password reset email
3. User clicks the link in the email
4. User sets a new password

## Implementation Details

### Frontend

The frontend uses the Supabase JavaScript client to handle authentication:

```javascript
import { supabase } from '../services/supabase';

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    data: {
      first_name: 'John',
      last_name: 'Doe',
      role: 'parent'
    }
  }
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});

// Sign out
await supabase.auth.signOut();
```

### Backend

The backend verifies Supabase JWT tokens for API requests:

1. Frontend includes the Supabase session token in the Authorization header
2. Backend verifies the token using the Supabase JWT secret
3. If valid, the backend retrieves or creates the user in the MongoDB database
4. The request proceeds with the authenticated user

## Dual Authentication Support

The system supports both Supabase authentication and the legacy JWT authentication:

1. When a token is received, the backend first tries to verify it as a Supabase token
2. If that fails, it falls back to the legacy JWT verification
3. This allows for a smooth transition from the old authentication system to Supabase

## Troubleshooting

### Token Verification Issues

If you're having issues with token verification:

1. Check that your SUPABASE_JWT_SECRET is correct
2. Ensure the token is being sent in the Authorization header as a Bearer token
3. Check the token expiration (Supabase tokens expire after 1 hour by default)

### User Creation Issues

If users can't be created in Supabase:

1. Check that your SUPABASE_SERVICE_KEY is correct
2. Ensure email confirmations are configured correctly in Supabase
3. Check for any email delivery issues in the Supabase dashboard

## Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/auth-signup)
- [JWT Verification](https://supabase.com/docs/guides/auth/server-side-rendering)
