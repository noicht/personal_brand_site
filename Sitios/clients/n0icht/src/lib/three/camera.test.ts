import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLUSTER_CENTERS } from "./graph.ts";
import {
  cameraPoseAt,
  clamp,
  clusterAt,
  clusterWeight,
  damp,
  distanceForAspect,
  alongRegion,
  smoothstep,
  stageFromProgress,
  stagePosition,
  waypointsFor,
} from "./camera.ts";
import { STAGE_COUNT } from "./stages.ts";

describe("clamp y smoothstep", () => {
  it("acotan y suavizan", () => {
    assert.equal(clamp(5, 0, 2), 2);
    assert.equal(clamp(-1, 0, 2), 0);
    assert.equal(smoothstep(0), 0);
    assert.equal(smoothstep(1), 1);
    assert.equal(smoothstep(0.5), 0.5);
    assert.equal(smoothstep(2), 1);
  });
});

describe("alongRegion", () => {
  it("da 0 arriba, 0.5 en el medio y 1 abajo", () => {
    assert.equal(alongRegion(0, 100, 200), 0);
    assert.equal(alongRegion(300, 100, 200), 1);
    assert.ok(Math.abs(alongRegion(150, 100, 200) - 0.25) < 1e-12);
    assert.ok(Math.abs(alongRegion(200, 100, 200) - 0.5) < 1e-12);
  });

  it("con alto 0 da 0", () => {
    assert.equal(alongRegion(50, 100, 0), 0);
    assert.equal(alongRegion(50, 100, -10), 0);
  });
});

describe("stagePosition", () => {
  it("en el centro de la región i vale i", () => {
    for (let i = 0; i < STAGE_COUNT; i++) {
      assert.equal(stagePosition(i, 0.5), i);
    }
  });

  it("en el borde entre dos regiones da el medio", () => {
    assert.equal(stagePosition(2, 1), stagePosition(3, 0));
    assert.equal(stagePosition(2, 1), 2.5);
  });

  it("acota en los dos extremos", () => {
    assert.equal(stagePosition(-3, 0.5), 0);
    assert.equal(stagePosition(0, 0), 0);
    assert.equal(stagePosition(STAGE_COUNT - 1, 1), STAGE_COUNT - 1);
    assert.equal(stagePosition(99, 0.5), STAGE_COUNT - 1);
  });

  it("un along fuera de rango se acota", () => {
    assert.equal(stagePosition(2, -5), stagePosition(2, 0));
    assert.equal(stagePosition(2, 5), stagePosition(2, 1));
  });
});

describe("stageFromProgress", () => {
  it("reparte el progreso entre las etapas", () => {
    assert.equal(stageFromProgress(0), 0);
    assert.equal(stageFromProgress(0.5), 2.5);
    assert.equal(stageFromProgress(1), 5);
  });

  it("acota y devuelve 0 con NaN", () => {
    assert.equal(stageFromProgress(-1), 0);
    assert.equal(stageFromProgress(2), 5);
    assert.equal(stageFromProgress(NaN), 0);
    assert.equal(stageFromProgress(Infinity), 0);
  });
});

describe("clusterAt", () => {
  it("redondea a la parada más cercana", () => {
    assert.equal(clusterAt(0.49), 0);
    assert.equal(clusterAt(0.5), 1);
    assert.equal(clusterAt(2.4), 2);
  });

  it("acota y devuelve 0 con NaN", () => {
    assert.equal(clusterAt(-3), 0);
    assert.equal(clusterAt(99), 5);
    assert.equal(clusterAt(NaN), 0);
  });
});

describe("clusterWeight", () => {
  it("vale 1 en su parada y 0 a una etapa de distancia", () => {
    assert.equal(clusterWeight(2, 2), 1);
    assert.equal(clusterWeight(2, 1), 0);
    assert.equal(clusterWeight(2, 3), 0);
  });

  it("vale 0.5 a mitad de camino y los vecinos suman 1", () => {
    assert.equal(clusterWeight(2.5, 2), 0.5);
    assert.equal(clusterWeight(2.5, 3), 0.5);
    for (const p of [2.1, 2.3, 2.7, 2.9]) {
      const a = clusterWeight(p, 2);
      const b = clusterWeight(p, 3);
      assert.ok(Math.abs(a + b - 1) < 1e-12, `suma en ${p}: ${a + b}`);
    }
  });
});

