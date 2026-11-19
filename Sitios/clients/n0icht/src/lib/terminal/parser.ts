/**
 * Parser de la línea de comandos. TypeScript puro, sin DOM ni imports del framework: corre igual en
 * el navegador y en los tests de Node.
 *
 * Solo sintaxis que Node puede borrar al cargar el archivo (sin `enum` ni `namespace`), y los
 * imports entre archivos de esta carpeta llevan la extensión `.ts`.
 */

/** Largo máximo que se procesa de una línea. Lo que sobra se descarta. */
export const MAX_INPUT = 200;

export interface ParsedCommand {
  /** La línea tal como se escribió, sin espacios en las puntas. */
  raw: string;
  /** Primera palabra, en minúsculas. */
  name: string;
  /** Argumentos posicionales, en orden. */
  args: string[];
  /** Flags sin los guiones y en minúsculas: `--prod` queda `prod`. */
  flags: string[];
  /** Todo lo que sigue al nombre, como se escribió (para los mensajes de error). */
  rest: string[];
}

interface Token {
  value: string;
  quoted: boolean;
}

/**
 * Separa la línea en palabras. Los espacios seguidos cuentan como uno y las comillas (simples o
 * dobles) agrupan: `cat "my file"` son dos palabras. Una comilla sin cerrar llega hasta el final.
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let value = "";
  let quote = "";
  let quoted = false;
  let open = false;

  const flush = () => {
    if (open) tokens.push({ value, quoted });
    value = "";
    quoted = false;
    open = false;
  };

  for (const char of input.slice(0, MAX_INPUT)) {
    if (quote) {
      if (char === quote) quote = "";
      else value += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      quoted = true;
      open = true;
    } else if (/\s/.test(char)) {
      flush();
    } else {
      value += char;
      open = true;
    }
  }
  flush();
  return tokens;
}

/** `null` si la línea está vacía. Una palabra entre comillas nunca es un flag. */
export function parse(input: string): ParsedCommand | null {
  const [first, ...others] = tokenize(input);
  if (!first) return null;

  const args: string[] = [];
  const flags: string[] = [];
  for (const token of others) {
    const flag = token.quoted ? null : /^--?([a-z][a-z0-9-]*)$/i.exec(token.value);
    if (flag) flags.push(flag[1].toLowerCase());
    else args.push(token.value);
  }

  return {
    raw: input.slice(0, MAX_INPUT).trim(),
    name: first.value.toLowerCase(),
    args,
    flags,
    rest: others.map((token) => token.value),
  };
}
