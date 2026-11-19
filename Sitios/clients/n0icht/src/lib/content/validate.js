// @ts-check
/**
 * Comprueba la forma del contenido. Devuelve la lista de problemas (vacía si está todo bien).
 * Lo corren los tests: un contenido mal cargado falla antes del build.
 */

/** Largo máximo de una línea de arranque: tiene que entrar en una fila de la terminal a 360px. */
export const BOOT_LINE_MAX = 34;

/** @param {unknown} value */
const isText = (value) => typeof value === "string" && value.trim().length > 0;

/** @param {unknown} href */
const isAnchor = (href) => typeof href === "string" && /^\/#[a-z][a-z0-9-]*$/.test(href);

/** @param {unknown} href */
const isLink = (href) => typeof href === "string" && /^(https:\/\/|mailto:|\/)/.test(href);

/**
 * @param {import("./types.js").TerminalContent} content
 * @param {{ hero: import("./types.js").Hero, pendingSections: import("./types.js").SectionStub[] }} page
 * @returns {string[]}
 */
export function validateContent(content, page) {
  const { site, nav, terminal, projects, stack, contact } = content;
  /** @type {string[]} */
  const problems = [];
  /** @param {boolean} ok @param {string} message */
  const check = (ok, message) => {
    if (!ok) problems.push(message);
  };

  for (const key of /** @type {const} */ (["name", "alias", "identity", "role", "tagline", "title", "description"])) {
    check(isText(site[key]), `site.${key} está vacío`);
  }
  check(site.identity === `${site.name} · ${site.alias}`, "site.identity tiene que ser «nombre · alias»");
  check(site.url === "" || /^https:\/\/[^/]+$/.test(site.url), "site.url va vacío o como https://dominio, sin barra final");
  check(site.logo.startsWith("/"), "site.logo es una ruta desde static/ y empieza con /");

  // Cada ancla del menú y de los botones del hero tiene que existir como sección
  const ids = new Set(["top", ...page.pendingSections.map((section) => section.id)]);
  check(ids.size === page.pendingSections.length + 1, "hay ids de sección repetidos");
  for (const item of [...nav, ...page.hero.ctas]) {
    check(isText(item.label), "hay un link sin label");
    check(isAnchor(item.href), `${item.label}: href tiene que ser /#id`);
    check(ids.has(String(item.href).slice(2)), `${item.label}: no hay sección con id ${String(item.href).slice(2)}`);
  }
  for (const section of page.pendingSections) {
    check(isText(section.title) && isText(section.summary), `sección ${section.id}: falta título o resumen`);
    check(/^\d{2}$/.test(section.index), `sección ${section.id}: index son dos dígitos`);
  }

  check(terminal.boot.length > 0, "terminal.boot está vacío");
  for (const line of terminal.boot) {
    const length = (line.tag ? line.tag.length + 1 : 0) + line.text.length;
    check(length <= BOOT_LINE_MAX, `terminal.boot: «${line.text}» pasa de ${BOOT_LINE_MAX} caracteres`);
  }
  const names = terminal.commands.map((command) => command.name);
  check(new Set(names).size === names.length, "terminal.commands tiene nombres repetidos");
  for (const command of terminal.commands) {
    check(command.usage.split(" ")[0] === command.name, `comando ${command.name}: usage tiene que empezar con el nombre`);
    check(isText(command.summary), `comando ${command.name}: falta summary`);
  }
  for (const suggestion of terminal.suggestions) {
    check(names.includes(suggestion.split(" ")[0]), `terminal.suggestions: «${suggestion}» no es un comando`);
  }

  check(projects.length > 0, "projects está vacío");
  check(new Set(projects.map((project) => project.slug)).size === projects.length, "projects tiene slugs repetidos");
  for (const project of projects) {
    check(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(project.slug), `proyecto ${project.slug}: slug inválido`);
    check(isText(project.name) && isText(project.summary), `proyecto ${project.slug}: falta nombre o resumen`);
  }

  check(stack.length > 0, "stack está vacío");
  for (const group of stack) {
    check(isText(group.label) && group.items.length > 0 && group.items.every(isText), `stack ${group.label}: grupo vacío`);
  }

  check(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email), "contact.email no es un mail");
  for (const link of contact.links) {
    check(isText(link.label) && isLink(link.href), `contacto ${link.label}: link inválido`);
  }

  return problems;
}
