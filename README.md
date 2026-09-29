# Codebase — coding-platform-v1

A coding-only AI workspace built around GitHub repositories.

## Product

Codebase is designed around a simple loop:

1. Sign in with GitHub.
2. Pick a repository.
3. Ask the coding agent for a change.
4. The server reads repository context.
5. The AI returns a structured proposal with complete file replacements.
6. The UI renders the proposed diff.
7. You explicitly Apply the change.
8. GitHub receives the commit.

The browser never receives the GitHub OAuth client secret or AI provider key.

## Architecture

```
Browser
  ├─ GitHub OAuth session
  ├─ Repository explorer
  ├─ Code viewer
  └─ Coding agent UI
          │
          ▼
      Vercel Functions
      ├─ /api/auth      GitHub OAuth + signed/encrypted session
      ├─ /api/github    user-scoped GitHub read/write operations
      ├─ /api/chat      repository-aware AI coding agent
      ├─ /api/billing   Stripe Checkout session creation
      └─ /api/health    deployment health check
          │
          ├──────────────► GitHub API
          ├──────────────► OpenAI Responses API
          └──────────────► Stripe Checkout
```

OpenAI's current platform documentation shows the Responses API as the server-side text-generation interface, and its model catalog lists GPT-5.3-Codex as a specialized coding model. citeturn931081search0turn740558search1

Stripe Checkout supports server-created subscription Sessions using `mode=subscription` and a recurring Price. citeturn935575search0turn935575search2

## Vercel environment variables

Copy `.env.example` into your own local environment or configure the same values in your Vercel project.

Required for GitHub sign-in:
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `AUTH_SECRET`

Required for the coding agent:
- `OPENAI_API_KEY`

Optional:
- `OPENAI_MODEL` (defaults to `gpt-5.3-codex`)
- `OPENAI_BASE_URL` (useful for an OpenAI-compatible provider)
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_BUILDER`
- `STRIPE_PRICE_TEAM`

Never put provider secrets in `index.html` or another browser-delivered file.

## GitHub OAuth callback

Create a GitHub OAuth app and set its callback URL to:

`https://YOUR-DOMAIN/api/auth?action=callback`

The OAuth flow requests repository access plus basic user identity so the signed-in account can work with its repositories.

## Billing

The repository contains a server-side Checkout creator and plan configuration.

The current plans are intentionally configuration-driven:
- Free — 20 agent runs/month
- Builder — 500 agent runs/month
- Team — 2,000 agent runs/month

The next persistence layer should store Stripe customer/subscription IDs and usage counters in a real database. The UI and checkout endpoint are already separated so that database can be added without replacing the workspace.

## Security model

- GitHub access tokens are encrypted before being stored in the HTTP-only signed session cookie.
- Sessions are signed with HMAC and expire after seven days.
- OAuth state is checked before exchanging the authorization code.
- The AI can propose changes, but the write operation is a separate explicit Apply request.
- Repository files are treated as untrusted input to the AI.
- File paths are validated before GitHub writes.
- Provider secrets are server-only environment variables.

## Roadmap

- Streaming model output
- Larger, smarter repository indexing
- Branch-first changes and pull requests
- Test execution in an isolated runner
- Persistent usage accounting
- Stripe webhook + subscription state
- Multiple model/provider adapters
- Team workspaces and permissions
- Background agent tasks
