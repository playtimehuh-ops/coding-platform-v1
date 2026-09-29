import { readSession } from "../lib/auth.js";

const API = "https://api.github.com";
const API_VERSION = "2026-03-10";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

async function github(path, accessToken, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + accessToken,
      "X-GitHub-Api-Version": API_VERSION,
      "User-Agent": "coding-platform-v1",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { message: text }; }
  if (!response.ok) throw new Error(data.message || ("GitHub request failed (" + response.status + ")"));
  return data;
}

function validRepo(repo) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo);
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

export async function listRepositories(accessToken) {
  const repos = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await github(
      "/user/repos?per_page=100&page=" + page + "&sort=updated&direction=desc",
      accessToken
    );
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos.map(repo => ({
    full_name: repo.full_name,
    name: repo.name,
    private: repo.private,
    default_branch: repo.default_branch,
    description: repo.description || "",
    html_url: repo.html_url,
    language: repo.language || null
  }));
}

export async function collectRepository(repo, accessToken) {
  if (!validRepo(repo)) throw new Error("Invalid repository name.");

  const meta = await github("/repos/" + repo, accessToken);
  const tree = await github(
    "/repos/" + repo + "/git/trees/" + encodeURIComponent(meta.default_branch) + "?recursive=1",
    accessToken
  );

  const files = (tree.tree || [])
    .filter(item => item.type === "blob")
    .filter(item => !/(^|\/)(node_modules|\.git|dist|build|coverage|.next)(\/|$)/.test(item.path))
    .filter(item => /\.(js|jsx|ts|tsx|json|html|css|scss|md|py|go|rs|java|php|rb|vue|svelte|yml|yaml|sql|sh)$/i.test(item.path))
    .slice(0, 120);

  const important = files.filter(file =>
    /(^|\/)(package\.json|README\.md|tsconfig\.json|vite\.config\..*|next\.config\..*|requirements\.txt|pyproject\.toml|Cargo\.toml|go\.mod)$/i.test(file.path)
  );

  const selected = important.concat(
    files.filter(file => !important.some(item => item.path === file.path))
  ).slice(0, 40);

  const contents = await Promise.all(selected.map(async file => {
    const data = await github(
      "/repos/" + repo + "/contents/" + encodePath(file.path) +
      "?ref=" + encodeURIComponent(meta.default_branch),
      accessToken
    );
    if (data.encoding !== "base64" || typeof data.content !== "string") return null;

    const content = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
    return {
      path: file.path,
      sha: data.sha,
      size: content.length,
      content: content.slice(0, 16000)
    };
  }));

  return {
    repository: meta.full_name,
    branch: meta.default_branch,
    description: meta.description || "",
    language: meta.language || null,
    files: contents.filter(Boolean)
  };
}

async function updateFile(repo, path, content, sha, message, branch, accessToken) {
  if (!validRepo(repo)) throw new Error("Invalid repository name.");
  if (!path || path.length > 400 || path.startsWith("/") || path.includes("..")) {
    throw new Error("Invalid file path.");
  }

  return github(
    "/repos/" + repo + "/contents/" + encodePath(path),
    accessToken,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message,
        content: Buffer.from(content, "utf8").toString("base64"),
        sha,
        branch
      })
    }
  );
}

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "POST required." }, 405);

  try {
    const session = readSession(request);
    if (!session || !session.accessToken) return json({ error: "Sign in with GitHub first." }, 401);

    const body = await request.json();
    const action = body.action || "context";
    const repo = String(body.repo || "").trim();

    if (action === "repos") {
      return json({ repositories: await listRepositories(session.accessToken) });
    }

    if (action === "context") {
      return json(await collectRepository(repo, session.accessToken));
    }

    if (action === "apply") {
      const changes = Array.isArray(body.changes) ? body.changes : [];
      if (!changes.length || changes.length > 8) {
        return json({ error: "Provide 1-8 file changes." }, 400);
      }

      const branch = String(body.branch || "main").trim();
      const message = String(body.message || "chore: apply AI coding changes").trim();
      const results = [];

      for (const change of changes) {
        const result = await updateFile(
          repo,
          String(change.path),
          String(change.content),
          String(change.sha),
          message,
          branch,
          session.accessToken
        );

        results.push({
          path: change.path,
          commit: result.commit && result.commit.sha || null,
          content: result.content && result.content.sha || null
        });
      }

      return json({ ok: true, results });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    return json({ error: error.message || "GitHub operation failed." }, 500);
  }
}