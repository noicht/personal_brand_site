import http from "node:http";
import { features } from "./features/index.js";

const PORT = Number(process.env.PORT || 3100);
const HOST = process.env.HOST || "0.0.0.0";
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function json(res, status, data, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }

  res.writeHead(status, headers);
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 1_000_000) {
        reject(Object.assign(new Error("Body demasiado grande."), { status: 413 }));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!chunks.length) {
        resolve(undefined);
        return;
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error("JSON inválido."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

/** Acepta `/v1/:feature` y también `/api/v1/:feature` (por si Caddy no strippea). */
function featureFrom(pathname) {
  const match = pathname.match(/^\/(?:api\/)?v1\/([a-z0-9-]+)\/?$/i);
  return match ? match[1].toLowerCase() : null;
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || "";
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    json(res, 204, {}, origin);
    return;
  }

  const name = featureFrom(url.pathname);
  if (!name) {
    json(res, 404, { error: "Ruta no encontrada." }, origin);
    return;
  }

  const handler = features[name];
  if (!handler) {
    json(res, 404, { error: `Feature desconocido: ${name}.` }, origin);
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    json(res, 405, { error: "Método no permitido." }, origin);
    return;
  }

  try {
    const body = req.method === "POST" ? await readBody(req) : undefined;
    const data = await handler({
      method: req.method,
      body,
      request: req,
      url,
    });
    json(res, 200, data ?? { ok: true }, origin);
  } catch (error) {
    const status = Number(error?.status) || 500;
    const message =
      status >= 500
        ? "Error interno del servicio."
        : error?.message || "No se pudo completar el pedido.";
    json(res, status, { error: message }, origin);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`general escuchando en ${HOST}:${PORT}`);
});
