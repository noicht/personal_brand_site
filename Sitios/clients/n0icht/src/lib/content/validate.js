// @ts-check
/**
 * Comprueba la forma del contenido. Devuelve la lista de problemas (vacía si está todo bien).
 * Lo corren los tests: un contenido mal cargado falla antes del build.
 *
 * Cada sección tiene su función (`validatePipeline`, `validateStack`, …); `validateContent`
 * las junta con las comprobaciones del sitio y de la terminal.
 */
import { FAILURE_IDS, TOGGLE_IDS } from "../playground/model.ts";
import { PRESET_IDS } from "../playground/presets.ts";
import { NODE_IDS, NODE_STATUSES } from "../playground/topology.ts";
import { STAGES } from "../three/stages.ts";

/** Largo máximo de una línea de arranque: tiene que entrar en una fila de la terminal a 360px. */
export const BOOT_LINE_MAX = 34;

/** Los tres estados de salud del playground (`Health` de `playground/model.ts`). */
const HEALTHS = ["ok", "degraded", "down"];

/** Las seis métricas del playground, en el orden en que se muestran. */
const METRIC_IDS = ["p50", "p95", "throughput", "errorRate", "dbLoad", "queueLag"];

/** Placeholders que lleva el `stat` de cada nodo del playground (ver `content/playground.js`). */
const NODE_STAT_KEYS = {
  client: ["{rps}"],
  lb: ["{alive}", "{instances}"],
  api: ["{load}"],
  cache: ["{hit}"],
  queue: ["{backlog}"],
  db: ["{load}"],
  replica: ["{load}"],
};

/** @type {import("./types.js").DiagramNodeKind[]} */
const NODE_KINDS = ["client", "service", "db", "queue", "cache", "external"];

/** Los cuatro grupos del stack, en el orden del panel. */
const STACK_GROUP_IDS = ["backend", "cloud", "frontend", "practices"];

/** @param {unknown} value */
const isText = (value) => typeof value === "string" && value.trim().length > 0;

/** @param {unknown} href */
const isAnchor = (href) => typeof href === "string" && /^\/#[a-z][a-z0-9-]*$/.test(href);

/** @param {unknown} href */
const isLink = (href) => typeof href === "string" && /^(https:\/\/|mailto:|\/)/.test(href);

/** @param {unknown} value */
const isHttps = (value) => typeof value === "string" && value.startsWith("https://");

/** @param {unknown} value */
const isYear = (value) => typeof value === "string" && /^\d{4}$/.test(value);

/** @param {unknown} value Una fecha ISO `YYYY-MM-DD` que existe de verdad. */
const isIsoDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/** Junta los problemas en una lista; devuelve la lista para encadenar. */
const checker = () => {
  /** @type {string[]} */
  const problems = [];
  const check = (/** @type {boolean} */ ok, /** @type {string} */ message) => {
    if (!ok) problems.push(message);
  };
  return { problems, check };
};

/**
 * Las secciones visibles: ids únicos y existentes (una sección construida o una pendiente),
 * los anclas del menú y del hero apuntando a ellas, y las metas completas.
 * @param {import("./types.js").PageContent} page
 * @param {import("./types.js").NavItem[]} nav
 * @returns {string[]}
 */
export function validateSections(page, nav) {
  const { problems, check } = checker();
  const built = new Set([
    page.pipeline.id,
    page.projectsSection.id,
    page.playgroundSection.id,
    page.stackSection.id,
    page.experience.id,
    page.writing.id,
    page.contactSection.id,
  ]);
  const pending = new Set(page.pendingSections.map((stub) => stub.id));
  const visible = page.sections.map((section) => section.id);

  check(new Set(visible).size === visible.length, "hay ids de sección repetidos");
  for (const id of visible) {
    check(built.has(id) || pending.has(id), `sección ${id}: no está construida ni pendiente`);
  }

  const ids = new Set(["top", ...visible]);
  for (const item of [...nav, ...page.hero.ctas]) {
    check(isText(item.label), "hay un link sin label");
    check(isAnchor(item.href), `${item.label}: href tiene que ser /#id`);
    check(ids.has(String(item.href).slice(2)), `${item.label}: no hay sección con id ${String(item.href).slice(2)}`);
  }

  // Las siete metas: el id esperado, y título y bajada
  const metas = {
    pipeline: page.pipeline,
    projects: page.projectsSection,
    playground: page.playgroundSection,
    stack: page.stackSection,
    experience: page.experience,
    writing: page.writing,
    contact: page.contactSection,
  };
  for (const [expected, meta] of Object.entries(metas)) {
    check(meta.id === expected, `meta ${expected}: el id es «${meta.id}»`);
    check(isText(meta.title) && isText(meta.lead), `sección ${expected}: falta título o bajada`);
  }
  check(typeof page.features.writing === "boolean", "features.writing tiene que ser booleano");

  for (const stub of page.pendingSections) {
    check(isText(stub.title) && isText(stub.summary), `sección ${stub.id}: falta título o resumen`);
  }
  return problems;
}

