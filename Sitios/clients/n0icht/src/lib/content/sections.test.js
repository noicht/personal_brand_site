import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enabled, numbered } from "./sections.js";
import { features, nav, sections } from "./site.js";

describe("enabled", () => {
  it("deja los ítems sin flag y los de flag prendida", () => {
    const items = [{ id: "a" }, { id: "b", feature: "writing" }, { id: "c", feature: "other" }];
    assert.deepEqual(enabled(items, { writing: true }).map((item) => item.id), ["a", "b"]);
    assert.deepEqual(enabled(items, {}).map((item) => item.id), ["a"]);
  });
});

describe("numbered", () => {
  it("numera en orden con dos dígitos, sin tocar los originales", () => {
    const items = [{ id: "a" }, { id: "b" }];
    const result = numbered(items);
    assert.deepEqual(
      result.map((item) => item.index),
      ["01", "02"],
    );
    assert.equal(items[0].index, undefined);
  });
});

describe("secciones del sitio", () => {
  it("writing aparece exactamente cuando su flag está prendida", () => {
    assert.equal(sections.some((section) => section.id === "writing"), features.writing);
    assert.equal(nav.some((item) => item.href === "/#writing"), features.writing);
  });

  it("enabled con la flag prendida la incluye", () => {
    const items = [{ id: "writing", feature: "writing" }];
    assert.equal(enabled(items, { writing: true })[0].id, "writing");
  });

  it("el orden es pipeline, projects, playground, stack, experience, writing?, contact", () => {
    assert.deepEqual(
      sections.map((section) => section.id),
      ["pipeline", "projects", "playground", "stack", "experience", ...(features.writing ? ["writing"] : []), "contact"],
    );
    assert.deepEqual(
      sections.map((section) => section.index),
      sections.map((_section, i) => String(i + 1).padStart(2, "0")),
    );
  });
});
