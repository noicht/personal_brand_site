/**
 * Lógica del formulario de contacto. TypeScript puro, sin DOM: valida los campos, detecta la
 * trampa para bots, arma el payload del POST, la URL `mailto:` del modo sin endpoint y resuelve
 * qué endpoint vale (el de `.env` gana sobre el del contenido).
 */
import { fill } from "../terminal/commands.ts";

export type FieldName = "name" | "email" | "message";
export type FieldError = "required" | "invalid" | "tooLong";

export interface ContactFields {
  name: string;
  email: string;
  message: string;
  /** Trampa para bots: el usuario real nunca la ve ni la completa. */
  trap: string;
}

export type ContactLimits = Record<FieldName, number>;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Errores por campo, sobre los valores ya recortados. `invalid` solo aplica al mail; el resto
 * de los formatos los da el contenido con `{field}` y `{max}`.
 */
export function validateFields(fields: ContactFields, limits: ContactLimits): Partial<Record<FieldName, FieldError>> {
  const errors: Partial<Record<FieldName, FieldError>> = {};
  for (const field of ["name", "email", "message"] as const) {
    const value = fields[field].trim();
    if (!value) errors[field] = "required";
    else if (value.length > limits[field]) errors[field] = "tooLong";
    else if (field === "email" && !EMAIL_RE.test(value)) errors[field] = "invalid";
  }
  return errors;
}

/** La trampa se tocó: es un bot. */
export function isTrapped(fields: ContactFields): boolean {
  return fields.trap.trim() !== "";
}

/** Lo que viaja en el POST: los tres campos recortados; la trampa nunca sale. */
export function buildPayload(fields: ContactFields): { name: string; email: string; message: string } {
  return { name: fields.name.trim(), email: fields.email.trim(), message: fields.message.trim() };
}

/**
 * `mailto:` con asunto y cuerpo de las plantillas del contenido. Los saltos de línea del cuerpo
 * van como CRLF (`%0D%0A`), que es lo que los clientes de mail respetan.
 */
export function buildMailto(
  to: string,
  fields: ContactFields,
  templates: { subject: string; body: string },
): string {
  const values = { name: fields.name.trim(), email: fields.email.trim(), message: fields.message.trim() };
  const subject = encodeURIComponent(fill(templates.subject, values));
  const body = encodeURIComponent(fill(templates.body, values).replace(/\r?\n/g, "\r\n"));
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

/**
 * El endpoint que vale: el de `.env` gana cuando no está vacío; si no, el del contenido.
 * Vale un `https://…` o `http://localhost`/`127.0.0.1` (desarrollo); cualquier otra cosa da ""
 * (modo mailto).
 */
export function resolveEndpoint(envValue: unknown, contentValue: string): string {
  const picked = typeof envValue === "string" && envValue.trim() ? envValue.trim() : contentValue.trim();
  if (!picked) return "";
  try {
    const url = new URL(picked);
    if (url.protocol === "https:") return picked;
    if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) return picked;
    return "";
  } catch {
    return "";
  }
}
