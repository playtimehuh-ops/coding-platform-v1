# Codebase — coding-platform-v1

A local-first AI coding workspace.

## How it works

- Open a project folder directly in the browser.
- Browse and edit your local source files.
- Ask the Code Agent for changes, explanations, refactors, tests, and fixes.
- Review proposed diffs before applying them locally.
- Export the project as JSON or download individual files.
- The selected project context is sent to the server only when you press the AI action.

## No account or GitHub

Codebase has no account creation screen and no login flow.

Codebase does not connect to GitHub, does not import GitHub repositories, and does not create branches or Pull Requests.

The workspace is local to the browser and is also saved in localStorage for convenience.

## AI

The AI layer is server-side through `/api/chat` and `/api/review`, using the public keyless llmfaucet gateway.

There is no AI API key or AI endpoint setting in the project.

## Deployment

Deploy the repository normally to Vercel.

No application secrets are required for local mode.

## Local controls

Use Chromium-based browsers for the best folder access support. Codebase uses the browser File System Access API when available and falls back to a directory file picker.

