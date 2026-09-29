import { readSession } from "../lib/auth.js";

const API = "https://api.github.com";
const API_VERSION = "2026-03-10";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function validRepo(repo) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo);
}

function safeBranch(value) {
  return /^[A-Za-z0-9._/-]{1,200}$/.test(value) && !value.includes("..");
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
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

  if (!response.ok) {
    const error = new Error(data.message || ("GitHub request failed (" + response.status + ")"));
    error.status = response.status;
    throw error;
  }

  return data;
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

export async function collectRepository(repo, accessToken, maxFiles = 40) {
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
    .slice(0, 160);

  const important = files.filter(file =>
    /(^|\/)(package\.json|README\.md|tsconfig\.json|vite\.config\..*|next\.config\..*|requirements\.txt|pyproject\.toml|Cargo\.toml|go\.mod)$/i.test(file.path)
  );

  const selected = important.concat(
    files.filter(file => !important.some(item => item.path === file.path))
  ).slice(0, maxFiles);

  const loaded = await Promise.all(selected.map(async file => {
    try {
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
        content: content.slice(0, 8000)
      };
    } catch {
      return null;
    }
  }));

  const contents = [];
  let total = 0;
  for (const file of loaded.filter(Boolean)) {
    if (total + file.content.length > 120000) break;
    contents.push(file);
    total += file.content.length;
  }

  return {
    repository: meta.full_name,
    branch: meta.default_branch,
    description: meta.description || "",
    language: meta.language || null,
    files: contents,
    context_chars: total
  };
}

async function getRef(repo, branch, accessToken) {
  return github(
    "/repos/" + repo + "/git/ref/heads/" + encodeURIComponent(branch),
    accessToken
  );
}

async function createBranch(repo, baseBranch, newBranch, accessToken) {
  const ref = await getRef(repo, baseBranch, accessToken);
  return github("/repos/" + repo + "/git/refs", accessToken, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ref: "refs/heads/" + newBranch,
      sha: ref.object.sha
    })
  });
}

async function updateFile(repo, path, content, sha, message, branch, accessToken) {
  if (!path || path.length > 400 || path.startsWith("/") || path.includes("..")) {
    throw new Error("Invalid file path: " + path);
  }

  const body = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch
  };
  if (sha) body.sha = sha;

  return github("/repos/" + repo + "/contents/" + encodePath(path), accessToken, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function createPullRequest(repo, head, base, title, body, accessToken) {
  return github("/repos/" + repo + "/pulls", accessToken, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title, head, base, body })
  });
}

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "POST required." }, 405);

  try {
    const session = readSession(request);
    if (!session?.accessToken) return json({ error: "Sign in with GitHub first." }, 401);

    const body = await request.json();
    const action = body.action || "context";
    const repo = String(body.repo || "").trim();

    if (!validRepo(repo)) return json({ error: "Invalid repository name." }, 400);

    if (action === "repos") {
      return json({ repositories: await listRepositories(session.accessToken) });
    }

    if (action === "context") {
      const maxFiles = Number(body.maxFiles || 40);
      return json(await collectRepository(repo, session.accessToken, Math.min(80, Math.max(1, maxFiles))));
    }

    if (action === "apply") {
      const changes = Array.isArray(body.changes) ? body.changes : [];
      if (!changes.length || changes.length > 12) return json({ error: "Provide 1-12 file changes." }, 400);

      const context = await collectRepository(repo, session.accessToken, 80);
      const base = String(body.base || context.branch);
      if (!safeBranch(base)) return json({ error: "Invalid base branch." }, 400);

      const branch =
        "codebase/" +
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2, 8);

      await createBranch(repo, base, branch, session.accessToken);

      const results = [];
      for (const change of changes) {
        const result = await updateFile(
          repo,
          String(change.path),
          String(change.content),
          String(change.sha || ""),
          String(body.message || "feat: apply AI coding changes"),
          branch,
          session.accessToken
        );
        results.push({
          path: change.path,
          commit: result.commit?.sha || null,
          content: result.content?.sha || null
        });
      }

      const pr = await createPullRequest(
        repo,
        branch,
        base,
        String(body.title || "Codebase AI changes"),
        String(body.description || "AI-proposed changes generated in Codebase. Review before merging."),
        session.accessToken
      );

      return json({
        ok: true,
        branch,
        base,
        results,
        pull_request: {
          number: pr.number,
          url: pr.html_url,
          title: pr.title
        }
      });
    }

    return json({ error: "Unknown GitHub action." }, 400);
  } catch (error) {
    return json({ error: error.message || "GitHub operation failed." }, error.status || 500);
  }
}