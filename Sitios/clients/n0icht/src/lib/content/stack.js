// @ts-check
/**
 * El stack como panel de instrumentos. Cada grupo muestra años en producción (un medidor, no
 * una barra) y el estado de cada herramienta: activa, en reserva o en el banco.
 */

// TODO(content): estados y años reales de cada herramienta; estos valores son estimados.
/** @type {import("./types.js").StackGroup[]} */
export const stack = [
  {
    id: "backend",
    label: "backend",
    gauge: { value: 5, max: 6, unit: "yrs", label: "in production" },
    items: [
      { name: "Python", status: "active" },
      { name: "FastAPI", status: "active" },
      { name: "Flask", status: "standby" },
      { name: "Node.js", status: "active" },
      { name: "NestJS", status: "active" },
      { name: "Java", status: "standby" },
    ],
  },
  {
    id: "cloud",
    label: "cloud / infra",
    gauge: { value: 4, max: 6, unit: "yrs", label: "in production" },
    items: [
      { name: "GCP", status: "active" },
      { name: "Docker", status: "active" },
      { name: "Kubernetes", status: "active" },
      { name: "CI/CD", status: "active" },
      { name: "GitHub Actions", status: "active" },
    ],
  },
  {
    id: "frontend",
    label: "frontend",
    gauge: { value: 3, max: 6, unit: "yrs", label: "in production" },
    items: [
      { name: "Vue 3", status: "active" },
      { name: "SvelteKit", status: "bench", note: "this site" },
    ],
  },
  {
    id: "practices",
    label: "practices",
    gauge: { value: 5, max: 6, unit: "yrs", label: "in production" },
    items: [
      { name: "System design", status: "active" },
      { name: "API design", status: "active" },
      { name: "Testing", status: "active" },
      { name: "Observability", status: "active" },
      { name: "Code review", status: "active" },
    ],
  },
];

/** @type {import("./types.js").StackContent} */
export const stackSection = {
  id: "stack",
  title: "Stack",
  lead: "The tools I run in production, read as an instrument panel.",
  panelLabel: "PANEL",
  legendLabel: "Status legend",
  statuses: {
    active: { label: "ACTIVE", hint: "in production now" },
    standby: { label: "STANDBY", hint: "shipped before, ready to run" },
    bench: { label: "BENCH", hint: "working knowledge" },
  },
};
