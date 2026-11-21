/**
 * Paleta de comandos (Cmd/Ctrl+K): arma la lista de acciones desde el contenido y la filtra.
 * Sin DOM. Los efectos son los mismos que devuelven los comandos de la terminal.
 */
import type { TerminalContent } from "../content/types.js";
import type { Effect } from "./commands.ts";

export interface PaletteItem {
  id: string;
  /** Rótulo del grupo ("Go to", "Run", "Open"). */
  group: string;
  label: string;
  /** Texto secundario: el ancla, la descripción del comando o la dirección. */
  hint: string;
  effect: Effect;
}

export interface PaletteLabels {
  navigate: string;
  terminal: string;
  links: string;
  email: string;
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Secciones del menú, comandos de la terminal (menos `clear`) y links de contacto. */
export function buildPaletteItems(content: TerminalContent, labels: PaletteLabels): PaletteItem[] {
  const { nav, terminal, contact } = content;
  return [
    ...nav.map((item): PaletteItem => ({
      id: `go-${slug(item.label)}`,
      group: labels.navigate,
      label: item.label,
      hint: item.href.replace(/^\//, ""),
      effect: { type: "navigate", href: item.href },
    })),
    ...terminal.commands
      .filter((command) => command.name !== "clear")
      .map((command): PaletteItem => ({
        id: `run-${slug(command.usage)}`,
        group: labels.terminal,
        label: command.usage,
        hint: command.summary,
        effect: { type: "run", command: command.usage },
      })),
    {
      id: "open-email",
      group: labels.links,
      label: labels.email,
      hint: contact.email,
      effect: { type: "open", href: `mailto:${contact.email}` },
    },
    ...contact.links.map((link): PaletteItem => ({
      id: `open-${slug(link.label)}`,
      group: labels.links,
      label: link.label,
      hint: link.href.replace(/^https:\/\/(www\.)?/, ""),
      effect: { type: "open", href: link.href },
    })),
  ];
}

/** Qué tan bien coincide una palabra con un ítem. Menos es mejor; `null` es que no coincide. */
function score(item: PaletteItem, word: string): number | null {
  const label = item.label.toLowerCase();
  if (label.startsWith(word)) return 0;
  if (label.split(/[^a-z0-9]+/).some((part) => part.startsWith(word))) return 1;
  if (label.includes(word)) return 2;
  if (item.hint.toLowerCase().includes(word) || item.group.toLowerCase().includes(word)) return 3;
  return null;
}

/**
 * Los ítems que contienen todas las palabras de la búsqueda, primero los que coinciden mejor.
 * A igual coincidencia se respeta el orden original. Sin búsqueda devuelve todo.
 */
export function filterPaletteItems(items: PaletteItem[], query: string): PaletteItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;

  const ranked: { item: PaletteItem; total: number; index: number }[] = [];
  items.forEach((item, index) => {
    let total = 0;
    for (const word of words) {
      const value = score(item, word);
      if (value === null) return;
      total += value;
    }
    ranked.push({ item, total, index });
  });

  return ranked.sort((a, b) => a.total - b.total || a.index - b.index).map((entry) => entry.item);
}
