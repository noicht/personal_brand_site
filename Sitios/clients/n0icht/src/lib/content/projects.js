// @ts-check
/**
 * Proyectos. En este hito solo lo que imprime `ls projects`; la forma completa (problema,
 * arquitectura, decisiones, resultado) llega con la sección de proyectos.
 */

// TODO(content): reemplazar por los proyectos reales. Estos tres son placeholders.
/** @type {import("./types.js").Project[]} */
export const projects = [
  {
    slug: "ledger-core",
    name: "ledger-core",
    summary: "Event-driven payments ledger. FastAPI, Pub/Sub, PostgreSQL.",
  },
  {
    slug: "fleet-api",
    name: "fleet-api",
    summary: "Multi-tenant API on Kubernetes. NestJS, Redis, Cloud SQL.",
  },
  {
    slug: "shipyard",
    name: "shipyard",
    summary: "CI/CD templates: build, test, deploy, roll back. Docker, GitHub Actions.",
  },
];
