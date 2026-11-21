import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { terminalContent as content } from "../content/index.js";
import { palette } from "../content/site.js";
import { execute } from "./commands.ts";
import { buildPaletteItems, filterPaletteItems } from "./palette.ts";

const labels = { ...palette.groups, email: palette.emailLabel };
const items = buildPaletteItems(content, labels);
const found = (query: string) => filterPaletteItems(items, query).map((item) => item.label);

describe("buildPaletteItems", () => {
  it("tiene una entrada por sección del menú, con su ancla", () => {
    const navigate = items.filter((item) => item.effect.type === "navigate");
    assert.deepEqual(
      navigate.map((item) => item.effect),
      content.nav.map((item) => ({ type: "navigate", href: item.href })),
    );
  });

  it("ofrece los comandos de la terminal menos clear, y todos corren", () => {
    const commands = items.flatMap((item) => (item.effect.type === "run" ? [item.effect.command] : []));
    assert.ok(commands.includes("deploy --prod"));
    assert.ok(!commands.includes("clear"));
    for (const command of commands) {
      assert.ok(!execute(command, content).lines.some((line) => line.kind === "error"), command);
    }
  });

  it("incluye el mail y los links de contacto", () => {
    const hrefs = items.flatMap((item) => (item.effect.type === "open" ? [item.effect.href] : []));
    assert.deepEqual(hrefs, [`mailto:${content.contact.email}`, ...content.contact.links.map((link) => link.href)]);
  });

  it("no repite ids", () => {
    assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  });
});

describe("filterPaletteItems", () => {
  it("sin búsqueda devuelve todo en el orden original", () => {
    assert.deepEqual(filterPaletteItems(items, ""), items);
    assert.deepEqual(filterPaletteItems(items, "   "), items);
  });

  it("no distingue mayúsculas", () => {
    assert.deepEqual(found("PROJ"), found("proj"));
    assert.equal(found("proj")[0], "Projects");
  });

  it("pone primero lo que empieza con la búsqueda", () => {
    assert.equal(found("con")[0], "Contact");
    assert.equal(found("st")[0], "Stack");
  });

  it("busca también en la descripción y en el grupo", () => {
    assert.ok(found("ship").includes("deploy --prod"));
    assert.ok(found("github").includes("GitHub"));
    assert.deepEqual(found("go to"), content.nav.map((item) => item.label));
  });

  it("exige todas las palabras", () => {
    assert.deepEqual(found("ls projects"), ["ls projects"]);
    assert.deepEqual(found("ls zzz"), []);
  });

  it("sin coincidencias devuelve una lista vacía", () => {
    assert.deepEqual(found("zzzz"), []);
  });
});
