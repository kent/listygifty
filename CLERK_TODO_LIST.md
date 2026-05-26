# Clerk Authentication

## Environment Variables

The following environment variables need to be set in `apps/web/.env.local` and your deployment environment:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

## Dashboard Setup

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Create a new application
3. Enable the following authentication methods in **User & Authentication > Email, Phone, Username**:
   - Email
   - SMS
4. Enable the following Social Login providers in **User & Authentication > Social Connections**:
   - Google
   - Apple
5. Copy the Publishable Key and Secret Key to your `.env.local` file.
6. Set up the **JWT Template** if you need custom claims, though Listy Gifty currently uses the default Clerk session token.

## Backend Setup

The Rails backend verifies the Clerk session token using the `clerk-sdk-ruby` gem. No extra configuration is strictly needed on the backend if you are using the standard keys, but ensure `CLERK_SECRET_KEY` is available to the Rails app if the SDK requires it (usually it fetches JWKS public keys).

Note: the Listy Gifty API verifies tokens by fetching JWKS from Clerk.
