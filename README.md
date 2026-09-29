# Codebase — coding-platform-v1

A coding-only AI workspace for building, reviewing, and shipping software.

## Services

The deployment is intentionally kept to three configured service groups:
- **Supabase** — accounts, authentication, database, and GitHub OAuth configuration
- **OpenRouter** — all AI model traffic
- **Stripe** — subscriptions and billing

GitHub repository access uses the OAuth provider token returned by Supabase after a user links GitHub. No GitHub client ID or client secret is stored in this repository.

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

Only these deployment variables are required:

### Supabase
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` — safe to expose to the browser
- `SUPABASE_SECRET_KEY` — server only

### OpenRouter
- `OPENROUTER_API_KEY` — server only
- `OPENROUTER_MODEL` — optional; defaults to `openrouter/auto`

### Stripe
- `STRIPE_SECRET_KEY` — server only
- `STRIPE_WEBHOOK_SECRET` — server only
- `STRIPE_PRICE_BUILDER`
- `STRIPE_PRICE_TEAM`

Do **not** put the OpenRouter key, Stripe secret, Stripe webhook secret, or Supabase secret key in `index.html`.

Supabase documents publishable keys as browser-safe and secret keys as backend-only.

## Supabase setup

1. Run `supabase/schema.sql` in the Supabase SQL editor.
2. Enable Email authentication.
3. Configure the email verification and password recovery URLs for your deployed site.
4. Enable the **GitHub** provider in Supabase Authentication.
5. Put the GitHub OAuth application credentials into the **Supabase Dashboard**, not Vercel.
6. Enable manual identity linking so signed-in Codebase accounts can link GitHub.
7. Add your deployed site URL to Supabase's allowed redirect URLs.

Supabase supports linking GitHub to an existing signed-in identity with `linkIdentity`, and its OAuth flow can return a provider access token for server-side GitHub API work.

## OpenRouter setup

Create one OpenRouter API key and put it in Vercel as `OPENROUTER_API_KEY`.

Codebase sends agent and review requests to OpenRouter's OpenAI-compatible Chat Completions endpoint. Structured JSON output is used where the selected model supports it; Codebase requires the routed provider to honor the requested parameters. The default model is `openrouter/auto`.

## Stripe setup

Create recurring Stripe Prices for Builder and Team and set:
- `STRIPE_PRICE_BUILDER`
- `STRIPE_PRICE_TEAM`

Configure the webhook endpoint:
`https://YOUR-DOMAIN/api/stripe-webhook`

Set the Stripe signing secret in `STRIPE_WEBHOOK_SECRET` and the server secret key in `STRIPE_SECRET_KEY`.

## Deployment

1. Import `playtimehuh-ops/coding-platform-v1` into Vercel.
2. Add the environment variables above.
3. Deploy.
4. Configure GitHub inside Supabase.
5. Configure the Stripe webhook.
6. Open the site, create a Codebase account, then link GitHub.

Run local syntax checks with:

```bash
npm test
```

A static-only GitHub Pages deployment cannot execute the protected server functions required for accounts, OpenRouter, Stripe, Supabase persistence, and GitHub operations.

## Security notes

- The Supabase publishable key is intentionally public.
- Supabase secret, OpenRouter, and Stripe secrets stay on the server.
- GitHub OAuth application credentials live in Supabase.
- GitHub provider access tokens are encrypted before storage.
- Agent changes are proposed first and only applied after explicit approval.
- Repository contents are treated as untrusted model input.

## Product expansion

The architecture can grow into larger-context plans, higher usage limits, premium model routing, team workspaces, background jobs, isolated testing, analytics, and deeper GitHub automation. Revenue is not guaranteed and depends on costs, reliability, pricing, and demand.
