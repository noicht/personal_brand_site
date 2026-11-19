/**
 * El renderer de la escena 3D: un grafo de arquitectura viva (nodos, aristas, paquetes,
 * pulsos) sobre un piso de plano, con niebla, halos aditivos y una cámara que recorre las
 * seis etapas del pipeline siguiendo el scroll. Three llega por `loadThree()` — un import
 * dinámico que solo corre desde `Background3D.svelte` — así el chunk queda aparte y el
 * prerender no lo toca.
 *
 * Reglas de la casa: nada de three a nivel de módulo (solo `import type`), nada de
 * post-procesado ni sombras, pixel ratio por `effectiveDpr`, pausa con la pestaña oculta o
 * el canvas fuera de pantalla, y `dispose()` libera todo.
 */
import type * as THREE from "three";
import {
  clamp,
  clusterAt,
  clusterWeight,
  damp,
  distanceForAspect,
  cameraPoseAt,
  FOG_FAR,
  FOG_NEAR,
  STILL_POSE,
  waypointsFor,
} from "./camera.ts";
import type { CameraPose } from "./camera.ts";
import { adjacency, buildGraph, CLUSTER_CENTERS, CLUSTER_RADIUS, mulberry32, NODE_KINDS } from "./graph.ts";
import { cascadeProgress, hopDistances, nearestPoint, PULSE_MAX_HOPS, pulseLevel } from "./pulse.ts";
import { effectiveDpr, LEVELS, nextLevel } from "./quality.ts";
import { STAGE_COUNT } from "./stages.ts";
import type { QualityTier } from "./quality.ts";

export interface Palette {
  bg: string;
  panel: string;
  border: string;
  borderStrong: string;
  amber: string;
  green: string;
  cyan: string;
  text: string;
  muted: string;
}

export interface SceneOptions {
  tier: QualityTier;
  /** Colores de los tokens de CSS, ya leídos. */
  palette: Palette;
  /** Movimiento reducido: un cuadro fijo. */
  still: boolean;
  /** Hay puntero fino: se calcula el nodo bajo el cursor. */
  hover: boolean;
  /** Posición sobre el recorrido; se llama una vez por cuadro. */
  readStage: () => number;
}

export interface SceneStats {
  fps: number;
  frames: number;
  position: number;
  cluster: number;
  level: number;
  dpr: number;
  nodes: number;
  calls: number;
  pulses: number;
}

export interface SceneHandle {
  /** Shaders compilados y primer cuadro dibujado. */
  ready: Promise<void>;
  /** `width`/`height` en px de CSS; `devicePixelRatio` el del dispositivo. */
  resize(width: number, height: number, devicePixelRatio: number): void;
  /** `false`: pestaña oculta o canvas fuera de pantalla. */
  setRunning(running: boolean): void;
  setStill(still: boolean): void;
  /** `clientX`/`clientY` en px de CSS relativos al canvas. */
  setPointer(clientX: number, clientY: number, inside: boolean): void;
  /** Pulso desde el nodo más cercano en pantalla. */
  pulseAt(clientX: number, clientY: number): void;
  /** Pulso desde el nodo central de un cluster. */
  pulseStage(stage: number): void;
  /** Pide un cuadro si el loop está dormido. */
  invalidate(): void;
  /** Un solo objeto que se actualiza en el lugar. */
  readonly stats: SceneStats;
  dispose(): void;
}

/**
 * Carga three con un import dinámico desestructurado: Vite 5.4 solo divide y depura el
 * chunk con esta forma exacta. Se llama una sola vez, desde `onMount`.
 */
export async function loadThree() {
  const {
    AdditiveBlending,
    BoxGeometry,
    BufferAttribute,
    BufferGeometry,
    CanvasTexture,
    Color,
    CylinderGeometry,
    DirectionalLight,
    DynamicDrawUsage,
    Euler,
    Fog,
    HemisphereLight,
    InstancedMesh,
    LineBasicMaterial,
    LineLoop,
    LineSegments,
    Matrix4,
    MeshLambertMaterial,
    OctahedronGeometry,
    PerspectiveCamera,
    Points,
    PointsMaterial,
    Quaternion,
    Scene,
    Vector3,
    WebGLRenderer,
  } = await import("three");
  return {
    AdditiveBlending,
    BoxGeometry,
    BufferAttribute,
    BufferGeometry,
    CanvasTexture,
    Color,
    CylinderGeometry,
    DirectionalLight,
    DynamicDrawUsage,
    Euler,
    Fog,
    HemisphereLight,
    InstancedMesh,
    LineBasicMaterial,
    LineLoop,
    LineSegments,
    Matrix4,
    MeshLambertMaterial,
    OctahedronGeometry,
    PerspectiveCamera,
    Points,
    PointsMaterial,
    Quaternion,
    Scene,
    Vector3,
    WebGLRenderer,
  };
}

export type Three = Awaited<ReturnType<typeof loadThree>>;

type Mesh3D = THREE.InstancedMesh;
type LineLoop3D = THREE.LineLoop;
type LineBasicMat = THREE.LineBasicMaterial;
type FloatAttr = THREE.BufferAttribute;
type BufferGeo = THREE.BufferGeometry;
type Points3D = THREE.Points;
type Material3D = THREE.Material;
type Color3D = THREE.Color;
type CanvasTex = THREE.CanvasTexture;

