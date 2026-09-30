# Codebase — coding-platform-v1

A coding-only AI workspace for building, reviewing, and shipping software.

## Services

- Supabase — accounts, authentication, database, and GitHub OAuth configuration
- Cloudflare Workers + Workers AI — the keyless AI server
- Stripe — subscriptions and billing
- GitHub — repository access and Pull Requests

The AI server is deliberately separated from account/GitHub secrets. Codebase calls a public OpenAI-compatible endpoint hosted by a Cloudflare Worker. The Worker uses a Workers AI binding, so it does not store an AI provider API key in the repository or require users to provide one.

## Keyless AI server

The repository contains:

- worker/src/index.js — OpenAI-compatible AI server
- worker/wrangler.json — Workers AI binding configuration

The Worker exposes:

- GET /health
- GET /v1/models
- POST /v1/chat/completions

The current Worker model is @cf/zai-org/glm-4.7-flash.

Cloudflare currently provides Workers Free with 100,000 requests per day. Workers AI currently includes 10,000 free Neurons per day, with some models restricted on the Free plan. The selected model above is listed by Cloudflare as available on the Free plan.

## Deploying the keyless server

1. Create a free Cloudflare account.
2. Create a Worker from the worker directory.
3. Keep the AI binding from worker/wrangler.json.
4. Deploy the Worker.
5. Copy the resulting workers.dev URL.
6. Set that URL as CODEBASE_AI_SERVER_URL in the Codebase deployment.

CODEBASE_AI_SERVER_URL is only a server address. It is not an API key or secret.

No AI API key is required by the Worker.

## Fallback

Until CODEBASE_AI_SERVER_URL is configured, lib/ai.js can use the optional LLMFAUCET_BASE_URL fallback. Once the Cloudflare Worker URL is configured, the Codebase AI server is preferred automatically.

## Secrets

Do not put these into index.html:

- SUPABASE_SECRET_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET

The GitHub provider credentials stay in the Supabase dashboard.

The AI server itself does not need an AI provider API key.

## Product features

- Codebase account creation and login
- Email verification and password recovery
- Persistent sessions
- Optional GitHub repository integration
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
- Stripe subscription webhooks
- Supabase persistence