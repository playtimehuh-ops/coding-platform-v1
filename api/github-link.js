import { decrypt, encrypt, readSession } from "../lib/auth.js";
import { getGithubConnection, removeGithubConnection, saveGithubConnection } from "../lib/db.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

async function githubUser(accessToken) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + accessToken,
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "coding-platform-v1"
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Could not verify the GitHub connection.");
  return data;
}

export default async function handler(request) {
  try {
    const session = readSession(request);
    if (!session) return json({ error: "Create a Codebase account first." }, 401);

    const action = new URL(request.url).searchParams.get("action") || "status";

    if (request.method === "GET" && action === "status") {
      const connection = await getGithubConnection(session.sub);
      return json({
        connected: Boolean(connection),
        github: connection ? {
          login: connection.login,
          avatar_url: connection.avatar_url || "",
          github_id: connection.github_id,
          connected_at: connection.connected_at
        } : null
      });
    }

    if (request.method === "POST" && action === "store") {
      const body = await request.json();
      const providerToken = String(body.providerToken || "");

      if (!providerToken) {
        return json({ error: "No GitHub provider token was supplied." }, 400);
      }

      const user = await githubUser(providerToken);

      await saveGithubConnection({
        user_id: session.sub,
        github_id: user.id,
        login: user.login,
        avatar_url: user.avatar_url || "",
        token_encrypted: encrypt(providerToken),
        updated_at: new Date().toISOString()
      });

      return json({
        ok: true,
        github: {
          login: user.login,
          avatar_url: user.avatar_url || "",
          github_id: user.id
        }
      });
    }

    if (request.method === "POST" && action === "unlink") {
      await removeGithubConnection(session.sub);
      return json({ ok: true });
    }

    return json({ error: "Unknown GitHub link action." }, 400);
  } catch (error) {
    return json({ error: error.message || "GitHub linking failed." }, 500);
  }
}