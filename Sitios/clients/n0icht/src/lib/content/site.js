// @ts-check
/**
 * Contenido general del sitio: identidad, menú, hero y textos de interfaz.
 * Los componentes leen todo de `src/lib/content/`: para cambiar un texto se toca acá, no en los `.svelte`.
 */
import { enabled, numbered } from "./sections.js";

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

/**
 * Secciones optativas. `writing` queda apagada hasta que haya posts reales; con el flag en
 * `false` no hay sección, ítem del menú ni entrada en la paleta.
 * @type {import("./types.js").Features}
 */
export const features = { writing: false };

/** @type {import("./types.js").NavItem[]} */
const navItems = [
  { label: "Pipeline", href: "/#pipeline" },
  { label: "Projects", href: "/#projects" },
  { label: "Playground", href: "/#playground" },
  { label: "Stack", href: "/#stack" },
  { label: "Experience", href: "/#experience" },
  { label: "Notes", href: "/#writing", feature: "writing" },
  { label: "Contact", href: "/#contact" },
];

/** Menú. Cada `href` apunta a una `<section id>` de la página. @type {import("./types.js").NavItem[]} */
export const nav = enabled(navItems, features);

/**
 * Las secciones de la página, en orden. Las que tienen `feature` solo aparecen con su flag
 * prendida; el número (`index`) se asigna después de filtrar.
 * @type {{ id: string, feature?: string }[]}
 */
const sectionOrder = [
  { id: "pipeline" },
  { id: "projects" },
  { id: "playground" },
  { id: "stack" },
  { id: "experience" },
  { id: "writing", feature: "writing" },
  { id: "contact" },
];

/** @type {import("./types.js").SectionRef[]} */
export const sections = numbered(enabled(sectionOrder, features));

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
 * Cuando una sección se construye, sale de esta lista. El número sale de `sections`.
 * @type {import("./types.js").SectionStub[]}
 */
export const pendingSections = [
  {
    id: "playground",
    title: "System Design Playground",
    summary: "A live simulator: add a cache, a load balancer, a queue or a replica and watch latency move.",
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
  placeholderTag: "PLACEHOLDER",
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
