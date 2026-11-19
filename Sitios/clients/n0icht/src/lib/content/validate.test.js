import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contact } from "./contact.js";
import { terminalContent as content } from "./index.js";
import { jsonLdScript, personJsonLd } from "./seo.js";
import { hero, nav, pendingSections, site } from "./site.js";
import { BOOT_LINE_MAX, validateContent } from "./validate.js";

const page = { hero, pendingSections };

/** Copia del contenido con un cambio, para comprobar que el validador lo detecta. */
const broken = (change) => {
  const copy = structuredClone(content);
  change(copy);
  return validateContent(copy, page);
};

describe("validateContent", () => {
  it("el contenido del sitio es válido", () => {
    assert.deepEqual(validateContent(content, page), []);
  });

  it("la identidad es siempre «Martín Cabrera · n0icht»", () => {
    assert.equal(site.identity, "Martín Cabrera · n0icht");
    assert.equal(broken((copy) => (copy.site.identity = "n0icht")).length, 1);
  });

  it("detecta un link del menú sin sección", () => {
    assert.ok(broken((copy) => copy.nav.push({ label: "Blog", href: "/#blog" })).some((problem) => problem.includes("blog")));
  });

  it("detecta un href que no es un ancla", () => {
    assert.ok(broken((copy) => (copy.nav[0].href = "https://example.com")).length > 0);
  });

  it("detecta una línea de arranque demasiado larga", () => {
    const problems = broken((copy) => copy.terminal.boot.push({ text: "x".repeat(BOOT_LINE_MAX + 1) }));
    assert.equal(problems.length, 1);
  });

  it("detecta un comando sugerido que no existe", () => {
    assert.equal(broken((copy) => copy.terminal.suggestions.push("rm -rf")).length, 1);
  });

  it("detecta proyectos repetidos, un stack vacío y un mail inválido", () => {
    assert.ok(broken((copy) => copy.projects.push(copy.projects[0])).length > 0);
    assert.ok(broken((copy) => (copy.stack[0].items = [])).length > 0);
    assert.ok(broken((copy) => (copy.contact.email = "nope")).length > 0);
  });

  it("site.url va vacío o como origen https sin barra final", () => {
    assert.equal(broken((copy) => (copy.site.url = "https://example.com")).length, 0);
    assert.equal(broken((copy) => (copy.site.url = "https://example.com/")).length, 1);
    assert.equal(broken((copy) => (copy.site.url = "http://example.com")).length, 1);
  });

  it("el menú del sitio apunta a secciones distintas", () => {
    assert.equal(new Set(nav.map((item) => item.href)).size, nav.length);
  });
});

describe("JSON-LD", () => {
  it("declara a la persona con nombre y alias", () => {
    const data = personJsonLd(site, contact);
    assert.equal(data["@type"], "Person");
    assert.equal(data.name, "Martín Cabrera");
    assert.equal(data.alternateName, "n0icht");
  });

  it("no declara perfiles ni URL que son placeholders", () => {
    const data = personJsonLd({ ...site, url: "" }, { ...contact, links: [{ label: "X", href: "https://x.test", todo: true }] });
    assert.equal("sameAs" in data, false);
    assert.equal("url" in data, false);
  });

  it("declara los perfiles confirmados y la URL cuando existen", () => {
    const data = personJsonLd(
      { ...site, url: "https://example.com" },
      { ...contact, links: [{ label: "GitHub", href: "https://github.com/someone" }] },
    );
    assert.deepEqual(data.sameAs, ["https://github.com/someone"]);
    assert.equal(data.url, "https://example.com");
    assert.equal(data.image, "https://example.com/brand/logo-b-glyph-mark.svg");
  });

  it("el script no se puede cerrar desde el contenido", () => {
    const html = jsonLdScript({ name: "</script><script>alert(1)</script>" });
    assert.equal(html.match(/<\/script>/g)?.length, 1);
    assert.ok(html.startsWith('<script type="application/ld+json">'));
    const json = html.slice('<script type="application/ld+json">'.length, -"</script>".length);
    assert.equal(JSON.parse(json).name, "</script><script>alert(1)</script>");
  });
});
