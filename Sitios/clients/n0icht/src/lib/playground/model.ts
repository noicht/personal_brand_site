/**
 * El modelo del playground: un cliente, una API y una base de datos, con caché, balanceador,
 * cola y réplica de lectura opcionales. TypeScript puro, sin DOM ni azar: mismas entradas,
 * mismas métricas.
 *
 * Unidades: el tráfico es `rps` (requests por segundo ofrecidos); las capacidades y los caudales
 * son por segundo; las latencias y constantes de tiempo están en milisegundos (`*_MS`) salvo las
 * que dicen `_S` (segundos simulados o de backlog). Las cargas (`apiLoad`, `dbLoad`) son razones
 * demanda/capacidad: pueden pasar de 1.
 *
 * Flujo de un request: cliente -> (balanceador) -> API -> caché o base. Una lectura puede
 * pegarle a la caché; si no, va a la base (primario o, repartidas, réplica). Una escritura va a
 * la base, directo o vía la cola. El balanceador reparte parejo entre las instancias vivas; el
 * primario recibe todas las escrituras y la mitad de las lecturas cuando hay réplica.
 *
 * Fórmulas (todas en `measure`):
 * - API: cada instancia viva es una cola M/M/1 con capacidad API_CAPACITY req/s. Lo aceptado es
 *   `min(rps, apiAlive * API_CAPACITY)`; el excedente se rechaza (`shed`). `apiLoad =
 *   rps / (apiAlive * API_CAPACITY)` (null sin instancias vivas). El tiempo medio de la API es
 *   `API_MS / (1 - min(apiLoad, RHO_MAX))`.
 * - Caché: `hitRatio = cache ? cacheHitRatio * cacheWarmth : 0` de las lecturas se sirven sin
 *   tocar la base; el resto (`dbReads`) va a los nodos de lectura vivos, repartido parejo.
 * - Base: cada lectura cuesta READ_COST unidades y cada escritura WRITE_COST. Con cola, el
 *   worker drena hasta dejar al primario en QUEUE_TARGET_UTIL de DB_CAPACITY (las lecturas
 *   tienen prioridad); la cola acepta escrituras (`queueIn`, éxito al ack) y las aplica después
 *   (`queueOut` = `drain`). Sin cola las escrituras van directo al primario. Si la demanda de un
 *   nodo supera DB_CAPACITY, solo `1 / dbLoad` de sus operaciones termina bien (`served`).
 * - Latencia: cada clase de respuesta exitosa es `floor` (red + hop del balanceador + caché o
 *   ack de cola) más una exponencial de media `apiMean + tier * dbStretch`, donde
 *   `dbStretch = 1 / (1 - min(dbLoad, RHO_MAX))`. `p50`/`p95` son cuantiles de la mezcla de las
 *   clases, pesados por su caudal (`quantile`, por bisección).
 *
 * Supuestos:
 * 1. Estado estable por instante: `measure` es una función cerrada de (config, state); solo
 *    evolucionan el calor de la caché y el backlog de la cola, en pasos fijos de TICK_SECONDS.
 *    No hay azar en el modelo (el azar con seed existe solo en `packets.ts`, para el dibujo).
 * 2. Cada instancia de API y cada nodo de base es una cola M/M/1: media `S / (1 - rho)`, con rho
 *    acotado en RHO_MAX (20x). El tráfico se reparte parejo entre las instancias vivas.
 * 3. Una clase de respuesta es un costo fijo (red, hop del balanceador, lookup de caché, ack de
 *    cola) más UNA exponencial cuya media es la suma de las medias de sus capas (aproximación:
 *    la suma real de dos exponenciales no es exponencial). p50/p95 son cuantiles de la mezcla de
 *    las clases de respuestas exitosas, pesados por su caudal; los requests fallidos no tienen
 *    latencia.
 * 4. La sobrecarga falla en vez de esperar para siempre: la API rechaza lo que excede su
 *    capacidad; un nodo de base sobre capacidad completa `1 / load` de sus operaciones, lecturas
 *    y escrituras por igual.
 * 5. Una escritura cuesta WRITE_COST lecturas. La réplica aplica todas las escrituras que aplica
 *    el primario, así que le quita la mitad de la carga de lectura a cada nodo y no ayuda en
 *    escrituras.
 * 6. Caché: `hitRatio` de las lecturas no llegan a la base; un miss paga el lookup y después la
 *    base. Los contenidos de la caché nunca están mal en el modelo (la staleness es el
 *    trade-off del copy, no una métrica). Prender la caché arranca caliente; "cold start" deja
 *    el calor en 0 y se calienta lineal en CACHE_WARMUP_S segundos con cualquier tráfico.
 * 7. Cola: una escritura es un éxito al encolarse (ack en QUEUE_MS). Un worker drena hacia el
 *    primario sin pasarlo de QUEUE_TARGET_UTIL (las lecturas tienen prioridad). El backlog está
 *    acotado por QUEUE_CAPACITY; llena, solo entra lo que drena y el resto se rechaza. Apagar la
 *    cola tira el backlog.
 * 8. "Matar la base" mata el primario. Las lecturas siguen por los hits de caché y, si hay una,
 *    la réplica (que nunca se promueve); las escrituras fallan o se amontonan en la cola.
 * 9. "Matar una instancia" saca una instancia; el balanceador deja de rutearla al instante (sin
 *    tiempo de detección). Sin balanceador era la única.
 * 10. `throughput` cuenta respuestas exitosas por segundo (una escritura encolada cuenta al
 *     ack); `errorRate = 1 - throughput / rps`.
 */

