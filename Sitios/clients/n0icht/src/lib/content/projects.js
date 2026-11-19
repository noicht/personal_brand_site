// @ts-check
/**
 * Proyectos y la sección de casos de estudio. Agregar un proyecto es una entrada en `projects`
 * y nada más: el caso, el diagrama y `ls projects` salen del mismo objeto.
 */

// TODO(content): proyectos reales. Los dos son placeholders (`todo: true`); el copy es verosímil
// pero los problemas, decisiones y resultados hay que confirmarlos.
/** @type {import("./types.js").Project[]} */
export const projects = [
  {
    slug: "ledger-core",
    name: "ledger-core",
    summary: "Event-driven payments ledger. FastAPI, Pub/Sub, PostgreSQL.",
    period: "2024 – 2025",
    role: "Backend engineer",
    problem:
      "A payments product needed a ledger where every movement is traceable and replayable, without making the synchronous path slow.",
    architecture: {
      summary: "Web app talks to an API gateway; the ledger service writes to PostgreSQL and publishes domain events a notifier consumes.",
      nodes: [
        { id: "web", label: "Web app", kind: "client", col: 0, row: 1 },
        { id: "gw", label: "API gateway", kind: "service", col: 1, row: 1 },
        { id: "ledger", label: "Ledger service", kind: "service", col: 2, row: 1 },
        { id: "db", label: "Ledger DB", kind: "db", col: 3, row: 1 },
        { id: "events", label: "Events", kind: "queue", col: 2, row: 2 },
        { id: "notifier", label: "Notifier", kind: "service", col: 3, row: 2 },
      ],
      edges: [
        { from: "web", to: "gw", label: "HTTPS" },
        { from: "gw", to: "ledger", label: "REST" },
        { from: "ledger", to: "db", label: "SQL" },
        { from: "ledger", to: "events", label: "publish" },
        { from: "events", to: "notifier", label: "consume" },
      ],
    },
    decisions: [
      {
        title: "Append-only ledger over mutable balances",
        choice: "Store every movement as an immutable entry and derive balances from the journal.",
        tradeoff: "Balance reads need a projection; writes and audits become trivially correct.",
      },
      {
        title: "Events as the integration boundary",
        choice: "Publish domain events after each commit instead of calling downstream services.",
        tradeoff: "Consumers are eventually consistent; the write path stops blocking on them.",
      },
      {
        title: "One service, not five",
        choice: "Keep ledger, reconciliation and reporting in a single deployable at this scale.",
        tradeoff: "Coarser scaling knobs; far less operational weight.",
      },
    ],
    stack: ["Python", "FastAPI", "PostgreSQL", "Pub/Sub", "Docker", "Kubernetes"],
    result: [
      "Synchronous path stays short: the ledger confirms the write and lets events carry the rest.",
      "Every movement can be replayed from the journal for audits and reconciliation.",
      "Downstream notifications moved off the request path without losing messages.",
    ],
    links: [
      { label: "Repository", href: "https://github.com/n0icht/ledger-core", todo: true },
      { label: "Live demo", href: "https://example.com/ledger-core", todo: true },
    ],
    todo: true,
  },
  {
    slug: "fleet-api",
    name: "fleet-api",
    summary: "Multi-tenant API on Kubernetes. NestJS, Redis, Cloud SQL.",
    period: "2023 – 2024",
    role: "Backend engineer",
    problem:
      "A fleet-tracking product needed one API to serve many tenants with strict isolation and predictable latency under spiky load.",
    architecture: {
      summary: "An ingress fronts the fleet API, which serves hot reads from Redis, writes to Cloud SQL and hands slow jobs to workers.",
      nodes: [
        { id: "app", label: "Mobile app", kind: "client", col: 0, row: 1 },
        { id: "ingress", label: "Ingress", kind: "service", col: 1, row: 1 },
        { id: "api", label: "fleet-api", kind: "service", col: 2, row: 1 },
        { id: "cache", label: "Redis", kind: "cache", col: 3, row: 0 },
        { id: "db", label: "Cloud SQL", kind: "db", col: 3, row: 1 },
        { id: "workers", label: "Workers", kind: "service", col: 2, row: 2 },
      ],
      edges: [
        { from: "app", to: "ingress", label: "HTTPS" },
        { from: "ingress", to: "api", label: "REST" },
        { from: "api", to: "cache", label: "GET / SET" },
        { from: "api", to: "db", label: "SQL" },
        { from: "api", to: "workers", label: "jobs" },
      ],
    },
    decisions: [
      {
        title: "Shared schema, tenant column",
        choice: "Keep all tenants in one database and scope every query by tenant id.",
        tradeoff: "Isolation is enforced in code, not infrastructure; ops stay cheap.",
      },
      {
        title: "Cache hot reads, never hot writes",
        choice: "Serve position reads from Redis with short TTLs; writes always hit the database.",
        tradeoff: "Reads can lag briefly; correctness never depends on the cache.",
      },
      {
        title: "Jobs out of the request",
        choice: "Reports and imports run in workers the API only enqueues.",
        tradeoff: "Async UX for slow operations; the API stays responsive under load.",
      },
    ],
    stack: ["Node.js", "NestJS", "Redis", "Cloud SQL", "Docker", "Kubernetes", "GCP"],
    result: [
      "Tenants share one deployable while every query stays scoped to its own data.",
      "Hot reads answer from the cache, keeping p99 stable during fleet activity spikes.",
      "Slow work moved off the request path into workers that scale on their own.",
    ],
    links: [
      { label: "Repository", href: "https://github.com/n0icht/fleet-api", todo: true },
      { label: "Live demo", href: "https://example.com/fleet-api", todo: true },
    ],
    todo: true,
  },
];

/** @type {import("./types.js").ProjectsContent} */
export const projectsSection = {
  id: "projects",
  title: "Projects",
  lead: "Case studies: the problem, the architecture, the trade-offs and the result.",
  caseLabel: "CASE",
  open: "Open case study",
  close: "Close",
  labels: {
    problem: "Problem",
    architecture: "Architecture",
    decisions: "Decisions and trade-offs",
    choice: "Choice",
    tradeoff: "Trade-off",
    stack: "Stack",
    result: "Result",
    links: "Links",
  },
  linkPending: "SOON",
  diagramLabel: "{name} architecture diagram",
  flowLabel: "Connections",
  kinds: {
    client: "CLIENT",
    service: "SVC",
    db: "DB",
    queue: "QUEUE",
    cache: "CACHE",
    external: "EXT",
  },
};
