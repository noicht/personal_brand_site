/**
 * Números del playground a texto. Sin unidades: las unidades (`ms`, `%`, `s`, `req/s`) las
 * pone el contenido en `content/playground.js`.
 */

/** Milisegundos redondeados a entero. */
export function formatMs(ms: number): string {
  return String(Math.round(ms));
}

/**
 * Cantidad compacta: bajo 1000 el entero redondeado; desde 1000, miles con un decimal y `k`,
 * sin el `.0` (`1234 -> "1.2k"`, `20000 -> "20k"`).
 */
export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) < 1000) return String(Math.round(n));
  const text = (n / 1000).toFixed(1);
  return `${text.endsWith(".0") ? text.slice(0, -2) : text}k`;
}

/**
 * Fracción a porcentaje sin el signo `%`: `0 -> "0"`; bajo 0.1% `"<0.1"`; bajo 10% un decimal
 * (`0.042 -> "4.2"`); si no, redondeado (`0.3649 -> "36"`, `1.84 -> "184"`).
 */
export function formatPercent(fraction: number): string {
  const p = fraction * 100;
  if (!Number.isFinite(p) || p <= 0) return "0";
  if (p < 0.1) return "<0.1";
  if (p < 10) return p.toFixed(1);
  return String(Math.round(p));
}

/** Segundos con un decimal bajo 100; redondeado desde 100. */
export function formatSeconds(s: number): string {
  if (!Number.isFinite(s)) return "0";
  return s < 100 ? s.toFixed(1) : String(Math.round(s));
}
