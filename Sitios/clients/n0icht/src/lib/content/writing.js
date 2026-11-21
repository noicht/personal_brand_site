// @ts-check
/**
 * Notas y escritos. La sección está detrás del flag `features.writing` (apagado): el contenido
 * se valida igual, así prenderla es cambiar un booleano.
 */

// TODO(content): posts reales; estos tres son placeholders (`todo: true`).
/** @type {import("./types.js").WritingContent} */
export const writing = {
  id: "writing",
  title: "Notes",
  lead: "Short notes on systems I built, broke and fixed.",
  readLabel: "read note",
  posts: [
    {
      title: "What production teaches that staging never will",
      summary: "On alerts, real users and why the feedback loop is the feature.",
      date: "2026-02-10",
      href: "https://example.com/notes/production-teaches",
      tags: ["observability", "operations"],
      todo: true,
    },
    {
      title: "Queues are where latency goes to behave",
      summary: "Moving slow work off the request path without losing it.",
      date: "2025-11-03",
      href: "https://example.com/notes/queues",
      tags: ["architecture", "backend"],
      todo: true,
    },
    {
      title: "A ledger is a journal, not a number",
      summary: "Why append-only beats mutable balances when money is involved.",
      date: "2025-08-19",
      href: "https://example.com/notes/ledger",
      tags: ["databases", "design"],
      todo: true,
    },
  ],
};
