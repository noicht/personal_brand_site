// @ts-check
/**
 * Contenido general del sitio: identidad, menú, hero y textos de interfaz.
 * Los componentes leen todo de `src/lib/content/`: para cambiar un texto se toca acá, no en los `.svelte`.
 */

/** @type {import("./types.js").Site} */
export const site = {
  name: "Martín Cabrera",
  alias: "n0icht",
  identity: "Martín Cabrera · n0icht",
  role: "Software engineer · backend & system design",
  jobTitle: "Software Engineer",
  tagline: "From zero to production.",
  title: "Martín Cabrera · n0icht | Backend & system design engineer",
  description:
    "Martín Cabrera (n0icht) is a software engineer focused on backend and system design. I design, build, ship and operate production systems: from zero to production.",
  // TODO(content): origen de producción (https://dominio), cuando exista. Habilita canonical y og:url.
  url: "",
  locale: "en_US",
  logo: "/brand/logo-b-glyph-mark.svg",
  knowsAbout: [
    "Backend engineering",
    "System design",
    "Python",
    "FastAPI",
    "Node.js",
    "NestJS",
    "Java",
    "Google Cloud Platform",
    "Docker",
    "Kubernetes",
    "CI/CD",
  ],
};

/** Menú. Cada `href` apunta a una `<section id>` de la página. @type {import("./types.js").NavItem[]} */
export const nav = [
  { label: "Pipeline", href: "/#pipeline" },
  { label: "Projects", href: "/#projects" },
  { label: "Playground", href: "/#playground" },
  { label: "Stack", href: "/#stack" },
  { label: "Experience", href: "/#experience" },
  { label: "Contact", href: "/#contact" },
];

/** @type {import("./types.js").Hero} */
export const hero = {
  label: "SYS//00",
  status: "STATUS: ONLINE",
  lead: "I design, build, ship and operate production systems. Five-plus years taking products from a blank repo to something that runs, scales and gets watched.",
  ctas: [
    { label: "View projects", href: "/#projects", variant: "primary" },
    { label: "Contact", href: "/#contact", variant: "ghost" },
  ],
};

/**
 * Secciones que todavía no están construidas. Reservan el ancla del menú con un panel provisorio.
 * Cuando una sección se construye, sale de esta lista.
 * @type {import("./types.js").SectionStub[]}
 */
export const pendingSections = [
  {
    id: "pipeline",
    index: "01",
    title: "0 → Production",
    summary: "Idea, design, build, test, deploy, observe: how a product gets from nothing to running.",
  },
  {
    id: "projects",
    index: "02",
    title: "Projects",
    summary: "Case studies: the problem, the architecture, the trade-offs and the result.",
  },
  {
    id: "playground",
    index: "03",
    title: "System Design Playground",
    summary: "A live simulator: add a cache, a load balancer, a queue or a replica and watch latency move.",
  },
  {
    id: "stack",
    index: "04",
    title: "Stack",
    summary: "The tools I run in production, as an instrument panel.",
  },
  {
    id: "experience",
    index: "05",
    title: "Experience",
    summary: "A timeline of outcomes, not job titles.",
  },
  {
    id: "contact",
    index: "06",
    title: "Contact",
    summary: "A direct line. Until this panel is wired, run 'contact' in the terminal.",
  },
];

/** Textos de interfaz que no pertenecen a una sección. */
export const ui = {
  skipLink: "Skip to content",
  navLabel: "Primary",
  homeLabel: "Martín Cabrera · n0icht, home",
  sectionLabel: "SYS",
  pendingLabel: "MODULE",
  pendingTag: "IN BUILD",
  pendingStatus: "STATUS: SCHEDULED",
  footerStatus: "ALL SYSTEMS NOMINAL",
};

/** @type {import("./types.js").PaletteCopy} */
export const palette = {
  button: "Menu",
  title: "Command palette",
  inputLabel: "Search commands",
  placeholder: "Search commands…",
  listLabel: "Commands",
  empty: "No matching commands.",
  close: "Close",
  hint: "Up/Down to move · Enter to run · Esc to close",
  groups: { navigate: "Go to", terminal: "Run", links: "Open" },
  emailLabel: "Email",
};
