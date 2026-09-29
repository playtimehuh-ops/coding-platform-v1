# Codebase — coding-platform-v1

A coding-only AI workspace for working directly against GitHub repositories.

## What is functional

- GitHub OAuth sign-in with protected sessions
- Repository discovery for the signed-in account
- Repository file indexing and context collection
- AI coding proposals with structured file changes
- Visual patch previews
- Approved changes applied to a new branch
- Pull request creation for every approved AI change
- Persistent plan, subscription, and monthly usage data through Supabase
- Stripe subscription checkout and webhook synchronization
- Automated JavaScript syntax checks through GitHub Actions

## Architecture

Browser
  -> GitHub sign-in
  -> Repository explorer
  -> Code viewer
  -> Coding agent
  -> Vercel Functions
     -> GitHub API
     -> OpenAI Responses API
     -> Supabase REST API
     -> Stripe API

GitHub documents the repository Contents API for creating and updating files, with OAuth/workflow permissions relevant to repository writes. The app uses a branch + Pull Request write path so approved AI changes remain reviewable. citeturn582966search0turn582966search2

## Environment variables

Configure these in Vercel Project Settings -> Environment Variables.

GitHub:
- GITHUB_CLIENT_ID
- GITHUB_CLIENT_SECRET
- AUTH_SECRET

AI:
- OPENAI_API_KEY
- OPENAI_MODEL
- optionally OPENAI_BASE_URL

Persistence:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Billing:
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_PRICE_BUILDER
- STRIPE_PRICE_TEAM

Never place secrets in index.html, browser JavaScript, or GitHub commits.

## GitHub OAuth application

Create a GitHub OAuth App and use this callback URL:

https://YOUR-DOMAIN/api/auth?action=callback

The application requests:
repo workflow read:user user:email

The workflow scope is needed if the OAuth token is later used to modify files under .github/workflows. citeturn582966search0

## Supabase setup

Run supabase/schema.sql in the Supabase SQL editor, then set the two Supabase environment variables.

The server uses the Supabase REST API with the service role key. The browser does not talk directly to Supabase.

## Stripe setup

Create recurring Prices for Builder and Team and put their IDs in:
- STRIPE_PRICE_BUILDER
- STRIPE_PRICE_TEAM

Set the Stripe webhook endpoint to:

https://YOUR-DOMAIN/api/stripe-webhook

Subscribe it to:
- checkout.session.completed
- checkout.session.async_payment_succeeded
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted

Put the webhook secret into STRIPE_WEBHOOK_SECRET.

## Plans

The server-side limits are configured in config/plans.js:

| Plan | Price | Agent runs/month | Context files |
|---|---:|---:|---:|
| Free | $0 | 20 | 12 |
| Builder | $12 | 500 | 40 |
| Team | $29 | 2,000 | 80 |

## Security behavior

- OAuth state is validated before exchanging authorization codes.
- GitHub tokens are encrypted and stored inside signed HTTP-only sessions.
- Repository files are treated as untrusted input to the coding model.
- AI changes are proposals until the user presses Apply.
- Apply creates a separate branch and Pull Request instead of silently changing main.
- File paths are validated before writes.
- Provider credentials are server-only.
- Usage is checked before model execution when persistence is configured.

## Local development

Use a Node-compatible Vercel development environment:

npm run dev

Run syntax checks:

npm test

CI runs those checks on pushes to main and pull requests.

## Deployment note

This is intentionally a server-backed application. A static GitHub Pages deployment of index.html alone cannot provide OAuth token exchange, AI provider calls, Stripe webhooks, or protected GitHub writes.

Deploy the repository as a Vercel project (or another Node-compatible serverless host) and configure the environment variables there.
