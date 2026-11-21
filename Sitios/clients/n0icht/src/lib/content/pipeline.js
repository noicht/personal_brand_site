// @ts-check
/**
 * El pipeline de 0 a producción. Cada etapa es una parada del recorrido 3D: su `id` es el
 * `StageId` de `three/stages.ts` y el validador comprueba que no falte ni sobre ninguna.
 */

// TODO(content): confirmar las herramientas de cada etapa.
/** @type {import("./types.js").PipelineContent} */
export const pipeline = {
  id: "pipeline",
  title: "0 → Production",
  lead: "Six stages every product I ship goes through. Scroll: the system in the background follows along.",
  railLabel: "Pipeline stages",
  stageLabel: "STAGE",
  toolsLabel: "Tools",
  outputLabel: "Output",
  activeTag: "ACTIVE",
  stages: [
    {
      id: "idea",
      label: "Idea",
      summary: "Start from the problem, not the stack.",
      detail:
        "Pin down who has the problem, what done looks like and what it must never do. Scope the smallest version worth shipping.",
      output: "A one-page brief: goal, constraints, success metric.",
      tools: ["Discovery calls", "Scope doc", "Constraints", "Success metrics"],
    },
    {
      id: "design",
      label: "Design",
      summary: "Draw the system before writing it.",
      detail:
        "Boundaries, data model, API contracts and failure modes go on paper first. Trade-offs get written down as decision records.",
      output: "Architecture diagram, API contract, ADRs.",
      tools: ["System design", "OpenAPI", "Data modelling", "ADRs"],
    },
    {
      id: "build",
      label: "Build",
      summary: "Small services, boring code, typed contracts.",
      detail:
        "Backend first: APIs, workers and data access in small, reviewable changes. Everything runs in a container from the first commit.",
      output: "A running service in a container.",
      tools: ["Python", "FastAPI", "Node.js", "NestJS", "Java", "Vue 3", "Docker"],
    },
    {
      id: "test",
      label: "Test",
      summary: "If it is not tested, it is not done.",
      detail:
        "Unit tests for logic, integration tests against real dependencies, contract tests at the edges. The pipeline blocks any merge that breaks them.",
      output: "A green pipeline on every commit.",
      tools: ["pytest", "Jest", "Integration tests", "CI checks"],
    },
    {
      id: "deploy",
      label: "Deploy",
      summary: "Shipping is a button, not an event.",
      detail:
        "Images are built once and promoted through environments. Rolling releases on Kubernetes with health checks and a rollback path that has been rehearsed.",
      output: "A versioned release in production, zero downtime.",
      tools: ["CI/CD", "GitHub Actions", "Docker", "Kubernetes", "GCP"],
    },
    {
      id: "observe",
      label: "Observe",
      summary: "Production is where the work starts.",
      detail:
        "Metrics, logs and traces are wired before launch, with alerts on what users actually feel. What production teaches feeds the next idea.",
      output: "Dashboards, alerts and a feedback loop.",
      tools: ["Cloud Monitoring", "Structured logs", "Tracing", "Alerts", "SLOs"],
    },
  ],
};