export const RPS_MIN = 50;
export const RPS_MAX = 2000;
export const RPS_STEP = 50;
export const HIT_MIN = 0.5;
export const HIT_MAX = 0.95;
export const HIT_STEP = 0.05;
/** Paso fijo de la simulación, en segundos simulados. */
export const TICK_SECONDS = 0.25;

export const NET_MS = 20; // ida y vuelta cliente <-> borde: costo fijo de toda respuesta
export const LB_MS = 1; // salto extra del balanceador
export const API_MS = 10; // servicio medio de una instancia sin carga
export const API_CAPACITY = 500; // req/s por instancia
export const CACHE_MS = 1; // consulta a la caché (acierto o fallo)
export const DB_READ_MS = 8; // lectura media sin carga
export const DB_WRITE_MS = 16; // escritura media sin carga
export const READ_COST = 1; // unidades de capacidad por lectura
export const WRITE_COST = 2; // unidades de capacidad por escritura
export const DB_CAPACITY = 720; // unidades/s por nodo (primario o réplica)
export const QUEUE_MS = 3; // ack de encolar
export const QUEUE_TARGET_UTIL = 0.8; // el worker de la cola no lleva la base más allá de esto
export const QUEUE_CAPACITY = 20_000; // mensajes
export const CACHE_WARMUP_S = 8; // segundos de frío a caliente
export const RHO_MAX = 0.95; // tope de utilización para la fórmula de latencia (20x)
export const HOT_LOAD = 0.9; // desde acá un nodo está "hot"
export const LAG_WARN_S = 10; // atraso de cola que ya cuenta como degradado

export const TOGGLE_IDS = ["cache", "loadBalancer", "queue", "replica"] as const;
export type ToggleId = (typeof TOGGLE_IDS)[number];
export const FAILURE_IDS = ["dbDown", "apiDown", "coldStart"] as const;
export type FailureId = (typeof FAILURE_IDS)[number];

export interface Config {
  rps: number; // tráfico ofrecido, req/s
  readRatio: number; // fracción de lecturas, 0..1 (la fija el preset; no hay control)
  cache: boolean;
  cacheHitRatio: number; // 0..1
  loadBalancer: boolean;
  instances: 2 | 3; // instancias detrás del balanceador (sin balanceador hay 1)
  queue: boolean;
  replica: boolean;
  dbDown: boolean; // falla: primario caído
  apiDown: boolean; // falla: una instancia de API caída
}

/** Lo único que evoluciona con el tiempo. */
export interface SimState {
  cacheWarmth: number; // 0 fría .. 1 caliente
  backlog: number; // mensajes esperando en la cola
}

/** Caudales por segundo; suman `rps` sin `drain` ni `replicated`. */
export interface Flows {
  shed: number; // rechazados por la capa de API (sobrecarga o sin instancias)
  hits: number; // lecturas servidas desde la caché
  dbReadsOk: number;
  dbReadsFailed: number;
  writesOk: number; // escrituras aplicadas (sin cola) o aceptadas por la cola
  writesFailed: number;
  drain: number; // cola -> base
  replicated: number; // primario -> réplica
}

export interface Metrics {
  p50: number | null; // ms; null si ninguna respuesta sale bien
  p95: number | null;
  throughput: number; // respuestas correctas por segundo
  errorRate: number; // 0..1
  dbLoad: number | null; // demanda / capacidad de un nodo vivo; puede pasar de 1; null sin nodos
  apiLoad: number | null; // rps / capacidad de la capa de API; null sin instancias vivas
  apiInstances: number;
  apiAlive: number;
  hitRatio: number; // efectivo: cacheHitRatio * cacheWarmth (0 sin caché)
  backlog: number;
  queueIn: number;
  queueOut: number;
  queueLag: number | null; // s; 0 con la cola vacía; null si hay cola y no drena
  queueFull: boolean;
  flows: Flows;
}