interface AmbientPacket {
  edge: number;
  from: number;
  to: number;
  u: number;
  speed: number;
}

interface CascadeSlot {
  edge: number;
  from: number;
  to: number;
  hop: number;
  start: number;
}

interface PulseSlot {
  hops: Int16Array;
  origin: number;
  start: number;
}

const PULSE_RING_SECONDS = 1.6;
const PULSE_SLOTS = 3;
const ADAPTIVE_SKIP = 45;
const ADAPTIVE_WINDOW = 90;
const ADAPTIVE_MAX_FRAME_MS = 250;

export function createScene(
  T: Three,
  canvas: HTMLCanvasElement,
  gl: WebGL2RenderingContext,
  options: SceneOptions,
): SceneHandle {
  const tier = options.tier;

  // ---------- renderer, escena y cámara ----------

  const renderer = new T.WebGLRenderer({ canvas, context: gl, antialias: tier.antialias, alpha: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(50, 1, 0.1, 200);

  // ---------- paleta (tokens de CSS ya leídos) ----------

  const colBg = new T.Color(options.palette.bg);
  const colBorderStrong = new T.Color(options.palette.borderStrong);
  const colAmber = new T.Color(options.palette.amber);
  const colGreen = new T.Color(options.palette.green);
  const colCyan = new T.Color(options.palette.cyan);
  const colText = new T.Color(options.palette.text);

  const colDim = colBg.clone().lerp(colBorderStrong, 0.55);
  const colCyanEdge = colCyan.clone().multiplyScalar(0.16);
  const colAmberEdge = colAmber.clone().multiplyScalar(0.55);
  const colCascade = colGreen.clone().lerp(colText, 0.5).multiplyScalar(1.4);
  const colBracketDim = colCyan.clone().multiplyScalar(0.25);
  const colBracketHi = colAmber.clone().multiplyScalar(0.8);
  const colGridMinor = colBg.clone().lerp(colCyan, 0.09);
  const colGridMajor = colBg.clone().lerp(colCyan, 0.2);

  // ---------- luces y niebla ----------

  scene.add(new T.HemisphereLight(options.palette.text, options.palette.bg, 1.1));
  const sun = new T.DirectionalLight(0xffffff, 1.4);
  sun.position.set(6, 12, 8);
  scene.add(sun);

  let camDistance = 1;
  const fog = new T.Fog(colBg, FOG_NEAR * camDistance, FOG_FAR * camDistance);
  scene.fog = fog;

  // ---------- grafo ----------

  const graph = buildGraph(tier.nodesPerCluster);
  const graphNodes = graph.nodes;
  const nodeTotal = graphNodes.length;
  const edgeTotal = graph.edges.length / 2;
  const neighbors = adjacency(graph);

  const baseX = new Float32Array(nodeTotal);
  const baseY = new Float32Array(nodeTotal);
  const baseZ = new Float32Array(nodeTotal);
  const phase = new Float32Array(nodeTotal);
  const spin = new Float32Array(nodeTotal);
  const spinSpeed = new Float32Array(nodeTotal);
  const nodeScale = new Float32Array(nodeTotal);
  const nodeCluster = new Uint8Array(nodeTotal);
  const nodeKind = new Uint8Array(nodeTotal);
  const meshSlot = new Uint16Array(nodeTotal);
  const hoverLevel = new Float32Array(nodeTotal);
  const hoverValue = new Float32Array(nodeTotal);
  const pulseValue = new Float32Array(nodeTotal);
  const weightValue = new Float32Array(nodeTotal);
  const fadeValue = new Float32Array(nodeTotal);
  const worldX = new Float32Array(nodeTotal);
  const worldY = new Float32Array(nodeTotal);
  const worldZ = new Float32Array(nodeTotal);

  // Aristas incidentes a cada nodo, para que los paquetes sigan el grafo
  const nodeEdges: number[][] = graphNodes.map(() => []);
  for (let e = 0; e < edgeTotal; e++) {
    nodeEdges[graph.edges[e * 2]].push(e);
    nodeEdges[graph.edges[e * 2 + 1]].push(e);
  }

  const randScene = mulberry32(0x5eed);
  const hubSet = new Set<number>();
  for (let c = 0; c < graph.clusters.length; c++) hubSet.add(graph.clusters[c].hub);

  const kindCounts = [0, 0, 0, 0];
  for (let i = 0; i < nodeTotal; i++) {
    const node = graphNodes[i];
    baseX[i] = node.x;
    baseY[i] = node.y;
    baseZ[i] = node.z;
    nodeCluster[i] = node.cluster;
    nodeKind[i] = NODE_KINDS.indexOf(node.kind);
    kindCounts[nodeKind[i]]++;
    nodeScale[i] = hubSet.has(i) ? 1.5 : 0.8 + randScene() * 0.3;
    phase[i] = randScene() * Math.PI * 2;
    spin[i] = randScene() * Math.PI * 2;
    spinSpeed[i] = (randScene() * 2 - 1) * 0.15;
    worldX[i] = node.x;
    worldY[i] = node.y;
    worldZ[i] = node.z;
  }

  // ---------- nodos: un InstancedMesh por tipo ----------

  const nodeMaterial = new T.MeshLambertMaterial({ flatShading: true });
  const kindGeometry = [
    new T.BoxGeometry(1, 1, 1),
    new T.CylinderGeometry(0.55, 0.55, 1, 8),
    new T.CylinderGeometry(0.7, 0.7, 0.4, 6),
    new T.OctahedronGeometry(0.7, 0),
  ];
  const kindMesh: Mesh3D[] = [];
  const kindCursor = [0, 0, 0, 0];
  const nodeMatrix = new T.Matrix4();
  const nodeQuat = new T.Quaternion();
  const nodeEuler = new T.Euler();
  const nodePos = new T.Vector3();
  const nodeScaleV = new T.Vector3();

  for (let k = 0; k < 4; k++) {
    const mesh = new T.InstancedMesh(kindGeometry[k], nodeMaterial, kindCounts[k]);
    mesh.frustumCulled = false;
    kindMesh.push(mesh);
    scene.add(mesh);
  }
  for (let i = 0; i < nodeTotal; i++) {
    const k = nodeKind[i];
    const slot = kindCursor[k]++;
    meshSlot[i] = slot;
    nodeMatrix.makeTranslation(baseX[i], baseY[i], baseZ[i]);
    kindMesh[k].setMatrixAt(slot, nodeMatrix);
    kindMesh[k].setColorAt(slot, colDim);
  }

  // ---------- aristas ----------

  const edgeGeo = new T.BufferGeometry();
  const edgePos = new Float32Array(edgeTotal * 6);
  const edgeCol = new Float32Array(edgeTotal * 6);
  const edgePosAttr = new T.BufferAttribute(edgePos, 3);
  const edgeColAttr = new T.BufferAttribute(edgeCol, 3);
  edgePosAttr.setUsage(T.DynamicDrawUsage);
  edgeColAttr.setUsage(T.DynamicDrawUsage);
  edgeGeo.setAttribute("position", edgePosAttr);
  edgeGeo.setAttribute("color", edgeColAttr);
  const edgeMaterial = new T.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const edgeLines = new T.LineSegments(edgeGeo, edgeMaterial);
  edgeLines.frustumCulled = false;
  scene.add(edgeLines);

  // ---------- halos (solo tier alto y nivel 0-1 de calidad) ----------

  let haloTexture: CanvasTex | null = null;
  let haloPoints: Points3D | null = null;
  let haloGeo: BufferGeo | null = null;
  let haloPosAttr: FloatAttr | null = null;
  let haloColAttr: FloatAttr | null = null;
  if (tier.halos) {
    haloTexture = makeHaloTexture(T, canvas.ownerDocument);
    haloGeo = new T.BufferGeometry();
    const haloPos = new Float32Array(nodeTotal * 3);
    const haloCol = new Float32Array(nodeTotal * 3);
    haloPosAttr = new T.BufferAttribute(haloPos, 3);
    haloColAttr = new T.BufferAttribute(haloCol, 3);
    haloPosAttr.setUsage(T.DynamicDrawUsage);
    haloColAttr.setUsage(T.DynamicDrawUsage);
    haloGeo.setAttribute("position", haloPosAttr);
    haloGeo.setAttribute("color", haloColAttr);
    const haloMaterial = new T.PointsMaterial({
      map: haloTexture as CanvasTex,
      size: 3.2,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    haloPoints = new T.Points(haloGeo, haloMaterial);
    haloPoints.frustumCulled = false;
    scene.add(haloPoints);
  }

  // ---------- paquetes: primero los de cascada, después los ambientales ----------

  const packetTotal = tier.cascade + tier.packets;
  const packetGeo = new T.BufferGeometry();
  const packetPos = new Float32Array(packetTotal * 3);
  const packetCol = new Float32Array(packetTotal * 3);
  const packetPosAttr = new T.BufferAttribute(packetPos, 3);
  const packetColAttr = new T.BufferAttribute(packetCol, 3);
  packetPosAttr.setUsage(T.DynamicDrawUsage);
  packetColAttr.setUsage(T.DynamicDrawUsage);
  packetGeo.setAttribute("position", packetPosAttr);
  packetGeo.setAttribute("color", packetColAttr);
  const packetMaterial = new T.PointsMaterial({
    size: 0.28,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const packetPoints = new T.Points(packetGeo, packetMaterial);
  packetPoints.frustumCulled = false;
  scene.add(packetPoints);
  applyDrawRange(tier.cascade + Math.floor(tier.packets * LEVELS[0].packetScale));

  function applyDrawRange(ambientCount: number) {
    packetGeo.setDrawRange(0, tier.cascade + ambientCount);
  }

  const randPackets = mulberry32(0x9a11);
  const ambient: AmbientPacket[] = [];
  for (let i = 0; i < tier.packets; i++) {
    const e = Math.floor(randPackets() * edgeTotal);
    const a = graph.edges[e * 2];
    const b = graph.edges[e * 2 + 1];
    const forward = randPackets() < 0.5;
    ambient.push({
      edge: e,
      from: forward ? a : b,
      to: forward ? b : a,
      u: randPackets(),
      speed: 0.25 + randPackets() * 0.35,
    });
  }

  const cascadeSlots: CascadeSlot[] = [];
  for (let i = 0; i < tier.cascade; i++) cascadeSlots.push({ edge: -1, from: 0, to: 0, hop: 0, start: 0 });
  let cascadeCursor = 0;

  const pulseSlots: PulseSlot[] = [];
  for (let i = 0; i < PULSE_SLOTS; i++) {
    pulseSlots.push({ hops: new Int16Array(nodeTotal).fill(-1), origin: -1, start: 0 });
  }
  let pulseCursor = 0;
  const bfsQueue = new Uint16Array(nodeTotal);

  // ---------- piso: grilla y corchetes de cluster ----------

  const gridGeo = makeGridGeometry(T, colGridMinor, colGridMajor);
  const gridLines = new T.LineSegments(gridGeo.geometry, gridGeo.material);
  gridLines.frustumCulled = false;
  scene.add(gridLines);

  const bracketHalf = CLUSTER_RADIUS + 1.5;
  const bracketArm = 1.4;
  const bracketGeo = new T.BufferGeometry();
  const bracketCount = STAGE_COUNT * 16;
  const bracketPos = new Float32Array(bracketCount * 3);
  const bracketCol = new Float32Array(bracketCount * 3);
  for (let c = 0; c < STAGE_COUNT; c++) {
    const cx = CLUSTER_CENTERS[c].x;
    const cz = CLUSTER_CENTERS[c].z;
    let v = c * 16;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = cx + sx * bracketHalf;
        const z = cz + sz * bracketHalf;
        // dos segmentos por esquina: brazo horizontal y brazo vertical, cada uno de dos vértices
        bracketPos[v * 3] = x;
        bracketPos[v * 3 + 1] = 0.02;
        bracketPos[v * 3 + 2] = z;
        bracketPos[(v + 1) * 3] = x - sx * bracketArm;
        bracketPos[(v + 1) * 3 + 1] = 0.02;
        bracketPos[(v + 1) * 3 + 2] = z;
        v += 2;
        bracketPos[v * 3] = x;
        bracketPos[v * 3 + 1] = 0.02;
        bracketPos[v * 3 + 2] = z;
        bracketPos[(v + 1) * 3] = x;
        bracketPos[(v + 1) * 3 + 1] = 0.02;
        bracketPos[(v + 1) * 3 + 2] = z - sz * bracketArm;
        v += 2;
      }
    }
  }
  const bracketPosAttr = new T.BufferAttribute(bracketPos, 3);
  const bracketColAttr = new T.BufferAttribute(bracketCol, 3);
  bracketColAttr.setUsage(T.DynamicDrawUsage);
  bracketGeo.setAttribute("position", bracketPosAttr);
  bracketGeo.setAttribute("color", bracketColAttr);
  const bracketMaterial = new T.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const bracketLines = new T.LineSegments(bracketGeo, bracketMaterial);
  bracketLines.frustumCulled = false;
  scene.add(bracketLines);

  // ---------- anillos de pulso ----------

  const ringGeo = makeRingGeometry(T);
  const rings: { line: LineLoop3D; material: LineBasicMat }[] = [];
  for (let i = 0; i < PULSE_SLOTS; i++) {
    const material = new T.LineBasicMaterial({
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const line = new T.LineLoop(ringGeo, material);
    line.frustumCulled = false;
    line.visible = false;
    scene.add(line);
    rings.push({ line, material });
  }

  // ---------- estado del loop ----------

  let running = false;
  let still = options.still;
  let destroyed = false;
  let rafId = 0;
  let lastFrameMs = 0;
  let simTime = 0;
  let pathPosition = 0;
  let snapped = false;
  let parX = 0;
  let parY = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerInside = false;
  let viewW = 1;
  let viewH = 1;
  let viewDpr = 1;
  let level = 0;
  let compiled = false;
  let lastResizeW = -1;
  let lastResizeH = -1;
  let lastResizeDpr = -1;
  let appliedW = 0;
  let appliedH = 0;
  let appliedDpr = 0;
  let warmup = ADAPTIVE_SKIP;
  let windowMs = 0;
  let windowCount = 0;

  const pose: CameraPose = { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0 };
  const waypoints = waypointsFor(CLUSTER_CENTERS);
  const stillWaypoints = [STILL_POSE];

  const stats: SceneStats = {
    fps: 0,
    frames: 0,
    position: 0,
    cluster: 0,
    level: 0,
    dpr: 1,
    nodes: nodeTotal,
    calls: 0,
    pulses: 0,
  };

  // temporales del cuadro (nunca se allocan por frame)
  const tmpA = new T.Color();
  const tmpB = new T.Color();
  const tmpC = new T.Color();
  const viewVec = new T.Vector3();
  const projXS = new Float32Array(nodeTotal);
  const projYS = new Float32Array(nodeTotal);

  // geometrias y materiales para dispose()
  const geometries: BufferGeo[] = [edgeGeo, packetGeo, bracketGeo, ringGeo, gridGeo.geometry];
  if (haloGeo) geometries.push(haloGeo);
  for (const g of kindGeometry) geometries.push(g);
  const materials: Material3D[] = [edgeMaterial, bracketMaterial, nodeMaterial, packetMaterial];
  materials.push(...rings.map((r) => r.material));
  if (haloPoints) materials.push(haloPoints.material as Material3D);
  materials.push(gridLines.material as Material3D);

  // ---------- proyección de nodos a px de CSS ----------

  function projectNodes() {
    camera.updateMatrixWorld();
    for (let i = 0; i < nodeTotal; i++) {
      viewVec.set(worldX[i], worldY[i], worldZ[i]).applyMatrix4(camera.matrixWorldInverse);
      if (viewVec.z >= 0) {
        projXS[i] = NaN;
        projYS[i] = NaN;
        continue;
      }
      viewVec.applyMatrix4(camera.projectionMatrix);
      const nx = viewVec.x;
      const ny = viewVec.y;
      const nz = viewVec.z;
      if (Math.abs(nx) > 1 || Math.abs(ny) > 1 || nz < -1 || nz > 1) {
        projXS[i] = NaN;
        projYS[i] = NaN;
        continue;
      }
      projXS[i] = (nx * 0.5 + 0.5) * viewW;
      projYS[i] = (0.5 - ny * 0.5) * viewH;
    }
  }

  // ---------- pulsos ----------

  function scheduleCascade(hops: Int16Array, start: number) {
    for (let h = 0; h < PULSE_MAX_HOPS; h++) {
      for (let e = 0; e < edgeTotal; e++) {
        const a = graph.edges[e * 2];
        const b = graph.edges[e * 2 + 1];
        const ha = hops[a];
        const hb = hops[b];
        if (ha < 0 || hb < 0 || ha === hb) continue;
        const near = ha < hb ? ha : hb;
        if (near !== h) continue;
        const slot = cascadeSlots[cascadeCursor];
        cascadeCursor = (cascadeCursor + 1) % tier.cascade;
        slot.edge = e;
        slot.from = ha < hb ? a : b;
        slot.to = ha < hb ? b : a;
        slot.hop = h;
        slot.start = start;
      }
    }
  }

  function startPulse(origin: number) {
    const slot = pulseSlots[pulseCursor];
    pulseCursor = (pulseCursor + 1) % PULSE_SLOTS;
    hopDistances(neighbors, origin, slot.hops, bfsQueue);
    slot.origin = origin;
    slot.start = simTime;
    scheduleCascade(slot.hops, simTime);
    stats.pulses++;
  }

  // ---------- actualización por cuadro ----------

  function updateSim(dt: number) {
    simTime += dt;
    for (let i = 0; i < nodeTotal; i++) spin[i] += spinSpeed[i] * dt;
    for (let p = 0; p < ambient.length; p++) {
      const packet = ambient[p];
      packet.u += packet.speed * dt;
      while (packet.u >= 1) {
        packet.u -= 1;
        reroute(packet);
      }
    }
  }

  function reroute(packet: AmbientPacket) {
    const arrival = packet.to;
    const candidates = nodeEdges[arrival];
    let nextEdge = candidates[0];
    if (candidates.length > 1) {
      for (let tries = 0; tries < 8; tries++) {
        const candidate = candidates[Math.floor(Math.random() * candidates.length)];
        if (candidate !== packet.edge) {
          nextEdge = candidate;
          break;
        }
      }
      if (nextEdge === packet.edge) {
        for (let i = 0; i < candidates.length; i++) {
          if (candidates[i] !== packet.edge) {
            nextEdge = candidates[i];
            break;
          }
        }
      }
    }
    const a = graph.edges[nextEdge * 2];
    const b = graph.edges[nextEdge * 2 + 1];
    packet.edge = nextEdge;
    packet.from = arrival;
    packet.to = a === arrival ? b : a;
  }

  function updateCameraLive(dt: number) {
    const target = options.readStage();
    pathPosition = snapped ? damp(pathPosition, target, 4, dt) : target;
    snapped = true;
    cameraPoseAt(pathPosition, waypoints, pose, camDistance);

    const nx = pointerInside ? clamp((pointerX / viewW) * 2 - 1, -1, 1) : 0;
    const ny = pointerInside ? clamp((pointerY / viewH) * 2 - 1, -1, 1) : 0;
    parX = damp(parX, nx, 3, dt);
    parY = damp(parY, ny, 3, dt);

    camera.position.set(
      pose.px + parX * 0.9 + Math.sin(simTime * 0.17) * 0.25,
      pose.py - parY * 0.5 + Math.sin(simTime * 0.23) * 0.15,
      pose.pz,
    );
    camera.lookAt(pose.tx, pose.ty, pose.tz);
    camera.updateMatrixWorld();
  }

  function updateCameraStill() {
    cameraPoseAt(0, stillWaypoints, pose, camDistance);
    camera.position.set(pose.px, pose.py, pose.pz);
    camera.lookAt(pose.tx, pose.ty, pose.tz);
    camera.updateMatrixWorld();
  }

  // fade del material aditivo: pararse en la niebla sin usar fog
  function fadeAt(x: number, y: number, z: number): number {
    const dx = camera.position.x - x;
    const dy = camera.position.y - y;
    const dz = camera.position.z - z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const near = FOG_NEAR * camDistance;
    const span = (FOG_FAR - FOG_NEAR) * camDistance;
    return 1 - clamp((d - near) / span, 0, 1);
  }

  // ---------- dibujo ----------

  function drawScene() {
    const weightPos = still ? clusterAt(options.readStage()) : pathPosition;
    stats.position = weightPos;
    stats.cluster = clusterAt(weightPos);
    stats.level = level;

    // nodos: matrices, balances y color por instancia
    for (let i = 0; i < nodeTotal; i++) {
      const wy = baseY[i] + Math.sin(simTime * 0.8 + phase[i]) * 0.12;
      worldX[i] = baseX[i];
      worldY[i] = wy;
      worldZ[i] = baseZ[i];

      fadeValue[i] = fadeAt(baseX[i], wy, baseZ[i]);
      weightValue[i] = clusterWeight(weightPos, nodeCluster[i]);

      let pulse = 0;
      if (!still) {
        for (let s = 0; s < PULSE_SLOTS; s++) {
          const levelPulse = pulseLevel(simTime - pulseSlots[s].start, pulseSlots[s].hops[i]);
          if (levelPulse > pulse) pulse = levelPulse;
        }
      }
      pulseValue[i] = pulse;
      hoverValue[i] = still ? 0 : hoverLevel[i];

      const w = weightValue[i];
      const hover = hoverValue[i];
      tmpA.copy(colDim).lerp(colAmber, w * 0.5).lerp(colText, hover * 0.7).lerp(colGreen, pulse * 0.85);
      tmpA.multiplyScalar(1 + 0.4 * hover + 0.5 * pulse);
      kindMesh[nodeKind[i]].setColorAt(meshSlot[i], tmpA);

      nodeEuler.set(0, spin[i], 0);
      nodeQuat.setFromEuler(nodeEuler);
      nodePos.set(baseX[i], wy, baseZ[i]);
      nodeScaleV.setScalar(nodeScale[i]);
      nodeMatrix.compose(nodePos, nodeQuat, nodeScaleV);
      kindMesh[nodeKind[i]].setMatrixAt(meshSlot[i], nodeMatrix);
    }
    for (let k = 0; k < 4; k++) {
      kindMesh[k].instanceMatrix.needsUpdate = true;
      const instanceColor = kindMesh[k].instanceColor;
      if (instanceColor) instanceColor.needsUpdate = true;
    }

    // aristas: siguen el bob de los nodos
    for (let e = 0; e < edgeTotal; e++) {
      const a = graph.edges[e * 2];
      const b = graph.edges[e * 2 + 1];
      const o = e * 6;
      edgePos[o] = worldX[a];
      edgePos[o + 1] = worldY[a];
      edgePos[o + 2] = worldZ[a];
      edgePos[o + 3] = worldX[b];
      edgePos[o + 4] = worldY[b];
      edgePos[o + 5] = worldZ[b];
      writeEdgeColor(edgeCol, o, a);
      writeEdgeColor(edgeCol, o + 3, b);
    }
    edgePosAttr.needsUpdate = true;
    edgeColAttr.needsUpdate = true;

    // halos
    if (haloPoints && haloPosAttr && haloColAttr) {
      const showHalos = LEVELS[level].halos;
      haloPoints.visible = showHalos;
      if (showHalos) {
        const haloPos = haloPosAttr.array as Float32Array;
        const haloCol = haloColAttr.array as Float32Array;
        for (let i = 0; i < nodeTotal; i++) {
          haloPos[i * 3] = worldX[i];
          haloPos[i * 3 + 1] = worldY[i];
          haloPos[i * 3 + 2] = worldZ[i];
          const w = weightValue[i];
          const hover = hoverValue[i];
          const f = fadeValue[i];
          const pulse = pulseValue[i];
          tmpA.copy(colCyan).lerp(colAmber, w).multiplyScalar(f * (0.06 + 0.34 * w + 0.6 * hover));
          tmpB.copy(colGreen).multiplyScalar(pulse * f);
          tmpA.add(tmpB);
          haloCol[i * 3] = tmpA.r;
          haloCol[i * 3 + 1] = tmpA.g;
          haloCol[i * 3 + 2] = tmpA.b;
        }
        haloPosAttr.needsUpdate = true;
        haloColAttr.needsUpdate = true;
      }
    }

    // paquetes: cascada primero, ambientales después (el drawRange corta la cola)
    let write = 0;
    for (let s = 0; s < tier.cascade; s++) {
      const slot = cascadeSlots[s];
      const t = still || slot.edge < 0 ? -1 : cascadeProgress(simTime - slot.start, slot.hop);
      if (t < 0) {
        packetCol[write * 3] = 0;
        packetCol[write * 3 + 1] = 0;
        packetCol[write * 3 + 2] = 0;
      } else {
        const px = worldX[slot.from] + (worldX[slot.to] - worldX[slot.from]) * t;
        const py = worldY[slot.from] + (worldY[slot.to] - worldY[slot.from]) * t;
        const pz = worldZ[slot.from] + (worldZ[slot.to] - worldZ[slot.from]) * t;
        packetPos[write * 3] = px;
        packetPos[write * 3 + 1] = py;
        packetPos[write * 3 + 2] = pz;
        const f = fadeAt(px, py, pz);
        tmpA.copy(colCascade).multiplyScalar(f);
        packetCol[write * 3] = tmpA.r;
        packetCol[write * 3 + 1] = tmpA.g;
        packetCol[write * 3 + 2] = tmpA.b;
      }
      write++;
    }
    const ambientDraw = Math.floor(tier.packets * LEVELS[level].packetScale);
    for (let p = 0; p < ambientDraw; p++) {
      const packet = ambient[p];
      const px = worldX[packet.from] + (worldX[packet.to] - worldX[packet.from]) * packet.u;
      const py = worldY[packet.from] + (worldY[packet.to] - worldY[packet.from]) * packet.u;
      const pz = worldZ[packet.from] + (worldZ[packet.to] - worldZ[packet.from]) * packet.u;
      packetPos[write * 3] = px;
      packetPos[write * 3 + 1] = py;
      packetPos[write * 3 + 2] = pz;
      const w = clusterWeight(weightPos, nodeCluster[packet.to]);
      const f = fadeAt(px, py, pz);
      tmpA.copy(colGreen).multiplyScalar((0.35 + 0.65 * w) * f);
      packetCol[write * 3] = tmpA.r;
      packetCol[write * 3 + 1] = tmpA.g;
      packetCol[write * 3 + 2] = tmpA.b;
      write++;
    }
    packetPosAttr.needsUpdate = true;
    packetColAttr.needsUpdate = true;

    // corchetes de cluster
    for (let c = 0; c < STAGE_COUNT; c++) {
      const hub = graph.clusters[c].hub;
      const f = fadeAt(worldX[hub], worldY[hub], worldZ[hub]);
      const w = clusterWeight(weightPos, c);
      tmpA.copy(colBracketDim).lerp(colBracketHi, w).multiplyScalar(f);
      const base = c * 16 * 3;
      for (let v = 0; v < 16; v++) {
        bracketCol[base + v * 3] = tmpA.r;
        bracketCol[base + v * 3 + 1] = tmpA.g;
        bracketCol[base + v * 3 + 2] = tmpA.b;
      }
    }
    bracketColAttr.needsUpdate = true;

    // anillos de pulso
    for (let s = 0; s < PULSE_SLOTS; s++) {
      const slot = pulseSlots[s];
      const ring = rings[s];
      const elapsed = still ? -1 : simTime - slot.start;
      if (slot.origin >= 0 && elapsed >= 0 && elapsed < PULSE_RING_SECONDS) {
        ring.line.visible = true;
        ring.line.position.set(worldX[slot.origin], 0.05, worldZ[slot.origin]);
        ring.line.scale.setScalar(1 + elapsed * 9);
        const k = 1 - elapsed / PULSE_RING_SECONDS;
        ring.material.color.copy(colGreen).multiplyScalar(k * k);
      } else {
        ring.line.visible = false;
      }
    }

    renderer.render(scene, camera);
    stats.calls = renderer.info.render.calls;
    stats.frames++;
  }

  function writeEdgeColor(target: Float32Array, offset: number, node: number) {
    const w = weightValue[node];
    const pulse = pulseValue[node];
    const hover = hoverValue[node];
    tmpA.copy(colCyanEdge).lerp(colAmberEdge, w);
    tmpB.copy(colGreen).multiplyScalar(pulse * 0.9);
    tmpC.copy(colText).multiplyScalar(hover * 0.5);
    tmpA.add(tmpB).add(tmpC).multiplyScalar(fadeValue[node]);
    target[offset] = tmpA.r;
    target[offset + 1] = tmpA.g;
    target[offset + 2] = tmpA.b;
  }

  // ---------- calidad adaptativa ----------

  // Un solo llamado a three por cambio de tamaño o pixel-ratio: el par de llamadas
  // anterior reasignaba el drawing buffer dos veces por resize
  function applyDrawingBuffer() {
    const dpr = effectiveDpr(viewDpr, tier, level);
    if (viewW === appliedW && viewH === appliedH && dpr === appliedDpr) return;
    renderer.setDrawingBufferSize(viewW, viewH, dpr);
    appliedW = viewW;
    appliedH = viewH;
    appliedDpr = dpr;
    stats.dpr = dpr;
  }

  function applyLevel(next: number) {
    level = next;
    applyDrawingBuffer();
    stats.level = level;
    applyDrawRange(Math.floor(tier.packets * LEVELS[level].packetScale));
    if (haloPoints) haloPoints.visible = LEVELS[level].halos;
    warmup = ADAPTIVE_SKIP;
    windowMs = 0;
    windowCount = 0;
  }

  function trackFrame(rawDt: number) {
    if (warmup > 0) {
      warmup--;
      return;
    }
    const ms = rawDt * 1000;
    if (ms <= ADAPTIVE_MAX_FRAME_MS) {
      windowMs += ms;
      windowCount++;
    }
    if (windowCount >= ADAPTIVE_WINDOW) {
      const next = nextLevel(level, windowMs / windowCount);
      if (next !== level) applyLevel(next);
      else {
        windowMs = 0;
        windowCount = 0;
      }
    }
  }

  // ---------- el frame estable del loop ----------

  function frame(nowMs: number) {
    const rawDt = lastFrameMs ? (nowMs - lastFrameMs) / 1000 : 0;
    lastFrameMs = nowMs;
    const dt = rawDt > 0.05 ? 0.05 : rawDt;
    if (rawDt > 0) stats.fps += (1 / rawDt - stats.fps) * 0.1;

    if (dt > 0) updateSim(dt);
    updateCameraLive(dt);

    // hover: proyección + easing del nivel por nodo
    let hoverTarget = -1;
    if (!still && options.hover && pointerInside) {
      projectNodes();
      hoverTarget = nearestPoint(projXS, projYS, nodeTotal, pointerX, pointerY, 40);
    }
    for (let i = 0; i < nodeTotal; i++) {
      hoverLevel[i] = damp(hoverLevel[i], i === hoverTarget ? 1 : 0, 10, dt);
    }

    drawScene();
    trackFrame(rawDt);

    if (running && !still && !destroyed && compiled) rafId = requestAnimationFrame(frame);
    else rafId = 0;
  }

  function startLoop() {
    if (destroyed || still || !compiled || !running || rafId !== 0) return;
    lastFrameMs = 0;
    warmup = ADAPTIVE_SKIP;
    windowMs = 0;
    windowCount = 0;
    rafId = requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (rafId !== 0) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  // ---------- handle ----------

  const ready = renderer.compileAsync(scene, camera).then(() => {
    if (destroyed) return;
    compiled = true;
    if (still) updateCameraStill();
    else {
      updateCameraLive(0);
      snapped = true;
    }
    drawScene();
    if (running && !still) startLoop();
  });

  return {
    ready,

    resize(width: number, height: number, devicePixelRatio: number) {
      if (destroyed || !(width > 0) || !(height > 0)) return;
      const dprIn = devicePixelRatio || 1;
      // El primer callback del ResizeObserver repite el resize explícito: no rehacer nada
      if (width === lastResizeW && height === lastResizeH && dprIn === lastResizeDpr) return;
      lastResizeW = width;
      lastResizeH = height;
      lastResizeDpr = dprIn;
      viewW = width;
      viewH = height;
      viewDpr = dprIn;
      applyDrawingBuffer();
      camera.aspect = width / height;
      camDistance = distanceForAspect(camera.aspect);
      camera.updateProjectionMatrix();
      fog.near = FOG_NEAR * camDistance;
      fog.far = FOG_FAR * camDistance;
      if (still) updateCameraStill();
      else updateCameraLive(0);
      if (compiled) drawScene();
    },

    setRunning(value: boolean) {
      if (destroyed) return;
      running = value;
      if (running) startLoop();
      else stopLoop();
    },

    setStill(value: boolean) {
      if (destroyed || value === still) return;
      still = value;
      if (still) {
        stopLoop();
        lastFrameMs = 0;
        updateCameraStill();
        if (compiled) drawScene();
      } else {
        startLoop();
      }
    },

    setPointer(clientX: number, clientY: number, inside: boolean) {
      if (destroyed) return;
      pointerX = clientX;
      pointerY = clientY;
      pointerInside = inside;
    },

    pulseAt(clientX: number, clientY: number) {
      if (destroyed || still) return;
      projectNodes();
      const index = nearestPoint(projXS, projYS, nodeTotal, clientX, clientY);
      if (index >= 0) startPulse(index);
    },

    pulseStage(stage: number) {
      if (destroyed || still) return;
      const c = Math.min(Math.max(Math.floor(stage), 0), graph.clusters.length - 1);
      startPulse(graph.clusters[c].hub);
    },

    invalidate() {
      if (destroyed) return;
      if (still) {
        updateCameraStill();
        if (compiled) drawScene();
      } else if (!running) {
        updateCameraLive(0);
        if (compiled) drawScene();
      }
    },

    get stats() {
      return stats;
    },

    dispose() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      haloTexture?.dispose();
      for (const mesh of kindMesh) mesh.dispose();
      renderer.dispose();
    },
  };
}

/** Textura radial para los halos: blanca en el centro, transparente en el borde. */
function makeHaloTexture(T: Three, doc: Document) {
  const size = 64;
  const canvas = doc.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.25, "rgba(255, 255, 255, 0.35)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  return new T.CanvasTexture(canvas);
}

/** Grilla del piso: líneas cada 2 unidades, cada quinta más marcada. */
function makeGridGeometry(T: Three, minor: Color3D, major: Color3D) {
  const xFrom = -30;
  const xTo = 110;
  const zFrom = -50;
  const zTo = 30;
  const step = 2;
  const xLines = Math.floor((xTo - xFrom) / step) + 1;
  const zLines = Math.floor((zTo - zFrom) / step) + 1;
  const vertexCount = (xLines + zLines) * 2;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);

  let v = 0;
  let lineIndex = 0;
  for (let i = 0; i < xLines; i++) {
    const x = xFrom + i * step;
    const color = lineIndex % 5 === 0 ? major : minor;
    lineIndex++;
    positions[v * 3] = x;
    positions[v * 3 + 1] = 0;
    positions[v * 3 + 2] = zFrom;
    positions[v * 3 + 3] = x;
    positions[v * 3 + 4] = 0;
    positions[v * 3 + 5] = zTo;
    for (let k = 0; k < 2; k++) {
      colors[(v + k) * 3] = color.r;
      colors[(v + k) * 3 + 1] = color.g;
      colors[(v + k) * 3 + 2] = color.b;
    }
    v += 2;
  }
  for (let i = 0; i < zLines; i++) {
    const z = zFrom + i * step;
    const color = lineIndex % 5 === 0 ? major : minor;
    lineIndex++;
    positions[v * 3] = xFrom;
    positions[v * 3 + 1] = 0;
    positions[v * 3 + 2] = z;
    positions[v * 3 + 3] = xTo;
    positions[v * 3 + 4] = 0;
    positions[v * 3 + 5] = z;
    for (let k = 0; k < 2; k++) {
      colors[(v + k) * 3] = color.r;
      colors[(v + k) * 3 + 1] = color.g;
      colors[(v + k) * 3 + 2] = color.b;
    }
    v += 2;
  }

  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
  const material = new T.LineBasicMaterial({ vertexColors: true });
  return { geometry, material };
}

/** Anillo unitario en el plano XZ (64 segmentos) para los pulsos. */
function makeRingGeometry(T: Three) {
  const segments = 64;
  const positions = new Float32Array(segments * 3);
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    positions[i * 3] = Math.cos(angle);
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = Math.sin(angle);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
  return geometry;
}
