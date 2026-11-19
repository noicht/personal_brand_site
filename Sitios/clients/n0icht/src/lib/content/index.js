// @ts-check
/**
 * Junta el contenido que leen la terminal y la paleta de comandos.
 * La lógica de `src/lib/terminal/` lo recibe por parámetro, así se puede probar con otro contenido.
 */
import { contact } from "./contact.js";
import { projects } from "./projects.js";
import { nav, site } from "./site.js";
import { stack } from "./stack.js";
import { terminal } from "./terminal.js";

/** @type {import("./types.js").TerminalContent} */
export const terminalContent = { site, nav, terminal, projects, stack, contact };
