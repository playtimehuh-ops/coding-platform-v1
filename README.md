# Codebase — coding-platform-v1

A coding-only AI workspace for building, reviewing, and shipping software.

## Services

The deployment uses three configured service groups:
- **Supabase** — accounts, authentication, database, and GitHub OAuth configuration
- **Free AI gateway** — server-side keyless AI routing for the coding agent and reviews
- **Stripe** — subscriptions and billing

GitHub repository access uses the OAuth provider token returned by Supabase after a user links GitHub. No GitHub client ID or client secret is stored in this repository.

## Product features

- Codebase account creation and login
- Email verification and password recovery
- Persistent sessions
- Optional GitHub repository integration
- Repository discovery and file indexing
- Keyless free AI coding agent
- Automatic free coding-model routing
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

### Supabase
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` — safe to expose to the browser
- `SUPABASE_SECRET_KEY` — server only

### Free AI gateway
- `LLMFAUCET_BASE_URL` — optional; defaults to the configured public free gateway endpoint

There is **no user API-key field** in Codebase and no AI provider key is required in the repository or browser.

### Stripe
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_BUILDER`
- `STRIPE_PRICE_TEAM`

Do not put Stripe secrets or the Supabase secret key in `index.html`.

## Supabase setup

1. Run `supabase/schema.sql` in the Supabase SQL editor.
2. Enable Email authentication.
3. Configure the email verification and password recovery URLs for your deployed site.
4. Enable the **GitHub** provider in Supabase Authentication.
5. Put the GitHub OAuth application credentials into the **Supabase Dashboard**, not Vercel.
6. Enable manual identity linking so signed-in Codebase accounts can link GitHub.
7. Add your deployed site URL to Supabase's allowed redirect URLs.

## Free AI setup

No AI API key is required. Codebase calls the centralized `lib/ai.js` adapter from protected server functions. The adapter uses an OpenAI-compatible chat-completions interface and keeps the provider out of the browser.

The available UI routing choices are:
- Free · Coding
- Free · Auto
- Free · Smart
- Free · Fast

Free-provider availability and limits can change, so the application treats provider failures as normal service errors rather than promising unlimited inference.

## Stripe setup

Create recurring Stripe Prices for Builder and Team and set:
- `STRIPE_PRICE_BUILDER`
- `STRIPE_PRICE_TEAM`

Configure the webhook endpoint:
`https://YOUR-DOMAIN/api/stripe-webhook`

Set the Stripe signing secret in `STRIPE_WEBHOOK_SECRET` and the server secret key in `STRIPE_SECRET_KEY`.

## Deployment

1. Import `playtimehuh-ops/coding-platform-v1` into Vercel.
2. Add the Supabase environment variables and Stripe variables you actually use.
3. Optionally set `LLMFAUCET_BASE_URL` if you need to change the gateway endpoint.
4. Deploy.
5. Configure GitHub inside Supabase.
6. Configure the Stripe webhook if paid plans are enabled.
7. Open the site, create a Codebase account, then link GitHub.

Run local syntax checks with:

```bash
npm test
```

A static-only GitHub Pages deployment cannot execute the protected server functions required for accounts, AI routing, Stripe, Supabase persistence, and GitHub operations.

## Security notes

- The Supabase publishable key is intentionally public.
- Supabase secret and Stripe secrets stay on the server.
- No AI provider credential is exposed to users.
- GitHub OAuth application credentials live in Supabase.
- GitHub provider access tokens are encrypted before storage.
- Agent changes are proposed first and only applied after explicit approval.
- Repository contents are treated as untrusted model input.

## Product expansion

The architecture can grow into larger-context plans, higher usage limits, team workspaces, background jobs, isolated testing, analytics, and deeper GitHub automation. Revenue is not guaranteed and depends on costs, reliability, pricing, and demand.
