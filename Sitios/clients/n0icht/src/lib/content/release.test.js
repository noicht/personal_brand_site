import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { releaseProblems } from "./release.js";
import { site } from "./site.js";

const siteJsonPath = new URL("../../../site.json", import.meta.url);
const robotsPath = new URL("../../../static/robots.txt", import.meta.url);
const sitemapPath = new URL("../../../static/sitemap.xml", import.meta.url);
const ogPath = new URL(`../../../static${site.ogImage.path}`, import.meta.url);

const ROBOTS_OK = "User-agent: *\nAllow: /\n";

describe("releaseProblems", () => {
  it("sin dominio: url y sitemap vacíos, sin línea Sitemap:, robots sano", () => {
    assert.deepEqual(
      releaseProblems({ domain: "", url: "", robots: ROBOTS_OK, sitemap: null }),
      [],
    );
  });

  it("sin dominio detecta url cargada, sitemap existente y línea Sitemap:", () => {
    const problems = releaseProblems({
      domain: "",
      url: "https://example.com",
      robots: `${ROBOTS_OK}Sitemap: https://example.com/sitemap.xml\n`,
      sitemap: "<urlset></urlset>",
    });
    assert.equal(problems.length, 3);
    assert.ok(problems.some((p) => p.includes("site.url")));
    assert.ok(problems.some((p) => p.includes("sitemap.xml existe")));
    assert.ok(problems.some((p) => p.includes("línea Sitemap:")));
  });

  it("con dominio exige site.url, sitemap.xml y la línea Sitemap: del mismo origen", () => {
    const good = releaseProblems({
      domain: "example.com",
      url: "https://example.com",
      robots: `${ROBOTS_OK}Sitemap: https://example.com/sitemap.xml\n`,
      sitemap: '<?xml version="1.0"?><urlset><url><loc>https://example.com/</loc></url></urlset>',
    });
    assert.deepEqual(good, []);

    const missing = releaseProblems({
      domain: "example.com",
      url: "",
      robots: ROBOTS_OK,
      sitemap: null,
    });
    assert.equal(missing.length, 3);
    assert.ok(missing.some((p) => p.includes("site.url")));
    assert.ok(missing.some((p) => p.includes("sitemap.xml")));
    assert.ok(missing.some((p) => p.includes("Sitemap:")));

    const wrongOrigin = releaseProblems({
      domain: "example.com",
      url: "https://example.com",
      robots: `${ROBOTS_OK}Sitemap: https://otro.com/sitemap.xml\n`,
      sitemap: "<loc>https://otro.com/</loc>",
    });
    assert.equal(wrongOrigin.length, 2);
  });

  it("robots siempre pide User-agent: * y nada de Disallow: /", () => {
    const problems = releaseProblems({
      domain: "",
      url: "",
      robots: "User-agent: *\nDisallow: /\n",
      sitemap: null,
    });
    assert.equal(problems.length, 1);
    assert.ok(problems[0].includes("Disallow"));

    const noAgent = releaseProblems({ domain: "", url: "", robots: "Allow: /\n", sitemap: null });
    assert.equal(noAgent.length, 1);
    assert.ok(noAgent[0].includes("User-agent"));
  });
});

describe("salida a producción", () => {
  it("site.json, site.url, robots.txt y sitemap.xml coinciden", () => {
    const domain = JSON.parse(readFileSync(siteJsonPath, "utf8")).domain;
    assert.equal(typeof domain, "string", "site.json tiene que tener «domain» como string");
    const robots = readFileSync(robotsPath, "utf8");
    const sitemap = existsSync(sitemapPath) ? readFileSync(sitemapPath, "utf8") : null;
    assert.deepEqual(releaseProblems({ domain, url: site.url, robots, sitemap }), []);
  });

  it("la imagen og existe, es un PNG del tamaño declarado y pesa ≤ 300 KB", () => {
    assert.ok(existsSync(ogPath), `falta ${site.ogImage.path}: generarla con npm run og -w n0icht`);
    const png = readFileSync(ogPath);
    assert.ok(png.length <= 300 * 1024, `${site.ogImage.path} pesa ${png.length} bytes (> 300 KB)`);
    assert.deepEqual(
      [...png.subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      `${site.ogImage.path} no empieza con la firma PNG`,
    );
    assert.equal(png.readUInt32BE(16), site.ogImage.width, "ancho del IHDR ≠ site.ogImage.width");
    assert.equal(png.readUInt32BE(20), site.ogImage.height, "alto del IHDR ≠ site.ogImage.height");
  });
});
