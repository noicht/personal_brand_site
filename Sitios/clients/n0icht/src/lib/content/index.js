// @ts-check
/**
 * Junta el contenido que leen la página, la terminal y la paleta de comandos.
 * La lógica de `src/lib/terminal/` lo recibe por parámetro, así se puede probar con otro contenido.
 */
import { contact, contactSection } from "./contact.js";
import { experience } from "./experience.js";
import { pipeline } from "./pipeline.js";
import { projects, projectsSection } from "./projects.js";
import { features, hero, nav, pendingSections, sections, site } from "./site.js";
import { stack, stackSection } from "./stack.js";
import { terminal } from "./terminal.js";
import { writing } from "./writing.js";

/** @type {import("./types.js").TerminalContent} */
export const terminalContent = { site, nav, terminal, projects, stack, contact };

/** @type {import("./types.js").PageContent} */
export const pageContent = {
  hero,
  features,
  sections,
  pendingSections,
  pipeline,
  projectsSection,
  stackSection,
  experience,
  writing,
  contactSection,
};