/**
 * El pipeline: una etapa por parada del recorrido 3D, en el mismo orden, y todo el texto.
 * @param {import("./types.js").PipelineContent} pipeline
 * @returns {string[]}
 */
export function validatePipeline(pipeline) {
  const { problems, check } = checker();
  check(
    pipeline.stages.length === STAGES.length && pipeline.stages.every((stage, i) => stage.id === STAGES[i]),
    `pipeline: las etapas tienen que ser ${STAGES.join(", ")} en ese orden`,
  );
  for (const stage of pipeline.stages) {
    check(
      isText(stage.label) && isText(stage.summary) && isText(stage.detail) && isText(stage.output),
      `etapa ${stage.id}: falta label, summary, detail u output`,
    );
    check(stage.tools.length > 0 && stage.tools.every(isText), `etapa ${stage.id}: tools vacío o con texto vacío`);
    check(new Set(stage.tools).size === stage.tools.length, `etapa ${stage.id}: tools repetidos`);
  }
  return problems;
}

/**
 * Los proyectos y su sección: forma completa del caso, el diagrama consistente y las etiquetas.
 * @param {import("./types.js").Project[]} projects
 * @param {import("./types.js").ProjectsContent} section
 * @returns {string[]}
 */
export function validateProjects(projects, section) {
  const { problems, check } = checker();
  check(projects.length > 0, "projects está vacío");
  check(new Set(projects.map((project) => project.slug)).size === projects.length, "projects tiene slugs repetidos");

  for (const project of projects) {
    check(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(project.slug), `proyecto ${project.slug}: slug inválido`);
    check(
      isText(project.name) && isText(project.summary) && isText(project.period) && isText(project.role) && isText(project.problem),
      `proyecto ${project.slug}: falta nombre, summary, period, role o problem`,
    );

    const diagram = project.architecture;
    check(isText(diagram.summary), `proyecto ${project.slug}: falta el resumen del diagrama`);
    check(diagram.nodes.length >= 2, `proyecto ${project.slug}: el diagrama necesita al menos dos nodos`);
    const nodeIds = new Set();
    const cells = new Set();
    for (const node of diagram.nodes) {
      check(!nodeIds.has(node.id), `proyecto ${project.slug}: nodo ${node.id} repetido`);
      nodeIds.add(node.id);
      check(NODE_KINDS.includes(node.kind), `proyecto ${project.slug}: tipo de nodo desconocido ${node.kind}`);
      check(isText(node.label) && node.label.length <= 18, `proyecto ${project.slug}: label de ${node.id} vacío o largo`);
      check(
        Number.isInteger(node.col) && Number.isInteger(node.row) && node.col >= 0 && node.row >= 0 && node.col <= 3 && node.row <= 3,
        `proyecto ${project.slug}: celda de ${node.id} fuera de la grilla`,
      );
      const cell = `${node.col}:${node.row}`;
      check(!cells.has(cell), `proyecto ${project.slug}: dos nodos en la celda ${cell}`);
      cells.add(cell);
    }
    const pairs = new Set();
    for (const edge of diagram.edges) {
      check(nodeIds.has(edge.from) && nodeIds.has(edge.to), `proyecto ${project.slug}: arista ${edge.from}→${edge.to} con extremo inexistente`);
      check(edge.from !== edge.to, `proyecto ${project.slug}: arista de ${edge.from} a sí mismo`);
      const pair = `${edge.from}→${edge.to}`;
      check(!pairs.has(pair), `proyecto ${project.slug}: arista ${pair} repetida`);
      check(edge.label === undefined || (isText(edge.label) && edge.label.length <= 10), `proyecto ${project.slug}: rótulo de arista ${pair} inválido o largo`);
      pairs.add(pair);
    }

    check(project.decisions.length >= 1, `proyecto ${project.slug}: falta al menos una decisión`);
    for (const decision of project.decisions) {
      check(
        isText(decision.title) && isText(decision.choice) && isText(decision.tradeoff),
        `proyecto ${project.slug}: decisión sin título, elección o trade-off`,
      );
    }
    check(project.stack.length > 0 && project.stack.every(isText), `proyecto ${project.slug}: stack vacío`);
    check(project.result.length > 0 && project.result.every(isText), `proyecto ${project.slug}: result vacío`);
    for (const link of project.links) {
      check(isText(link.label) && isHttps(link.href), `proyecto ${project.slug}: link ${link.label} inválido`);
    }
  }

  for (const kind of NODE_KINDS) {
    check(isText(section.kinds[kind]), `projects.kinds: falta la etiqueta de ${kind}`);
  }
  return problems;
}

