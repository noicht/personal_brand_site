import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contact } from "./contact.js";
import { pageContent as page, terminalContent as content } from "./index.js";
import { jsonLdScript, personJsonLd } from "./seo.js";
import { nav, site } from "./site.js";
import { BOOT_LINE_MAX, validateContent } from "./validate.js";

/** Copia del contenido con un cambio, para comprobar que el validador lo detecta. */
const broken = (change) => {
  const copy = structuredClone(content);
  const pageCopy = structuredClone(page);
  change(copy, pageCopy);
  return validateContent(copy, pageCopy);
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

  it("detecta proyectos repetidos y un mail inválido", () => {
    assert.ok(broken((copy) => copy.projects.push(copy.projects[0])).length > 0);
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

  it("detecta un id de sección que no existe ni está pendiente", () => {
    const problems = broken((_copy, pageCopy) => pageCopy.sections.push({ id: "nope", index: "99" }));
    assert.ok(problems.some((problem) => problem.includes("nope")));
  });

  it("detecta una etapa del pipeline que no es una parada del recorrido", () => {
    assert.ok(broken((_copy, pageCopy) => (pageCopy.pipeline.stages[0].id = "ship")).length > 0);
  });

  it("detecta un diagrama roto y una decisión incompleta", () => {
    assert.ok(
      broken((copy) => copy.projects[0].architecture.edges.push({ from: "web", to: "ghost" })).length > 0,
    );
    assert.ok(broken((copy) => (copy.projects[0].decisions[0].tradeoff = "")).length > 0);
    assert.ok(
      broken((copy) => (copy.projects[0].architecture.edges[0].label = "demasiado-largo")).length > 0,
    );
  });

  it("detecta un porcentaje en el stack y un grupo fuera de orden", () => {
    assert.ok(broken((copy) => (copy.stack[0].items[0].note = "80% real")).length > 0);
    assert.ok(
      broken((copy) => {
        const [first] = copy.stack.splice(0, 1);
        copy.stack.push(first);
      }).length > 0,
    );
  });

  it("detecta una experiencia desordenada", () => {
    const problems = broken((_copy, pageCopy) => {
      const entries = pageCopy.experience.entries;
      [entries[0], entries[entries.length - 1]] = [entries[entries.length - 1], entries[0]];
    });
    assert.ok(problems.length > 0);
  });

  it("detecta un post con fecha que no existe", () => {
    assert.ok(broken((_copy, pageCopy) => (pageCopy.writing.posts[0].date = "2026-02-30")).length > 0);
  });

  it("detecta un endpoint de contacto que no es https y un mailBody sin {message}", () => {
    assert.ok(broken((copy) => (copy.contact.endpoint = "http://example.com")).length > 0);
    assert.ok(broken((_copy, pageCopy) => (pageCopy.contactSection.mailBody = "{name}")).length > 0);
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
