# Codebase — coding-platform-v1

A coding-only AI workspace for building, reviewing, and shipping software.

## Services

The deployment is intentionally kept to three configured external services:
- **Supabase** — accounts, authentication, database, and GitHub OAuth configuration
- **OpenRouter** — all AI model traffic
- **Stripe** — subscriptions and billing

GitHub repository access is performed with the OAuth provider token returned by Supabase after a user links GitHub. No GitHub client ID or client secret is stored in this repository.

## Product features

- Codebase account creation and login
- Email verification and password recovery
- Persistent sessions
- Optional GitHub repository integration
- Repository discovery and file indexing
- OpenRouter-powered coding agent
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

## Environment variables

Only these server-side secrets/configuration values are required:

### Supabase
`SUPABASE_URL`  
`SUPABASE_PUBLISHABLE_KEY` — safe to expose to the browser  
`SUPABASE_SECRET_KEY` — server only

### OpenRouter
`OPENROUTER_API_KEY` — server only  
`OPENROUTER_MODEL` — optional, defaults to `openrouter/auto`

### Stripe
`STRIPE_SECRET_KEY` — server only  
`STRIPE_WEBHOOK_SECRET` — server only  
`STRIPE_PRICE_BUILDER`  
`STRIPE_PRICE_TEAM`

Do not put OpenRouter, Stripe secret, or Supabase secret keys in `index.html`.

## Supabase setup

1. Run `supabase/schema.sql` in the Supabase SQL editor.
2. Enable Email authentication.
3. Configure the email verification and password recovery URLs for your deployed site.
4. Enable the **GitHub** provider in Supabase Authentication.
5. Put the GitHub OAuth application credentials into the **Supabase Dashboard**, not into Vercel environment variables.
6. Enable manual identity linking in the Supabase Authentication settings so a signed-in Codebase account can link GitHub.
7. Add your deployed site URL to Supabase's allowed redirect URLs.

The browser uses only the Supabase publishable key. Supabase documents publishable keys as public/browser-safe and secret keys as backend-only. citeturn578856search1turn578856search2

## OpenRouter setup

Create one OpenRouter API key and put it in Vercel as `OPENROUTER_API_KEY`.

Codebase sends coding requests to OpenRouter's OpenAI-compatible Chat Completions endpoint and uses structured JSON output for coding proposals and reviews. The default model is `openrouter/auto`; you can override it with `OPENROUTER_MODEL`. OpenRouter's current documentation supports the Chat Completions endpoint and structured outputs for compatible models. citeturn228607search0turn228607search2turn228607search4

## Stripe setup

Create recurring Stripe Prices for Builder and Team and set their IDs in:
- `STRIPE_PRICE_BUILDER`
- `STRIPE_PRICE_TEAM`

Configure the webhook endpoint:
`https://YOUR-DOMAIN/api/stripe-webhook`

Then put the webhook signing secret in `STRIPE_WEBHOOK_SECRET` and the Stripe secret key in `STRIPE_SECRET_KEY`.

## Deployment

Deploy the repository to Vercel or another Node-compatible serverless host.

1. Import `playtimehuh-ops/coding-platform-v1`.
2. Add the environment variables above in the deployment settings.
3. Deploy.
4. In Supabase, configure the GitHub provider and redirect URL.
5. In Stripe, configure the webhook endpoint.
6. Open the deployed site, create a Codebase account, and link GitHub.

Run local syntax checks with:
`npm test`

A static-only GitHub Pages deployment cannot execute the protected server functions required for accounts, OpenRouter, Stripe, Supabase persistence, and GitHub operations.

## Security notes

- The Supabase publishable key is intentionally public.
- The Supabase secret key, OpenRouter key, and Stripe secret/webhook key stay on the server.
- GitHub OAuth credentials are held by Supabase.
- GitHub provider access tokens are encrypted before being stored in Supabase.
- Agent changes are proposed first and only applied after explicit user approval.
- Repository contents are treated as untrusted model input.

## Product expansion

The current architecture can grow into paid developer features such as larger context, higher agent limits, premium model routing, team workspaces, background jobs, isolated testing, analytics, and deeper GitHub automation. Revenue is not guaranteed and depends on costs, reliability, pricing, and demand.