/**
 * El stack: los cuatro grupos en orden, estados definidos, medidores válidos y sin porcentajes.
 * @param {import("./types.js").StackGroup[]} stack
 * @param {import("./types.js").StackContent} section
 * @returns {string[]}
 */
export function validateStack(stack, section) {
  const { problems, check } = checker();
  check(
    stack.length === STACK_GROUP_IDS.length && stack.every((group, i) => group.id === STACK_GROUP_IDS[i]),
    `stack: los grupos tienen que ser ${STACK_GROUP_IDS.join(", ")} en ese orden`,
  );

  for (const status of Object.values(section.statuses)) {
    check(isText(status.label) && isText(status.hint), "stack.statuses: estado sin label o hint");
  }

  for (const group of stack) {
    check(isText(group.label), `stack ${group.id}: falta label`);
    check(group.items.length >= 1, `stack ${group.id}: grupo vacío`);
    const names = new Set();
    for (const item of group.items) {
      check(isText(item.name), `stack ${group.id}: ítem sin nombre`);
      check(!names.has(item.name), `stack ${group.id}: ítem ${item.name} repetido`);
      names.add(item.name);
      check(Object.hasOwn(section.statuses, item.status), `stack ${group.id}: estado desconocido ${item.status}`);
    }
    const gauge = group.gauge;
    check(
      Number.isFinite(gauge.value) && Number.isFinite(gauge.max) && gauge.value > 0 && gauge.value <= gauge.max,
      `stack ${group.id}: el medidor necesita 0 < value ≤ max`,
    );
    check(isText(gauge.unit) && isText(gauge.label), `stack ${group.id}: falta unit o label del medidor`);
  }

  // Nada de porcentajes: el stack no muestra números de dominio, solo años y estados
  const scan = (/** @type {unknown} */ value) => {
    if (typeof value === "string") check(!value.includes("%"), `stack: «${value}» no puede llevar %`);
    else if (Array.isArray(value)) value.forEach(scan);
    else if (value && typeof value === "object") Object.values(value).forEach(scan);
  };
  scan({ stack, section });
  return problems;
}

/**
 * La experiencia: entradas completas, años válidos y orden de más nueva a más vieja.
 * @param {import("./types.js").ExperienceContent} experience
 * @returns {string[]}
 */
export function validateExperience(experience) {
  const { problems, check } = checker();
  const entries = experience.entries;
  check(entries.length > 0, "experience está vacío");
  check(new Set(entries.map((entry) => entry.id)).size === entries.length, "experience tiene ids repetidos");

  for (const entry of entries) {
    check(
      isText(entry.company) && isText(entry.role) && isText(entry.summary),
      `experiencia ${entry.id}: falta empresa, rol o resumen`,
    );
    check(isYear(entry.start), `experiencia ${entry.id}: start tiene que ser un año`);
    check(entry.end === undefined || isYear(entry.end), `experiencia ${entry.id}: end tiene que ser un año`);
    if (isYear(entry.start) && isYear(entry.end)) {
      check(Number(entry.start) <= Number(entry.end), `experiencia ${entry.id}: start después de end`);
    }
    check(entry.outcomes.length >= 1 && entry.outcomes.every(isText), `experiencia ${entry.id}: falta al menos un resultado`);
  }

  // Orden: primero lo en curso y lo más reciente (por `end`, desempatando por `start`)
  const recency = (/** @type {import("./types.js").ExperienceEntry} */ entry) =>
    Number(entry.end ?? "9999") * 10000 + Number(entry.start || "0");
  for (let i = 0; i + 1 < entries.length; i++) {
    check(recency(entries[i]) >= recency(entries[i + 1]), "experience: las entradas van de más nueva a más vieja");
  }
  return problems;
}

