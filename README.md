# Codebase — coding-platform-v1

A coding-only AI workspace for building, reviewing, and shipping software.

## Services

The deployment is intentionally kept to three external service groups:
- Supabase — accounts, authentication, database, and GitHub identity linking
- OpenRouter — all AI model traffic through one API
- Stripe — subscriptions and billing

## Product features

- Codebase account creation and login
- Email verification and password recovery
- Persistent account sessions
- Optional GitHub connection through Supabase
- Repository discovery and file indexing
- OpenRouter-powered coding agent
- Structured coding changes and diff previews
- Apply changes to a new GitHub branch
- Automatic Pull Request creation
- AI code review
- File downloads
- Repository ZIP downloads
- AI patch downloads
- Plan limits and monthly usage
- Stripe checkout and billing portal
- Stripe subscription webhooks
- Supabase persistence
- GitHub Actions syntax checks

## Environment variables

### Supabase
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

### OpenRouter
OPENROUTER_API_KEY
OPENROUTER_FREE_MODEL
OPENROUTER_BUILDER_MODEL
OPENROUTER_TEAM_MODEL
APP_URL

### Stripe
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_BUILDER
STRIPE_PRICE_TEAM

### Application session
AUTH_SECRET

AUTH_SECRET is an application-owned signing/encryption secret, not another external service.

## Supabase setup

1. Run `supabase/schema.sql` in the Supabase SQL editor.
2. Enable email/password authentication.
3. Configure your email verification and password recovery URLs.
4. Enable the GitHub provider in Supabase Authentication.
5. Enable manual identity linking if required by your Supabase project.
6. Configure the GitHub OAuth application credentials inside Supabase Dashboard rather than this repository.

## OpenRouter setup

Create one OpenRouter API key and set `OPENROUTER_API_KEY`.

The default free model is `openrouter/free`. Builder and Team can use dedicated OpenRouter model slugs through their environment variables.

## Stripe setup

Create recurring Prices for Builder and Team and set:
- `STRIPE_PRICE_BUILDER`
- `STRIPE_PRICE_TEAM`

Configure the Stripe webhook endpoint as:
`https://YOUR-DOMAIN/api/stripe-webhook`

Set its signing secret as `STRIPE_WEBHOOK_SECRET`.

## Deployment

Deploy the repository to Vercel or another Node-compatible serverless host.

Run locally:
`npm run dev`

Run syntax checks:
`npm test`

A static-only GitHub Pages deployment cannot execute the protected server functions needed for account auth, OpenRouter, Stripe, Supabase, and GitHub operations.

## Product expansion

The architecture leaves room for premium features such as larger context, higher agent limits, premium model routing, team workspaces, background coding jobs, isolated test execution, usage analytics, and deeper GitHub automation.

These features can support a paid developer product, but revenue is not guaranteed and depends on costs, reliability, pricing, and user demand.