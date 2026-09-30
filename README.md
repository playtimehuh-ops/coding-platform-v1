# Codebase — coding-platform-v1

A local-first AI coding workspace with global token accounts and optional paid plans.

## How it works

- Generate an account token. The token is the account.
- Use the same token on any browser or device.
- Open a project folder directly in the browser.
- Browse and edit your local source files.
- Ask the Code Agent for changes, explanations, refactors, tests, and fixes.
- Review proposed diffs before applying them locally.
- Export the project as JSON or download individual files.

## Account model

There is no username, email, or password system.

The account credential is a bearer token in the form `cb_…`. Keep it private. Possession of the token grants access to that account.

## GitHub

Codebase does not connect to GitHub. It does not import GitHub repositories, create branches, or create Pull Requests.

## Payment plans

The built-in plans are:

| Plan | Price | AI runs/month |
| --- | ---: | ---: |
| Free | $0 | 20 |
| Builder | $12/month | 500 |
| Team | $29/month | 2,000 |

Paid checkout uses Stripe Billing. The Stripe customer is associated with the global Codebase account ID derived from the account token, so no Codebase email/password account is needed.

Stripe Checkout is created server-side. The Stripe secret key is never placed in `index.html` or sent to the browser.

Stripe's Checkout API supports subscription mode and `client_reference_id`/metadata for associating a Checkout Session with an internal account identifier. citeturn752989view0

Codebase can look up the Stripe customer by its account metadata to restore the paid plan across browsers and devices. Stripe documents customer search using metadata queries; search may have propagation delay in some circumstances. citeturn719012view0

## Deployment

Deploy the repository normally to Vercel.

For paid plans, add this server-side environment variable:

`STRIPE_SECRET_KEY`

The AI layer itself uses the public keyless llmfaucet gateway and does not require an AI provider key.

