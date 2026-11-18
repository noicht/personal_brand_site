/**
 * Cliente del servicio general.
 * En QA y producción Caddy enruta `/api/*` al contenedor `general`.
 * En local: un proxy `/api` → `http://localhost:3100` en el vite.config.js del sitio (docs/local.md).
 * PUBLIC_GENERAL_URL solo se usa si Vite la expone en import.meta.env (por defecto expone solo
 * VITE_*): ponerla en el .env no alcanza.
 *
 * Uso:
 *   import { general } from "@sitios/kit/api/client.js";
 *   const data = await general("health");
 */

function baseUrl() {
  const fromEnv =
    typeof import.meta !== "undefined" && import.meta.env?.PUBLIC_GENERAL_URL;
  if (fromEnv) return String(fromEnv).replace(/\/$/, "");
  return "/api";
}

/**
 * @param {string} feature  nombre del feature (`health`, más adelante `contact`, etc.)
 * @param {object} [body]
 * @param {RequestInit} [init]
 */
export async function general(feature, body, init = {}) {
  const name = String(feature ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  if (!name) throw new Error("Falta el feature.");

  const headers = new Headers(init.headers);
  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${baseUrl()}/v1/${name}`, {
    method: body === undefined && !init.method ? "GET" : "POST",
    ...init,
    headers,
    body: body === undefined ? init.body : JSON.stringify(body),
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    const message =
      (data && typeof data.error === "string" && data.error) ||
      `El servicio respondió ${res.status}.`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
