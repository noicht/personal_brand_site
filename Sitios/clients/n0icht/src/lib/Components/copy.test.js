import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

/**
 * Guarda de copy: ningún componente puede tener texto visible escrito a mano — todo sale de
 * `src/lib/content/`. Barre los `.svelte` de `Components/` y `routes/`, saca `<script>` y
 * comentarios, borra los bloques de mustache (de adentro hacia afuera hasta que no queden) y
 * falla si queda texto con letras: en atributos que se leen (`aria-label`, `placeholder`,
 * `title`, `alt`) o en el contenido.
 */

const SRC = new URL("../../", import.meta.url).pathname;
const DIRS = [join(SRC, "lib/Components"), join(SRC, "routes")];

const files = DIRS.flatMap((dir) =>
  readdirSync(dir)
    .filter((name) => name.endsWith(".svelte"))
    .map((name) => join(dir, name)),
);

/**
 * El contenido "plano" de un `.svelte`: sin script, sin comentarios, sin mustaches.
 * @param {string} source
 */
function strip(source) {
  let text = source.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  let previous;
  do {
    previous = text;
    text = text.replace(/\{[^{}]*\}/g, "");
  } while (text !== previous);
  return text;
}

describe("los componentes no llevan copy a mano", () => {
  for (const file of files) {
    it(`${file.split("/").pop()} no tiene texto visible hardcodeado`, () => {
      const text = strip(readFileSync(file, "utf8"));
      const attr = text.match(/(aria-label|placeholder|title|alt)="[^"]*[A-Za-z]{2,}[^"]*"/);
      assert.equal(attr, null, `${file}: atributo con texto a mano: ${attr?.[0]}`);
      const visible = text
        .replace(/<[^>]*>/g, " ")
        .replace(/&[a-z#0-9]+;/gi, " ")
        .match(/[A-Za-z]{2,}/);
      assert.equal(visible, null, `${file}: texto a mano: «${visible?.[0]}»`);
    });
  }
});
