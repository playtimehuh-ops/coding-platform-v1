import { readSession } from "../lib/auth.js";
import { decrypt } from "../lib/auth.js";
import { getGithubConnection } from "../lib/db.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function validRepo(repo) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo);
}

function safePath(path) {
  return path && path.length <= 500 && !path.startsWith("/") && !path.includes("..");
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function github(path, token) {
  const response = await fetch("https://api.github.com" + path, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "coding-platform-v1"
    }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "GitHub download failed.");
  }
  return response;
}

export default async function handler(request) {
  if (request.method !== "GET") return json({ error: "GET required." }, 405);

  try {
    const session = readSession(request);
    if (!session) return json({ error: "Create a Codebase account first." }, 401);

    const connection = await getGithubConnection(session.sub);
    const token = connection ? decrypt(connection.token_encrypted) : null;
    if (!token) return json({ error: "Link GitHub first.", code: "GITHUB_NOT_LINKED" }, 403);

    const url = new URL(request.url);
    const repo = String(url.searchParams.get("repo") || "").trim();
    const action = String(url.searchParams.get("action") || "file");
    const path = String(url.searchParams.get("path") || "");
    const branch = String(url.searchParams.get("branch") || "main");

    if (!validRepo(repo)) return json({ error: "Invalid repository." }, 400);

    if (action === "repo") {
      const response = await github("/repos/" + repo + "/zipball/" + encodeURIComponent(branch), token);
      return new Response(response.body, {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="' + repo.split("/")[1].replace(/[^A-Za-z0-9._-]/g, "_") + "-" + branch.replace(/[^A-Za-z0-9._-]/g, "_") + ".zip"',
          "Cache-Control": "private, no-store"
        }
      });
    }

    if (action === "file") {
      if (!safePath(path)) return json({ error: "Invalid file path." }, 400);
      const response = await github(
        "/repos/" + repo + "/contents/" + encodePath(path) + "?ref=" + encodeURIComponent(branch),
        token
      );
      const data = await response.json();
      if (data.encoding !== "base64" || typeof data.content !== "string") {
        return json({ error: "This file cannot be downloaded as text." }, 415);
      }

      const bytes = Buffer.from(data.content.replace(/\n/g, ""), "base64");
      const filename = path.split("/").pop().replace(/[^A-Za-z0-9._-]/g, "_");
      return new Response(bytes, {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": 'attachment; filename="' + filename + '"',
          "Cache-Control": "private, no-store"
        }
      });
    }

    return json({ error: "Unknown download action." }, 400);
  } catch (error) {
    return json({ error: error.message || "Download failed." }, 500);
  }
}