describe("waypointsFor", () => {
  const waypoints = waypointsFor(CLUSTER_CENTERS);

  it("genera una parada por centro", () => {
    assert.equal(waypoints.length, CLUSTER_CENTERS.length);
  });

  it("el target cae sobre el centro del cluster", () => {
    waypoints.forEach((w, i) => {
      assert.equal(w.tx, CLUSTER_CENTERS[i].x);
      assert.equal(w.tz, CLUSTER_CENTERS[i].z);
    });
  });

  it("la cámara queda arriba del piso y adelante del target", () => {
    for (const w of waypoints) {
      assert.ok(w.py > 0);
      assert.ok(w.pz > w.tz);
    }
  });
});

describe("cameraPoseAt", () => {
  const waypoints = waypointsFor(CLUSTER_CENTERS);
  const out = { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0 };

  it("en posiciones enteras devuelve la parada exacta", () => {
    for (let i = 0; i < waypoints.length; i++) {
      cameraPoseAt(i, waypoints, out);
      for (const key of ["px", "py", "pz", "tx", "ty", "tz"] as const) {
        assert.ok(Math.abs(out[key] - waypoints[i][key]) < 1e-9, `${key} en ${i}`);
      }
    }
  });

  it("acota por debajo de 0 y por encima de la última", () => {
    cameraPoseAt(-3, waypoints, out);
    for (const key of ["px", "py", "pz", "tx", "ty", "tz"] as const) {
      assert.ok(Math.abs(out[key] - waypoints[0][key]) < 1e-9);
    }
    cameraPoseAt(99, waypoints, out);
    for (const key of ["px", "py", "pz", "tx", "ty", "tz"] as const) {
      assert.ok(Math.abs(out[key] - waypoints[waypoints.length - 1][key]) < 1e-9);
    }
  });

  it("es continua alrededor de una parada", () => {
    cameraPoseAt(2 - 1e-4, waypoints, out);
    const before = { ...out };
    cameraPoseAt(2 + 1e-4, waypoints, out);
    for (const key of ["px", "py", "pz", "tx", "ty", "tz"] as const) {
      assert.ok(Math.abs(out[key] - before[key]) < 0.05, `${key} salta`);
    }
  });

  it("devuelve el mismo objeto out", () => {
    const result = cameraPoseAt(1.5, waypoints, out);
    assert.equal(result, out);
  });

  it("a mitad de tramo la x queda entre las de las paradas", () => {
    cameraPoseAt(0.5, waypoints, out);
    assert.ok(out.px > waypoints[0].px && out.px < waypoints[1].px, `px=${out.px}`);
  });

  it("distance aleja la cámara del target sin moverlo", () => {
    cameraPoseAt(1.3, waypoints, out, 1);
    const near = { ...out };
    cameraPoseAt(1.3, waypoints, out, 2);
    const distNear = Math.hypot(near.px - near.tx, near.py - near.ty, near.pz - near.tz);
    const distFar = Math.hypot(out.px - out.tx, out.py - out.ty, out.pz - out.tz);
    assert.ok(Math.abs(distFar - distNear * 2) < 1e-9);
    assert.equal(out.tx, near.tx);
    assert.equal(out.ty, near.ty);
    assert.equal(out.tz, near.tz);
  });
});

describe("distanceForAspect", () => {
  it("panorámico da 1, vertical da 2, cuadrado da 1.2", () => {
    assert.equal(distanceForAspect(16 / 9), 1);
    assert.equal(distanceForAspect(9 / 16), 2);
    assert.equal(distanceForAspect(1), 1.2);
  });

  it("nunca aumenta cuando el aspecto crece", () => {
    let previous = Infinity;
    for (let aspect = 0.3; aspect <= 3; aspect += 0.1) {
      const d = distanceForAspect(aspect);
      assert.ok(d <= previous + 1e-12);
      previous = d;
    }
  });

  it("aspecto 0 o no finito da 1", () => {
    assert.equal(distanceForAspect(0), 1);
    assert.equal(distanceForAspect(NaN), 1);
    assert.equal(distanceForAspect(Infinity), 1);
  });
});

describe("damp", () => {
  it("con dt 0 devuelve current", () => {
    assert.equal(damp(3, 9, 4, 0), 3);
  });

  it("con dt grande se acerca a target", () => {
    assert.ok(Math.abs(damp(0, 10, 4, 100) - 10) < 1e-9);
  });

  it("dos medios pasos equivalen a uno entero", () => {
    const full = damp(1, 7, 4, 0.1);
    const half = damp(damp(1, 7, 4, 0.05), 7, 4, 0.05);
    assert.ok(Math.abs(full - half) < 1e-12);
  });
});
