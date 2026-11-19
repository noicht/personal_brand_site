/**
 * Comandos de la terminal. Cada uno recibe el comando ya parseado y el contenido, y devuelve
 * líneas para mostrar y efectos para que aplique la interfaz. Ninguno toca el DOM.
 *
 * La paleta de comandos (`palette.ts`) usa los mismos efectos.
 */
import type { TerminalContent } from "../content/types.js";
import { parse } from "./parser.ts";
import type { ParsedCommand } from "./parser.ts";

export type LineKind = "input" | "out" | "head" | "muted" | "ok" | "error" | "boot";

export interface Line {
  kind: LineKind;
  text: string;
  /** Prefijo corto que se muestra resaltado (`[ ok ]`, el nombre de un proyecto). */
  tag?: string;
  /** Si está, el texto es un link. */
  href?: string;
  /** Solo en el arranque: cuántos caracteres se tipean, cuándo empieza y cuánto dura (ms). */
  typing?: { chars: number; delay: number; duration: number };
}

export type Effect =
  | { type: "clear" }
  | { type: "pulse" }
  | { type: "navigate"; href: string }
  | { type: "open"; href: string }
  | { type: "run"; command: string };

export interface CommandResult {
  lines: Line[];
  effects: Effect[];
}

type Handler = (command: ParsedCommand, content: TerminalContent) => CommandResult;

const out = (lines: Line[], effects: Effect[] = []): CommandResult => ({ lines, effects });

const error = (text: string): Line => ({ kind: "error", text });

/** Reemplaza `{clave}` en un mensaje del contenido. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/** `./Projects/` y `projects` son lo mismo. */
const normalizePath = (arg: string) => arg.toLowerCase().replace(/^\.\//, "").replace(/\/+$/, "");

/** Distancia de edición entre dos palabras, para sugerir el comando más parecido. */
export function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

/** El comando más parecido a lo que se escribió, si está a una o dos letras. */
export function suggest(name: string, names: string[]): string | null {
  let best: string | null = null;
  let bestDistance = Math.min(2, Math.floor(name.length / 2)) + 1;
  for (const candidate of names) {
    const d = distance(name, candidate);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}

const handlers: Record<string, Handler> = {
  help(_command, { terminal }) {
    const width = Math.max(...terminal.commands.map((command) => command.usage.length)) + 2;
    return out([
      { kind: "head", text: terminal.messages.helpIntro },
      ...terminal.commands.map((command): Line => ({ kind: "out", tag: command.usage.padEnd(width), text: command.summary })),
      { kind: "muted", text: terminal.messages.helpHint },
    ]);
  },

  whoami(_command, { site, terminal }) {
    return out([
      { kind: "head", text: site.identity },
      { kind: "out", text: site.role },
      ...terminal.whoami.map((text): Line => ({ kind: "out", text })),
    ]);
  },

  ls(command, { terminal, projects }) {
    if (command.args.length === 0) return out([{ kind: "out", text: terminal.lsRoot.join("  ") }]);
    const target = normalizePath(command.args[0]);
    if (target === "projects") {
      return out([
        { kind: "head", text: terminal.messages.projectsHead },
        ...projects.map((project): Line => ({ kind: "out", tag: project.name, text: project.summary })),
      ]);
    }
    if (terminal.lsRoot.some((entry) => normalizePath(entry) === target)) return out([{ kind: "out", text: target }]);
    return out([error(fill(terminal.messages.noSuchFile, { cmd: "ls", arg: command.args[0] }))]);
  },

  cat(command, { terminal, stack }) {
    if (command.args.length === 0) return out([error(terminal.messages.catUsage)]);
    if (normalizePath(command.args[0]) !== "stack") {
      return out([error(fill(terminal.messages.noSuchFile, { cmd: "cat", arg: command.args[0] }))]);
    }
    const width = Math.max(...stack.map((group) => group.label.length)) + 2;
    return out(
      stack.map(
        (group): Line => ({ kind: "out", tag: group.label.padEnd(width), text: group.items.map((item) => item.name).join(" · ") }),
      ),
    );
  },

  contact(_command, { terminal, contact }) {
    const rows = [
      { label: "email", text: contact.email, href: `mailto:${contact.email}` },
      ...contact.links.map((link) => ({
        label: link.label.toLowerCase(),
        text: link.href.replace(/^https:\/\/(www\.)?/, ""),
        href: link.href,
      })),
    ];
    const width = Math.max(...rows.map((row) => row.label.length)) + 2;
    return out([
      { kind: "head", text: terminal.messages.contactHead },
      ...rows.map((row): Line => ({ kind: "out", tag: row.label.padEnd(width), text: row.text, href: row.href })),
    ]);
  },

  deploy(command, { terminal }) {
    if (command.rest.length === 0) return out([error(terminal.messages.deployUsage)]);
    if (!command.flags.includes("prod")) {
      return out([error(fill(terminal.messages.deployUnknown, { arg: command.rest[0] }))]);
    }
    return out(
      [
        ...terminal.deploy.map((line): Line => ({ kind: "ok", tag: line.tag, text: line.text })),
        { kind: "head", text: terminal.deployDone },
      ],
      [{ type: "pulse" }],
    );
  },

  clear() {
    return out([], [{ type: "clear" }]);
  },
};

/** Nombres de los comandos que existen. */
export const commandNames = Object.keys(handlers);

/** Corre una línea. Una línea vacía no hace nada; un comando desconocido explica cómo seguir. */
export function execute(input: string, content: TerminalContent): CommandResult {
  const command = parse(input);
  if (!command) return out([]);

  // Object.hasOwn: `constructor` o `toString` no son comandos
  if (Object.hasOwn(handlers, command.name)) return handlers[command.name](command, content);

  const { messages } = content.terminal;
  const similar = suggest(command.name, commandNames);
  return out([
    error(fill(messages.notFound, { cmd: command.name })),
    { kind: "muted", text: similar ? fill(messages.didYouMean, { cmd: similar }) : messages.notFoundHint },
  ]);
}
