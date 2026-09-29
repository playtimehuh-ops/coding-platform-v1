# Codebase — coding-platform-v1

A coding-only AI workspace where users create a Codebase account, optionally link GitHub, ask an AI agent to modify repositories, review the proposed diff, and open a Pull Request.

## Functional product

- Codebase email/password account creation and login
- Email verification completion flow
- Password recovery and password change
- Signed, encrypted, expiring HTTP-only sessions
- Optional GitHub repository connection
- Repository discovery, file inspection and context collection
- AI coding tasks with structured proposals
- AI code review mode
- Download individual files
- Download repository ZIP
- Download generated AI patches
- Explicit Apply -> branch -> commit -> Pull Request
- Persistent monthly usage and subscription state through Supabase
- Stripe subscription checkout, cancellation state synchronization and billing portal
- Free / Builder / Team plan limits
- GitHub Actions syntax checks

## Architecture

Browser
  -> Codebase account
  -> optional GitHub connection
  -> repository explorer
  -> coding agent
  -> Vercel Functions
     -> GitHub
     -> Supabase Auth + database
     -> OpenAI
     -> Stripe

Supabase Auth supports email/password signup and password sign-in, and can require email confirmation before a session is issued. citeturn642296search0turn642296search1

## Environment

Set these in Vercel:

Account auth:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- AUTH_SECRET

AI:
- OPENAI_API_KEY
- OPENAI_MODEL
- optional OPENAI_BASE_URL

GitHub integration:
- GITHUB_CLIENT_ID
- GITHUB_CLIENT_SECRET

Billing:
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_PRICE_BUILDER
- STRIPE_PRICE_TEAM

Never put service-role, GitHub client secrets, Stripe secrets, or AI API keys into browser files.

## GitHub integration

GitHub is not the Codebase login system. A signed-in user can optionally link GitHub when they want repository access.

Callback URL:

https://YOUR-DOMAIN/api/github-link?action=callback

The linked OAuth token is encrypted server-side and stored in the GitHub connection record.

## Supabase setup

Run:

supabase/schema.sql

in the Supabase SQL editor.

Supabase Auth is the credential system; the public users table stores app profile data, subscriptions store plan state, usage stores monthly runs, and github_connections stores the encrypted repository integration token.

## Stripe setup

Create recurring Prices for Builder and Team.

Set:
- STRIPE_PRICE_BUILDER
- STRIPE_PRICE_TEAM

Set the webhook endpoint to:

https://YOUR-DOMAIN/api/stripe-webhook

Subscribe to:
- checkout.session.completed
- checkout.session.async_payment_succeeded
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted

The billing portal endpoint is available from the Account panel.

## Current plans

| Plan | Price | Agent runs/month | Context files |
|---|---:|---:|---:|
| Free | $0 | 20 | 12 |
| Builder | $12 | 500 | 40 |
| Team | $29 | 2,000 | 80 |

Plan limits live in config/plans.js.

## Coding flow

1. User creates or logs into a Codebase account.
2. User links GitHub.
3. User selects a repository.
4. The server indexes relevant repository files.
5. The AI produces a structured proposal.
6. Codebase renders the patch.
7. User explicitly applies the proposal.
8. Codebase creates a branch, writes the approved files and opens a Pull Request.

The write path does not silently modify the default branch.

## Downloads

The workspace supports:
- Download current file
- Download repository ZIP
- Download the AI-generated patch

## Security

- Password authentication is delegated to Supabase Auth rather than storing raw passwords.
- Supabase documents bcrypt-based password hashing for its Auth service. citeturn642296search3
- Account sessions are signed and encrypted with server-only AUTH_SECRET.
- Sessions expire after seven days.
- OAuth state is checked for GitHub linking.
- GitHub access tokens are encrypted at rest in the application database.
- AI sees repository files as untrusted content.
- AI changes stay proposals until explicitly applied.
- Provider secrets remain server-side.
- Usage is checked before model execution when persistence is configured.

## Deployment

This is a server-backed application. GitHub Pages can host static files, but the account, AI, Stripe and protected GitHub features require a Node-compatible serverless deployment.

Recommended deployment target:
- Vercel

Run locally with:

npm run dev

Run syntax checks with:

npm test

The GitHub Actions workflow runs the smoke syntax check on pushes to main and on pull requests.

## Revenue-oriented product pieces already present

- Subscription plans
- Usage metering
- Paid model access
- Team tier
- Billing portal
- AI code review
- Repository downloads
- Pull Request workflow

These are product mechanisms, not a guarantee of revenue; pricing, distribution, operating costs, model costs, and retention determine whether the business makes money.
