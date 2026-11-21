import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SCROLL_KEYS, shouldRealign } from "./realign.ts";

/** Entrada "todo bien": el salto por ancla quedó viejo y hay que realinear. */
const stale = { userScrolled: false, hasTarget: true, targetFollows: true, targetInside: false };

describe("shouldRealign", () => {
  it("realinea cuando el ancla apunta a una sección posterior y nadie scrolleó", () => {
    assert.equal(shouldRealign(stale), true);
  });

  it("no realinea si el usuario scrolleó a mano", () => {
    assert.equal(shouldRealign({ ...stale, userScrolled: true }), false);
  });

  it("no realinea si el hash no apunta a ningún elemento", () => {
    assert.equal(shouldRealign({ ...stale, hasTarget: false }), false);
  });

  it("no realinea si el destino queda antes del playground", () => {
    assert.equal(shouldRealign({ ...stale, targetFollows: false }), false);
  });

  it("no realinea si el destino está dentro del playground", () => {
    assert.equal(shouldRealign({ ...stale, targetInside: true }), false);
  });
});

describe("SCROLL_KEYS", () => {
  it("cubre las teclas que scrollean", () => {
    for (const key of ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]) {
      assert.ok(SCROLL_KEYS.includes(key), `falta ${key}`);
    }
  });
});
