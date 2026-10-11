# Kernel — Linux server maker

This is a real Docker-backed Linux container manager with a browser shell. It is not a cloud compute provider by itself.

## Important: 24/7 compute

A Vercel deployment serves the dashboard, but Vercel functions are not persistent VPS hosts and cannot keep arbitrary Linux containers running forever. For 24/7 servers, run the host agent on a Linux machine that stays powered on. If you need publicly available 24/7 servers, that host must be an always-on machine/server from a provider or hardware you control. This repository does not create free compute credits or bypass provider limits.

## Run the host agent on a Linux machine

Requirements: Linux, Docker Engine, Node.js 20+, and a host that remains online. The agent must be able to access the local Docker daemon.

1. Install Docker Engine and Node.js 20+ on the Linux host.
2. From this directory, run:
   ```sh
   cd agent
   npm install
   export KERNEL_AGENT_TOKEN="$(openssl rand -hex 32)"
   npm start
   ```
3. Put the agent behind HTTPS using a reverse proxy such as Caddy or Nginx. Forward WebSocket upgrades for `/terminal` as well as HTTP requests. Do not expose an unauthenticated Docker socket.
4. In the dashboard, set the host URL to the HTTPS URL and enter the same `KERNEL_AGENT_TOKEN`.

For local testing only, `http://localhost:8080` can be used from a dashboard running in the same browser machine; browsers may block insecure mixed-content requests if the dashboard is HTTPS.

## What works

- Health check and authenticated server listing.
- Create real Debian containers with Docker CPU, memory, process-count and privilege limits.
- Delete only containers carrying the agent's management label.
- Open a real interactive Bash shell over WebSocket.
- Containers restart after a Docker/host restart via Docker's `unless-stopped` policy.

## Security and operations

- Use a strong random token and HTTPS; rotate the token if it is exposed.
- The agent has access to the Docker daemon, which is effectively host-root access. Run it only on a dedicated host and protect the API with a firewall / reverse proxy.
- Do not give this agent to untrusted users as-is. Before public multi-user launch, add real user authentication, per-user authorization, quotas, audit logs, abuse controls, and a hardened network design.
- Inbound ports are not published by default. Containers have outbound networking; manage inbound exposure separately.
- The dashboard keeps the token in the current tab's session storage and does not send it to Vercel.
- The dashboard currently connects directly to your host agent. CORS should be configured at your reverse proxy to allow only your dashboard origin.

## Resource profiles

- Small: 512 MB RAM, 0.5 CPU
- Standard: 1 GB RAM, 1 CPU
- Large: 2 GB RAM, 2 CPU

These are Docker limits, not guaranteed resources. The host must have enough free capacity.