/**
 * Las notas: cada post completo, fechas ISO reales, hrefs únicos y orden de más nuevo a más viejo.
 * @param {import("./types.js").WritingContent} writing
 * @returns {string[]}
 */
export function validateWriting(writing) {
  const { problems, check } = checker();
  const posts = writing.posts;
  const hrefs = new Set();
  for (const post of posts) {
    check(isText(post.title) && isText(post.summary), `post «${post.title}»: falta título o resumen`);
    check(isIsoDate(post.date), `post «${post.title}»: la fecha tiene que ser ISO real (YYYY-MM-DD)`);
    check(isHttps(post.href) || (typeof post.href === "string" && post.href.startsWith("/")), `post «${post.title}»: href inválido`);
    check(!hrefs.has(post.href), `post «${post.title}»: href repetido`);
    hrefs.add(post.href);
    check(Array.isArray(post.tags) && post.tags.every(isText), `post «${post.title}»: tags tienen que ser textos`);
  }
  for (let i = 0; i + 1 < posts.length; i++) {
    check(posts[i].date >= posts[i + 1].date, "writing: los posts van de más nuevo a más viejo");
  }
  return problems;
}

/**
 * El contacto: mail y links válidos, endpoint sano y todas las cadenas del formulario.
 * @param {import("./types.js").Contact} contact
 * @param {import("./types.js").ContactContent} section
 * @returns {string[]}
 */
export function validateContact(contact, section) {
  const { problems, check } = checker();
  check(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email), "contact.email no es un mail");
  for (const link of contact.links) {
    check(isText(link.label) && isLink(link.href), `contacto ${link.label}: link inválido`);
  }
  check(contact.endpoint === "" || isHttps(contact.endpoint), "contact.endpoint va vacío o como https://…");

  for (const [field, copy] of Object.entries(section.fields)) {
    check(isText(copy.label) && isText(copy.placeholder), `contacto ${field}: falta label o placeholder`);
  }
  for (const [field, limit] of Object.entries(section.limits)) {
    check(Number.isInteger(limit) && limit > 0, `contacto ${field}: el límite tiene que ser un entero positivo`);
  }
  const strings = {
    ...section.errors,
    ...section.statusTags,
    ...section.status,
    fallbackLabel: section.fallbackLabel,
    directLabel: section.directLabel,
    mailSubject: section.mailSubject,
    mailBody: section.mailBody,
    honeypotLabel: section.honeypotLabel,
    submit: section.submit,
    promptChar: section.promptChar,
    panelTitle: section.panelTitle,
  };
  for (const [key, value] of Object.entries(strings)) {
    check(isText(value), `contacto: «${key}» está vacío`);
  }
  check(section.mailBody.includes("{message}"), "contacto: mailBody tiene que incluir {message}");
  return problems;
}

/**
 * El playground: los mapas tienen exactamente los ids del modelo (presets, toggles, fallas,
 * nodos, estados, salud y métricas), ninguna cadena queda vacía, cada trade-off es una línea
 * corta con la estructura «…, but …» y cada plantilla lleva sus placeholders.
 * @param {import("./types.js").PlaygroundContent} section
 * @returns {string[]}
 */
