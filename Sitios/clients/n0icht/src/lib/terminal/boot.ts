/**
 * Secuencia de arranque: calcula cuándo se tipea cada línea. La animación la hace el CSS
 * (`.n0-term-line.is-typed` en terminal.css) con estos tiempos, así el HTML prerenderizado ya trae
 * todas las líneas y no cambia al hidratar.
 */
import type { Line } from "./commands.ts";

export interface BootOptions {
  /** Caracteres por segundo. */
  cps?: number;
  /** Pausa entre una línea y la siguiente (ms). */
  gap?: number;
  /** Espera antes de la primera línea (ms). */
  start?: number;
}

export interface BootSequence {
  lines: Line[];
  /** Cuánto tarda la secuencia completa (ms). */
  total: number;
}

/** Caracteres que ocupa una línea en pantalla: el tag, un espacio y el texto. */
export function lineLength(line: { text: string; tag?: string }): number {
  return (line.tag ? line.tag.length + 1 : 0) + line.text.length;
}

export function bootSequence(source: { text: string; tag?: string }[], options: BootOptions = {}): BootSequence {
  const { cps = 70, gap = 110, start = 250 } = options;
  let clock = start;

  const lines = source.map((item): Line => {
    const chars = lineLength(item);
    const duration = Math.round((chars / cps) * 1000);
    const line: Line = { kind: "boot", text: item.text, typing: { chars, delay: clock, duration } };
    if (item.tag) line.tag = item.tag;
    clock += duration + gap;
    return line;
  });

  return { lines, total: lines.length ? clock - gap : 0 };
}
