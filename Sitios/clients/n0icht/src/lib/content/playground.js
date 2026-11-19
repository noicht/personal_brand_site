// @ts-check
/**
 * Textos del playground: la sección del simulador de diseño de sistemas. La lógica
 * (modelo, presets, topología, paquetes, formatos) está en `src/lib/playground/` y los
 * componentes en `src/lib/Components/Playground*.svelte`; acá solo vive el copy en inglés.
 */

/** @type {import("./types.js").PlaygroundContent} */
export const playgroundSection = {
  id: "playground",
  title: "System Design Playground",
  lead: "A live model of a client, an API and a database. Add a cache, a load balancer, a queue or a read replica, raise the traffic, break something, and watch latency, throughput and errors move.",
  panelLabel: "SIM//playground",
  loading: "LOADING SIMULATOR",
  noscript: "The simulator runs in the browser and needs JavaScript.",
  loadError: "The simulator could not be loaded.",
  retry: "Retry",
  health: { ok: "NOMINAL", degraded: "DEGRADED", down: "OUTAGE" },
  presetsLabel: "Presets",
  presets: {
    naive: { label: "Naive", hint: "One API, one database. Fine until the traffic grows." },
    readHeavy: { label: "Read-heavy", hint: "95% reads: the cache and the replica carry the load." },
    spike: { label: "Spike traffic", hint: "A burst of writes: the queue takes the hit and the database catches up later." },
    resilient: { label: "Resilient", hint: "Everything on. Now inject a failure and see what still answers." },
  },
  customHint: "Custom setup. Pick a preset to start over.",
  traffic: {
    legend: "Traffic",
    label: "Requests per second",
    valueText: "{rps} requests per second",
    mix: "{reads}% reads · {writes}% writes",
  },
  togglesLegend: "Architecture",
  toggles: {
    cache: { label: "Cache", tradeoff: "Faster reads and less database load, but stale data and invalidation complexity." },
    loadBalancer: { label: "Load balancer", tradeoff: "More capacity and no single API to lose, but one more hop to run and health-check." },
    queue: { label: "Message queue", tradeoff: "Absorbs write spikes, but writes land later (eventual consistency) and it only buys time." },
    replica: { label: "Read replica", tradeoff: "Takes half the reads off the primary, but replication lag and no help for writes." },
  },
  hitRatio: { label: "Hit ratio", valueText: "{hit}% of reads served from cache" },
  instances: { legend: "API instances", option: "{count} instances" },
  failuresLegend: "Inject failure",
  failures: {
    dbDown: { label: "Kill the DB", hint: "The primary goes down. Cache hits and the replica keep answering reads." },
    apiDown: { label: "Kill an API instance", hint: "One instance dies. Without a load balancer it is the only one." },
    coldStart: { label: "Cache cold start", hint: "The cache is flushed: every read misses until it warms up again." },
  },
  metricsLabel: "Live metrics",
  metrics: {
    p50: { label: "p50 latency", short: "p50", unit: "ms" },
    p95: { label: "p95 latency", short: "p95", unit: "ms" },
    throughput: { label: "Throughput", short: "served", unit: "req/s" },
    errorRate: { label: "Error rate", short: "errors", unit: "%" },
    dbLoad: { label: "DB load", short: "DB", unit: "%" },
    queueLag: { label: "Queue lag", short: "lag", unit: "s" },
  },
  none: "n/a",
  dbDownValue: "DOWN",
  queueStalled: "STALLED",
  live: {
    summary: "{health}. p50 {p50} ms, p95 {p95} ms, {throughput} requests per second served, {errors}% errors, DB load {dbLoad}.",
    outage: "{health}. No request is being served.",
    dbDown: "down",
  },
  diagramLabel: "Architecture of the simulated system",
  componentsLabel: "Components and their state",
  nodes: {
    client: { label: "CLIENT", stat: "{rps} req/s" },
    lb: { label: "LB", stat: "{alive}/{instances} up" },
    api: { label: "API", stat: "load {load}%" },
    cache: { label: "CACHE", stat: "hit {hit}%" },
    queue: { label: "QUEUE", stat: "{backlog} queued" },
    db: { label: "DB", stat: "load {load}%" },
    replica: { label: "REPLICA", stat: "load {load}%" },
  },
  statuses: { ok: "OK", hot: "HOT", cold: "COLD", down: "DOWN", off: "OFF" },
};