export function validatePlayground(section) {
  const { problems, check } = checker();

  /** Las claves de `value` son exactamente `ids` (sin faltar ni sobrar). */
  const exactKeys = (/** @type {Record<string, unknown>} */ value, /** @type {readonly string[]} */ ids, /** @type {string} */ path) => {
    const keys = Object.keys(value).sort();
    const expected = [...ids].sort();
    check(
      keys.length === expected.length && keys.every((key, i) => key === expected[i]),
      `${path}: las claves tienen que ser ${expected.join(", ")}`,
    );
  };

  exactKeys(section.presets, PRESET_IDS, "playground.presets");
  exactKeys(section.toggles, TOGGLE_IDS, "playground.toggles");
  exactKeys(section.failures, FAILURE_IDS, "playground.failures");
  exactKeys(section.nodes, NODE_IDS, "playground.nodes");
  exactKeys(section.metrics, METRIC_IDS, "playground.metrics");
  exactKeys(section.statuses, NODE_STATUSES, "playground.statuses");
  exactKeys(section.health, HEALTHS, "playground.health");

  // Ninguna hoja string puede quedar vacía
  const scan = (/** @type {unknown} */ value, /** @type {string} */ path) => {
    if (typeof value === "string") check(isText(value), `playground.${path} está vacío`);
    else if (Array.isArray(value)) value.forEach((item, i) => scan(item, `${path}[${i}]`));
    else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) scan(item, path ? `${path}.${key}` : key);
    }
  };
  scan(section, "");

  for (const id of TOGGLE_IDS) {
    const tradeoff = section.toggles[id].tradeoff;
    check(!tradeoff.includes("\n"), `playground.toggles.${id}.tradeoff: tiene que ser una sola línea`);
    check(tradeoff.length <= 100, `playground.toggles.${id}.tradeoff: pasa de 100 caracteres`);
    check(tradeoff.includes(", but "), `playground.toggles.${id}.tradeoff: falta «, but »`);
  }

  const has = (/** @type {string} */ template, /** @type {string} */ placeholder) =>
    template.includes(placeholder);
  check(has(section.traffic.valueText, "{rps}"), "playground.traffic.valueText: falta {rps}");
  check(has(section.traffic.mix, "{reads}") && has(section.traffic.mix, "{writes}"), "playground.traffic.mix: faltan {reads} o {writes}");
  check(has(section.hitRatio.valueText, "{hit}"), "playground.hitRatio.valueText: falta {hit}");
  check(has(section.instances.option, "{count}"), "playground.instances.option: falta {count}");
  for (const placeholder of ["{health}", "{p50}", "{p95}", "{throughput}", "{errors}", "{dbLoad}"]) {
    check(has(section.live.summary, placeholder), `playground.live.summary: falta ${placeholder}`);
  }
  check(has(section.live.outage, "{health}"), "playground.live.outage: falta {health}");
  for (const id of NODE_IDS) {
    for (const placeholder of NODE_STAT_KEYS[id]) {
      check(has(section.nodes[id].stat, placeholder), `playground.nodes.${id}.stat: falta ${placeholder}`);
    }
  }
  return problems;
}

/**
 * @param {import("./types.js").TerminalContent} content
 * @param {import("./types.js").PageContent} page
 * @returns {string[]}
 */
export function validateContent(content, page) {
  const { site, nav, terminal, projects, stack, contact } = content;
  const { problems, check } = checker();

  for (const key of /** @type {const} */ (["name", "alias", "identity", "role", "tagline", "title", "description"])) {
    check(isText(site[key]), `site.${key} está vacío`);
  }
  check(site.identity === `${site.name} · ${site.alias}`, "site.identity tiene que ser «nombre · alias»");
  check(site.url === "" || /^https:\/\/[^/]+$/.test(site.url), "site.url va vacío o como https://dominio, sin barra final");
  check(site.logo.startsWith("/"), "site.logo es una ruta desde static/ y empieza con /");
  check(site.title.length <= 60, "site.title pasa de 60 caracteres");
  check(
    site.description.length >= 70 && site.description.length <= 160,
    "site.description tiene que tener entre 70 y 160 caracteres",
  );
  const og = site.ogImage;
  check(
    isText(og?.path) && og.path.startsWith("/") && og.path.endsWith(".png"),
    "site.ogImage.path tiene que ser una ruta /….png dentro de static/",
  );
  check(og?.width === 1200 && og?.height === 630, "site.ogImage tiene que medir 1200x630");
  check(og?.type === "image/png", "site.ogImage.type tiene que ser image/png");
  check(isText(og?.alt), "site.ogImage.alt está vacío");

  problems.push(...validateSections(page, nav));

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

  problems.push(...validateProjects(projects, page.projectsSection));
  problems.push(...validatePipeline(page.pipeline));
  problems.push(...validatePlayground(page.playgroundSection));
  problems.push(...validateStack(stack, page.stackSection));
  problems.push(...validateExperience(page.experience));
  problems.push(...validateWriting(page.writing));
  problems.push(...validateContact(contact, page.contactSection));

  return problems;
}
