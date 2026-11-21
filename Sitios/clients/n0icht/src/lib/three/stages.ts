/**
 * Las seis etapas del pipeline, en orden. Cada una es un cluster del grafo, una parada de la
 * cámara y el destino de los anclas de scroll (`use:stageAnchor`).
 */
export const STAGES = ["idea", "design", "build", "test", "deploy", "observe"] as const;

export type StageId = (typeof STAGES)[number];

export const STAGE_COUNT = STAGES.length;

/**
 * Índice de una etapa, dada por id o por número. Lo que no existe cae en el rango
 * 0..STAGE_COUNT-1 (un id desconocido da 0).
 */
export function stageIndex(stage: StageId | number): number {
  const index = typeof stage === "string" ? STAGES.indexOf(stage as StageId) : stage;
  if (!Number.isFinite(index) || index < 0) return 0;
  return Math.min(Math.floor(index), STAGE_COUNT - 1);
}
