#!/usr/bin/env node
// Genera static/brand/og.png (1200x630), la imagen para compartir del sitio.
//
// Compone un SVG con el texto en las fuentes propias del sitio (Chakra Petch y
// JetBrains Mono, descomprimidas de static/fonts/*.woff2 a TTF en un directorio
// temporal) y lo rasteriza con rsvg-convert. El glifo es el logo oficial, embebido
// sin tocar desde static/brand/logo-b-glyph-mark.svg.
//
// Herramientas necesarias (del sistema, no del repo): woff2_decompress, rsvg-convert
// y magick (solo para medir el ancho del texto y optimizar el PNG final).
//
// No forma parte del build: se corre a mano cuando cambia la identidad o el tagline
// (`npm run og -w n0icht`). Los colores son los tokens de marca, fijos. Todo el
// trabajo temporal (fuentes TTF, fonts.conf, SVG y PNG de prueba) vive en un
// directorio de os.tmpdir() que se borra al terminar; con --keep se conserva e
// imprime su ruta.
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hero, site } from "../src/lib/content/site.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const staticDir = join(root, "static");
const fontsDir = join(staticDir, "fonts");
const outPng = join(staticDir, "brand", "og.png");
const keepWork = process.argv.includes("--keep");

// Colores de marca (tokens.css)
const C = {
  bg: "#0B0D10",
  grid: "#5CE1E6",
  amber: "#FF6A00",
  green: "#39FF88",
  muted: "#8B98A5",
  text: "#E6EDF3",
};

const W = 1200;
const H = 630;
const MARGIN = 96; // márgenes laterales del texto
const TEXT_W = W - MARGIN * 2; // 1008 px disponibles
const SPARE = 8; // aire mínimo a los costados del título

const LOGO = join(staticDir, "brand", "logo-b-glyph-mark.svg");

for (const name of ["woff2_decompress", "rsvg-convert", "magick"]) tool(name);

// ---------------------------------------------------------------- utilidades

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function fail(message) {
  console.error(`og-image: ${message}`);
  process.exit(1);
}

function tool(name) {
  try {
    execFileSync(name, ["--version"], { stdio: "pipe" });
  } catch {
    try {
      execFileSync(name, [], { stdio: "pipe" });
    } catch (error) {
      if (error?.code === "ENOENT") fail(`falta la herramienta «${name}» (instalala con tu gestor de paquetes)`);
      // otras herramientas pueden quejarse de --version: basta con que exista
    }
  }
}

// ---------------------------------------------------------------- fuentes

const work = mkdtempSync(join(tmpdir(), "n0-og-"));
const fontDir = join(work, "fonts");
const cacheDir = join(work, "cache");
mkdirSync(fontDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });

const woff2Files = readdirSync(fontsDir).filter((f) => f.endsWith(".woff2"));
if (woff2Files.length === 0) fail(`no hay .woff2 en ${fontsDir}`);

// woff2_decompress toma UN argumento (el .woff2) y escribe el .ttf al lado:
// primero se copian a un temporal para no ensuciar static/.
for (const file of woff2Files) {
  const copy = join(fontDir, file);
  copyFileSync(join(fontsDir, file), copy);
  try {
    execFileSync("woff2_decompress", [copy], { stdio: "pipe" });
  } catch (error) {
    fail(`woff2_decompress falló con ${file}: ${error.message}`);
  }
}

const fontsConf = join(work, "fonts.conf");
writeFileSync(
  fontsConf,
  `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontDir}</dir>
  <cachedir>${cacheDir}</cachedir>
</fontconfig>
`,
);

const ENV = { ...process.env, FONTCONFIG_FILE: fontsConf };

// El SVG del glifo lleva un bloque <metadata> con el manifiesto C2PA (~8 KB en
// base64) que el parser de librsvg no traga: la imagen no se dibuja. Se embebe una
// copia en data: URI con ese bloque afuera — el dibujo queda intacto, byte a byte.
// (file:// anda para algunas rutas y no para otras en librsvg; data: es determinista.)
const logoDataUri =
  "data:image/svg+xml;base64," +
  Buffer.from(
    readFileSync(LOGO, "utf8").replace(/<metadata\b[^>]*>[\s\S]*?<\/metadata>/g, ""),
    "utf8",
  ).toString("base64");

/**
 * Rasteriza un SVG de prueba y devuelve la tinta del texto: `width` en px y
 * `rightGap`, la distancia del borde derecho de la tinta al ancla (x=1000).
 * El letter-spacing deja un hueco después del último glifo que no tiene tinta:
 * medir la tinta es lo único que permite anclar piezas por su borde real.
 */
