import {
  ACCOUNT_COOKIE,
  SESSION_AGE,
  encodeAccountSession,
  publicSession,
  readSession,
  cookie,
  clearCookie
} from "../lib/auth.js";
import { upsertUser } from "../lib/db.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(name + " is not configured on the server.");
  return value;
}

function supabaseHeaders(token) {
  return {
    apikey: env("SUPABASE_PUBLISHABLE_KEY"),
    ...(token ? { Authorization: "Bearer " + token } : {}),
    "Content-Type": "application/json"
  };
}

async function supabase(path, options = {}) {
  const response = await fetch(env("SUPABASE_URL").replace(/\/$/, "") + path, {
    ...options,
    headers: {
      ...supabaseHeaders(options.accessToken),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }

  if (!response.ok) {
    throw new Error(data?.msg || data?.error_description || data?.message || "Authentication request failed.");
  }

  return data;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 256;
}

async function refreshFromToken(refreshToken) {
  if (!refreshToken) return null;
  return supabase("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken })
  });
}

function setSession(user, accessToken, refreshToken) {
  return cookie(
    ACCOUNT_COOKIE,
    encodeAccountSession(user, accessToken, refreshToken),
    SESSION_AGE
  );
}

export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "me";

    if (request.method === "GET" && action === "me") {
      const session = readSession(request);
      if (!session) return json({ authenticated: false, user: null });
      return json({ authenticated: true, user: publicSession(session) });
    }

    if (request.method === "POST") {
      const body = await request.json();

      if (action === "signup") {
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        const name = String(body.name || "").trim().slice(0, 80);

        if (!validateEmail(email)) return json({ error: "Enter a valid email address." }, 400);
        if (!validatePassword(password)) return json({ error: "Password must be at least 8 characters." }, 400);

        const data = await supabase("/auth/v1/signup", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            data: { display_name: name || "Developer" }
          })
        });

        if (data.user) {
          await upsertUser(data.user);
        }

        if (!data.session) {
          return json({
            ok: true,
            requiresConfirmation: true,
            message: "Account created. Check your email to verify it before signing in."
          });
        }

        return json({
          ok: true,
          user: publicSession({
            sub: data.user.id,
            email: data.user.email,
            name: name || "Developer"
          }),
          session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
          }
        }, 200, {
          "Set-Cookie": setSession(data.user, data.session.access_token, data.session.refresh_token)
        });
      }

      if (action === "login") {
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (!validateEmail(email) || !password) return json({ error: "Enter your email and password." }, 400);

        const data = await supabase("/auth/v1/token?grant_type=password", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });

        await upsertUser(data.user);

        return json({
          ok: true,
          user: publicSession({
            sub: data.user.id,
            email: data.user.email,
            user_metadata: data.user.user_metadata
          }),
          session: {
            access_token: data.access_token,
            refresh_token: data.refresh_token
          }
        }, 200, {
          "Set-Cookie": setSession(data.user, data.access_token, data.refresh_token)
        });
      }

      if (action === "forgot") {
        const email = String(body.email || "").trim().toLowerCase();
        if (!validateEmail(email)) return json({ error: "Enter a valid email address." }, 400);

        const origin = url.origin;
        await supabase("/auth/v1/recover", {
          method: "POST",
          body: JSON.stringify({
            email,
            redirect_to: origin + "/?recovery=1"
          })
        });

        return json({
          ok: true,
          message: "If the address is eligible, a password reset email has been sent."
        });
      }

      if (action === "logout") {
        return new Response(null, {
          status: 204,
          headers: { "Set-Cookie": clearCookie(ACCOUNT_COOKIE) }
        });
      }

      if (action === "complete") {
        const accessToken = String(body.access_token || "");
        const refreshToken = String(body.refresh_token || "");
        if (!accessToken) return json({ error: "Missing authentication token." }, 400);

        const data = await supabase("/auth/v1/user", {
          method: "GET",
          accessToken
        });
        await upsertUser(data);

        return json({
          ok: true,
          user: publicSession(data),
          session: { access_token: accessToken, refresh_token: refreshToken }
        }, 200, {
          "Set-Cookie": setSession(data, accessToken, refreshToken)
        });
      }

      if (action === "recover") {
        const accessToken = String(body.access_token || "");
        const refreshToken = String(body.refresh_token || "");
        const password = String(body.newPassword || "");
        if (!accessToken) return json({ error: "Recovery session is missing." }, 400);
        if (!validatePassword(password)) return json({ error: "New password must be at least 8 characters." }, 400);

        const data = await supabase("/auth/v1/user", {
          method: "PUT",
          accessToken,
          body: JSON.stringify({ password })
        });
        await upsertUser(data);

        return json({
          ok: true,
          user: publicSession(data),
          session: { access_token: accessToken, refresh_token: refreshToken }
        }, 200, {
          "Set-Cookie": setSession(data, accessToken, refreshToken)
        });
      }

      if (action === "update") {
        const session = readSession(request);
        if (!session?.accessToken) return json({ error: "Sign in first." }, 401);

        const name = String(body.name || "").trim().slice(0, 80);
        const password = body.password == null ? null : String(body.password);

        if (password !== null && !validatePassword(password)) {
          return json({ error: "New password must be at least 8 characters." }, 400);
        }

        const userData = {};
        if (name) userData.data = { display_name: name };
        if (password !== null) userData.password = password;

        let accessToken=session.accessToken;
        let refreshToken=session.refreshToken;
        let data;

        try{
          data = await supabase("/auth/v1/user", {
            method: "PUT",
            accessToken,
            body: JSON.stringify(userData)
          });
        }catch(error){
          if(!refreshToken) throw error;
          const refreshed=await refreshFromToken(refreshToken);
          accessToken=refreshed.access_token;
          refreshToken=refreshed.refresh_token||refreshToken;
          data=await supabase("/auth/v1/user", {
            method: "PUT",
            accessToken,
            body: JSON.stringify(userData)
          });
        }

        await upsertUser(data);

        return json({
          ok: true,
          user: publicSession(data)
        }, 200, {
          "Set-Cookie": setSession(data, accessToken, refreshToken)
        });
      }

      return json({ error: "Unknown auth action." }, 400);
    }

    if (request.method === "POST" && action === "logout") {
      return new Response(null, {
        status: 204,
        headers: { "Set-Cookie": clearCookie(ACCOUNT_COOKIE) }
      });
    }

    if (request.method === "GET" && action === "logout") {
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/",
          "Set-Cookie": clearCookie(ACCOUNT_COOKIE)
        }
      });
    }

    return json({ error: "Unsupported request." }, 405);
  } catch (error) {
    return json({ error: error.message || "Authentication failed." }, 500);
  }
}