# Codebase — coding-platform-v1

A coding-only AI workspace for building, reviewing, and shipping software.

## Architecture

- Supabase — accounts, authentication, database, and GitHub OAuth
- Vercel API routes — Codebase's server-side AI layer
- llmfaucet — keyless free AI inference
- Stripe — subscriptions and billing
- GitHub — repository access and Pull Requests

Codebase does not require users to enter an AI API key.

The AI calls happen server-side through `/api/chat` and `/api/review`. The browser never receives an AI provider secret.

## Keyless AI

The default AI gateway is a public OpenAI-compatible endpoint that supports anonymous/keyless requests. Codebase uses the server-side `lib/ai.js` adapter and the existing Vercel API routes.

No separate Cloudflare account, Worker deployment, AI server URL, or AI API key is required.

## Deployment

Deploy the repository normally to Vercel. Configure the existing Supabase and Stripe environment variables when those features are enabled. The AI layer itself needs no provider configuration.

## Secrets

Never put these into `index.html`:

- `SUPABASE_SECRET_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

GitHub OAuth credentials remain in the Supabase dashboard.

## Product features

- Codebase account creation and login
- Email verification and password recovery
- Persistent sessions
- GitHub repository integration
- Repository discovery and file indexing
- Keyless AI coding agent
- Structured coding changes and diff previews
- Apply approved changes to a new GitHub branch
- Automatic Pull Request creation
- AI code review
- File downloads
- Repository ZIP downloads
- AI patch downloads
- Plan limits and monthly usage
- Stripe Checkout and billing portal
- Supabase persistence