function measureText({ text, family, size, weight = 400, spacing = 0 }) {
  const probe = join(work, `probe-${Math.random().toString(36).slice(2)}.svg`);
  writeFileSync(
    probe,
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="220">
  <rect width="1600" height="220" fill="#ffffff"/>
  <text x="1000" y="160" text-anchor="end" font-family="${family}" font-weight="${weight}" font-size="${size}"${spacing ? ` letter-spacing="${spacing}"` : ""} fill="#000000">${esc(text)}</text>
</svg>`,
  );
  const png = probe.replace(/\.svg$/, ".png");
  execFileSync("rsvg-convert", ["-o", png, probe], { env: ENV, stdio: "pipe" });
  // % @ = bounding box de la imagen tras trim; con -fuzz se va el antialias claro.
  // %X/%Y = dónde quedó la tinta recortada dentro del original.
  const out = execFileSync(
    "magick",
    [png, "-fuzz", "12%", "-trim", "-format", "%@ %X %Y", "info:"],
    { encoding: "utf8" },
  );
  const [box, x, y] = out.trim().split(/\s+/);
  const [width, height] = box.split("x").map(Number);
  const inkRight = Number(x) + width;
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(inkRight)) {
    fail(`no pude medir «${text}»`);
  }
  return { width, rightGap: 1000 - inkRight };
}

// ---------------------------------------------------------------- texto

const FONT_DISPLAY = "Chakra Petch";
// La familia del 600 se llama «Chakra Petch SemiBold» en la tabla de nombres:
// pedir «Chakra Petch» con peso 600 caería en el Bold del 700.
const FONT_DISPLAY_SEMI = "Chakra Petch SemiBold";
const FONT_MONO = "JetBrains Mono";

const microSpacing = 22 * 0.14; // letter-spacing en px (0.14em a 22px)

// La micro-etiqueta son tres piezas: el estado a la derecha, la celda verde 12 px
// a su izquierda y la etiqueta 28 px a la izquierda de la celda. Se miden las dos
// tintas por separado para anclar por el borde real (el letter-spacing deja un
// hueco sin tinta después del último glifo).
const statusInk = measureText({
  text: hero.status,
  family: FONT_MONO,
  size: 22,
  spacing: microSpacing,
});
const labelInk = measureText({
  text: hero.label,
  family: FONT_MONO,
  size: 22,
  spacing: microSpacing,
});

// Borde derecho de la tinta del estado: el ancla queda en 1104 y el letter-spacing
// corre la tinta a la izquierda lo que mide `rightGap`
const statusInkRight = W - MARGIN - statusInk.rightGap;
const statusInkLeft = statusInkRight - statusInk.width;
const cell = 14;
const cellX = statusInkLeft - 12 - cell; // borde derecho de la celda: 12 px a la izquierda del texto
const cellY = 132 - 15; // apoya sobre la línea base
const labelAnchorX = cellX - 28 + labelInk.rightGap; // borde derecho de la tinta de la etiqueta: 28 px a la izquierda de la celda

// El título entra en TEXT_W - SPARE; se mide de verdad achicando desde 76px
const identitySizeMemo = new Map();
const identityWidth = (size) => {
  if (!identitySizeMemo.has(size)) {
    identitySizeMemo.set(
      size,
      measureText({ text: site.identity, family: FONT_DISPLAY, size, weight: 700 }).width,
    );
  }
  return identitySizeMemo.get(size);
};
const fits = (size) => identityWidth(size) <= TEXT_W - SPARE;

let identitySize = 76;
if (!fits(identitySize)) {
  const w76 = identityWidth(identitySize);
  identitySize = Math.max(40, Math.floor((identitySize * (TEXT_W - SPARE)) / w76));
  while (identitySize > 40 && !fits(identitySize)) identitySize--;
  while (identitySize < 76 && fits(identitySize + 1)) identitySize++;
}
const identityW = identityWidth(identitySize);

// Tagline: el punto final va en verde, igual que en el hero
const tagline = site.tagline.endsWith(".")
  ? { head: site.tagline.slice(0, -1), dot: "." }
  : { head: site.tagline, dot: "" };

const widths = {
  identity: identityW,
  tagline: measureText({ text: tagline.head + tagline.dot, family: FONT_DISPLAY_SEMI, size: 44 }).width,
  role: measureText({ text: site.role, family: FONT_MONO, size: 26 }).width,
  status: statusInk.width,
  label: labelInk.width,
};

// ---------------------------------------------------------------- SVG

// Grilla de plano: líneas cada 48px tenues y cada 240px más marcadas, sin solapar
const gridPaths = `
    <path d="M48 0V240M96 0V240M144 0V240M192 0V240M0 48H240M0 96H240M0 144H240M0 192H240" stroke="${C.grid}" stroke-opacity="0.07" stroke-width="1" fill="none"/>
    <path d="M0 0H240M0 0V240" stroke="${C.grid}" stroke-opacity="0.11" stroke-width="1" fill="none"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <defs>
    <pattern id="grid" width="240" height="240" patternUnits="userSpaceOnUse">${gridPaths}
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>

  <!-- Marco: cuatro corchetes ámbar, motivo de los paneles -->
  <g stroke="${C.amber}" stroke-width="4" fill="none">
    <path d="M48 88V48H88"/>
    <path d="M${W - 48} 88V48H${W - 88}"/>
    <path d="M48 ${H - 48}V${H - 88}H88"/>
    <path d="M${W - 48} ${H - 48}V${H - 88}H${W - 88}"/>
  </g>

  <!-- Glifo oficial (copia sin el metadata C2PA que rompe a librsvg), sin tocar el dibujo -->
  <image href="${logoDataUri}" x="96" y="104" width="176" height="176"/>

  <!-- Micro-etiqueta arriba a la derecha: etiqueta, celda verde y estado como piezas
       separadas (12 px entre celda y estado, 28 px entre etiqueta y celda) -->
  <text x="${labelAnchorX}" y="132" text-anchor="end" font-family="${FONT_MONO}" font-size="22" letter-spacing="${microSpacing}" fill="${C.muted}">${esc(hero.label)}</text>
  <rect x="${cellX}" y="${cellY}" width="${cell}" height="${cell}" fill="${C.green}"/>
  <text x="${W - MARGIN}" y="132" text-anchor="end" font-family="${FONT_MONO}" font-size="22" letter-spacing="${microSpacing}" fill="${C.muted}">${esc(hero.status)}</text>

  <!-- Identidad: Chakra Petch Bold, lo más grande que entra en ${TEXT_W} px -->
  <text x="${MARGIN}" y="388" font-family="${FONT_DISPLAY}" font-weight="700" font-size="${identitySize}" fill="${C.text}">${esc(site.identity)}</text>

  <!-- Tagline: el punto final en verde, como en el hero -->
  <text x="${MARGIN}" y="456" font-family="${FONT_DISPLAY_SEMI}" font-size="44" fill="${C.text}">${esc(tagline.head)}<tspan fill="${C.green}">${esc(tagline.dot)}</tspan></text>

  <!-- Rol: JetBrains Mono -->
  <text x="${MARGIN}" y="516" font-family="${FONT_MONO}" font-size="26" fill="${C.muted}">${esc(site.role)}</text>
</svg>
`;

// ---------------------------------------------------------------- salida

const outSvg = join(work, "og.svg");
writeFileSync(outSvg, svg);

execFileSync("rsvg-convert", ["-o", outPng, outSvg], { env: ENV, stdio: "pipe" });

// Optimización: sin metadatos; si pasa de 120 KB se cuantiza a 256 colores
let size = statSync(outPng).size;
if (size > 120 * 1024) {
  execFileSync("magick", [outPng, "-strip", outPng], { stdio: "pipe" });
  size = statSync(outPng).size;
}
if (size > 120 * 1024) {
  const quantized = join(work, "og.quant.png");
  execFileSync("magick", [outPng, "-strip", "-colors", "256", "-type", "Palette", quantized], {
    stdio: "pipe",
  });
  copyFileSync(quantized, outPng);
  size = statSync(outPng).size;
}

const dims = execFileSync("magick", ["identify", "-format", "%wx%h", outPng], {
  encoding: "utf8",
});

if (keepWork) {
  console.log(`  trabajo intermedio conservado: ${work}`);
} else {
  rmSync(work, { recursive: true, force: true });
}

console.log(`og.png → ${outPng}`);
console.log(`  tamaño: ${dims.trim()} · ${(size / 1024).toFixed(1)} KB`);
console.log(`  identity: ${site.identity} — ${identitySize}px, ${identityW}px de ancho (límite ${TEXT_W - SPARE})`);
console.log(`  tagline (${site.tagline}): ${widths.tagline}px a 44px SemiBold`);
console.log(`  role (${site.role}): ${widths.role}px a 26px mono`);
console.log(
  `  micro-label («${hero.label} ■ ${hero.status}»): status ${widths.status}px + label ${widths.label}px a 22px mono, ls ${microSpacing}px`,
);