export type Health = "ok" | "degraded" | "down";

interface LatencyClass {
  weight: number;
  floor: number;
  mean: number;
}

/** Cuantil de la mezcla de clases; cada clase es `floor + Exp(mean)`. Bisección: determinista. */
function quantile(classes: LatencyClass[], q: number): number | null {
  let total = 0;
  let lo = Infinity;
  let hi = 0;
  for (const c of classes) {
    if (c.weight <= 0) continue;
    total += c.weight;
    lo = Math.min(lo, c.floor);
    hi = Math.max(hi, c.floor + c.mean * 10);
  }
  if (total <= 0) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    let below = 0;
    for (const c of classes) {
      if (c.weight > 0 && mid > c.floor) below += c.weight * (1 - Math.exp(-(mid - c.floor) / c.mean));
    }
    if (below / total < q) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Métricas de régimen estable para un instante (pura, no muta). */
export function measure(config: Config, state: SimState): Metrics {
  // 1. Capa de API: cada instancia es una cola M/M/1; lo que excede la capacidad se rechaza
  const apiInstances = config.loadBalancer ? config.instances : 1;
  const apiAlive = apiInstances - (config.apiDown ? 1 : 0);
  const apiCapacity = apiAlive * API_CAPACITY;
  const accepted = Math.min(config.rps, apiCapacity);
  const shed = config.rps - accepted;
  const apiLoad = apiAlive > 0 ? config.rps / apiCapacity : null;
  const apiMean = API_MS / (1 - Math.min(apiLoad ?? 0, RHO_MAX));
  const hop = NET_MS + (config.loadBalancer ? LB_MS : 0);

  // 2. Lecturas y escrituras; la caché atiende hitRatio de las lecturas
  const reads = accepted * config.readRatio;
  const writes = accepted - reads;
  const hitRatio = config.cache ? config.cacheHitRatio * state.cacheWarmth : 0;
  const hits = reads * hitRatio;
  const dbReads = reads - hits;

  // 3. Base: las lecturas se reparten parejo entre los nodos vivos; las escrituras van al primario
  const primaryUp = !config.dbDown;
  const readNodes = (primaryUp ? 1 : 0) + (config.replica ? 1 : 0);
  const readUnits = readNodes > 0 ? (dbReads / readNodes) * READ_COST : 0;

  const backlog = config.queue ? state.backlog : 0;
  const queueFull = config.queue && backlog >= QUEUE_CAPACITY;
  let queueIn = 0;
  let queueOut = 0;
  let dbWrites = 0;
  if (config.queue) {
    // El worker drena solo lo que deja a la base en QUEUE_TARGET_UTIL
    const budget = primaryUp ? Math.max(0, QUEUE_TARGET_UTIL * DB_CAPACITY - readUnits) / WRITE_COST : 0;
    queueOut = backlog > 0 ? budget : Math.min(writes, budget);
    queueIn = queueFull ? Math.min(writes, queueOut) : writes;
    dbWrites = queueOut;
  } else if (primaryUp) {
    dbWrites = writes;
  }

  // La réplica aplica las mismas escrituras que el primario: la carga por nodo es simétrica
  const dbLoad = readNodes > 0 ? (readUnits + dbWrites * WRITE_COST) / DB_CAPACITY : null;
  const served = dbLoad !== null && dbLoad > 1 ? 1 / dbLoad : 1; // sobre la capacidad, el resto falla
  const dbStretch = 1 / (1 - Math.min(dbLoad ?? 0, RHO_MAX));

  // 4. Resultados por segundo
  const dbReadsOk = readNodes > 0 ? dbReads * served : 0;
  const writesOk = config.queue ? queueIn : primaryUp ? writes * served : 0;
  const throughput = hits + dbReadsOk + writesOk;
  const errorRate = config.rps > 0 ? Math.max(0, 1 - throughput / config.rps) : 0;

  // 5. Latencia: mezcla de las clases de respuestas correctas
  const classes: LatencyClass[] = [
    { weight: hits, floor: hop + CACHE_MS, mean: apiMean },
    { weight: dbReadsOk, floor: hop + (config.cache ? CACHE_MS : 0), mean: apiMean + DB_READ_MS * dbStretch },
    config.queue
      ? { weight: writesOk, floor: hop + QUEUE_MS, mean: apiMean }
      : { weight: writesOk, floor: hop, mean: apiMean + DB_WRITE_MS * dbStretch },
  ];

  return {
    p50: quantile(classes, 0.5),
    p95: quantile(classes, 0.95),
    throughput,
    errorRate,
    dbLoad,
    apiLoad,
    apiInstances,
    apiAlive,
    hitRatio,
    backlog,
    queueIn,
    queueOut,
    queueLag: backlog === 0 ? 0 : queueOut > 0 ? backlog / queueOut : null,
    queueFull,
    flows: {
      shed,
      hits,
      dbReadsOk,
      dbReadsFailed: dbReads - dbReadsOk,
      writesOk,
      writesFailed: writes - writesOk,
      drain: queueOut,
      replicated: config.replica && primaryUp ? (config.queue ? queueOut : writesOk) : 0,
    },
  };
}

/** Estado inicial: caché caliente, cola vacía. */
export function initialState(): SimState {
  return { cacheWarmth: 1, backlog: 0 };
}

/** Copia del estado con la caché en frío (backlog intacto). */
export function coldStart(state: SimState): SimState {
  return { ...state, cacheWarmth: 0 };
}

/**
 * Un paso de Euler explícito de `dt` segundos:
 *   cacheWarmth = min(1, cacheWarmth + dt / CACHE_WARMUP_S)        (siempre, con o sin caché)
 *   backlog     = queue ? clamp(backlog + (queueIn - queueOut) * dt, 0, QUEUE_CAPACITY) : 0
 * con queueIn/queueOut de `measure(config, state)` (el estado ANTES del paso).
 * Devuelve la MISMA referencia si nada cambió (la UI no se invalida en régimen estable).
 */
export function step(config: Config, state: SimState, dt: number): SimState {
  const current = measure(config, state);
  const cacheWarmth = Math.min(1, state.cacheWarmth + dt / CACHE_WARMUP_S);
  const backlog = config.queue
    ? Math.min(Math.max(state.backlog + (current.queueIn - current.queueOut) * dt, 0), QUEUE_CAPACITY)
    : 0;
  if (cacheWarmth === state.cacheWarmth && backlog === state.backlog) return state;
  return { cacheWarmth, backlog };
}

/** `Math.round(seconds / TICK_SECONDS)` pasos de TICK_SECONDS. */
export function run(config: Config, state: SimState, seconds: number): SimState {
  const steps = Math.round(seconds / TICK_SECONDS);
  let current = state;
  for (let i = 0; i < steps; i++) current = step(config, current, TICK_SECONDS);
  return current;
}

/**
 * Config válida a partir de cualquier cosa: rps redondeado a RPS_STEP y acotado a
 * [RPS_MIN, RPS_MAX]; readRatio acotado a [0, 1]; cacheHitRatio redondeado a 2 decimales y
 * acotado a [HIT_MIN, HIT_MAX]; instances 3 solo si vale 3, si no 2; booleanos con `=== true`.
 * Un número no finito cae en el mínimo de su rango.
 */
export function normalizeConfig(input: Partial<Config>): Config {
  // Ausente (undefined/null) usa el default; no finito cae al mínimo del rango por el clamp.
  const pick = (value: unknown, fallback: number): number => {
    if (value === undefined || value === null) return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
  };

  const rps =
    Math.round(Math.min(Math.max(pick(input.rps, RPS_MIN), RPS_MIN), RPS_MAX) / RPS_STEP) * RPS_STEP;
  const readRatio = Math.min(Math.max(pick(input.readRatio, 0.8), 0), 1);
  const cacheHitRatio = Math.min(
    Math.max(Math.round(pick(input.cacheHitRatio, 0.8) * 100) / 100, HIT_MIN),
    HIT_MAX,
  );

  return {
    rps,
    readRatio,
    cache: input.cache === true,
    cacheHitRatio,
    loadBalancer: input.loadBalancer === true,
    instances: input.instances === 3 ? 3 : 2,
    queue: input.queue === true,
    replica: input.replica === true,
    dbDown: input.dbDown === true,
    apiDown: input.apiDown === true,
  };
}

/** Salud general: down si casi nada responde; degraded por errores, carga caliente o cola lenta. */
export function healthOf(metrics: Metrics): Health {
  if (metrics.errorRate >= 0.999) return "down";
  if (
    metrics.errorRate > 0.0005 ||
    (metrics.apiLoad ?? 0) > HOT_LOAD ||
    (metrics.dbLoad ?? 0) > HOT_LOAD ||
    metrics.queueFull ||
    metrics.queueLag === null ||
    metrics.queueLag > LAG_WARN_S
  ) {
    return "degraded";
  }
  return "ok";
}
