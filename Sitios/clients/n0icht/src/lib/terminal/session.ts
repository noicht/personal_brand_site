/**
 * Estado de una sesión de terminal: lo que hay en pantalla y el historial de comandos.
 * Las funciones no modifican la sesión que reciben: devuelven una nueva.
 */
import type { TerminalContent } from "../content/types.js";
import { execute } from "./commands.ts";
import type { Effect, Line } from "./commands.ts";

/** Líneas que se conservan en pantalla. Las más viejas se descartan. */
export const MAX_LINES = 200;
/** Comandos que se conservan en el historial. */
export const MAX_HISTORY = 50;

export interface Session {
  lines: Line[];
  history: string[];
  /** Posición en el historial. `history.length` es la línea que se está escribiendo. */
  cursor: number;
  /** Lo que estaba escrito antes de empezar a recorrer el historial. */
  draft: string;
}

export function createSession(lines: Line[] = []): Session {
  return { lines, history: [], cursor: 0, draft: "" };
}

/**
 * Corre una línea: la suma a la pantalla con su salida y la guarda en el historial (sin líneas
 * vacías ni repetir la anterior). `clear` se aplica acá; el resto de los efectos se devuelve.
 */
export function submit(
  session: Session,
  input: string,
  content: TerminalContent,
): { session: Session; effects: Effect[] } {
  const text = input.trim();
  const result = execute(text, content);
  const cleared = result.effects.some((effect) => effect.type === "clear");

  const history =
    text && session.history.at(-1) !== text ? [...session.history, text].slice(-MAX_HISTORY) : session.history;
  const echo: Line = { kind: "input", text };
  const lines = cleared ? [] : [...session.lines, echo, ...result.lines].slice(-MAX_LINES);

  return {
    session: { lines, history, cursor: history.length, draft: "" },
    effects: result.effects.filter((effect) => effect.type !== "clear"),
  };
}

/** Flecha arriba: el comando anterior. En el más viejo se queda. */
export function historyPrev(session: Session, current: string): { session: Session; value: string } {
  if (session.history.length === 0) return { session, value: current };
  const draft = session.cursor === session.history.length ? current : session.draft;
  const cursor = Math.max(0, session.cursor - 1);
  return { session: { ...session, cursor, draft }, value: session.history[cursor] };
}

/** Flecha abajo: el comando siguiente. Pasado el último vuelve lo que se estaba escribiendo. */
export function historyNext(session: Session, current: string): { session: Session; value: string } {
  if (session.cursor >= session.history.length) return { session, value: current };
  const cursor = session.cursor + 1;
  const value = cursor === session.history.length ? session.draft : session.history[cursor];
  return { session: { ...session, cursor }, value };
}
