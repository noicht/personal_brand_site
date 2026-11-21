// @ts-check
/**
 * Guardia de salida a producción: comprueba que los lugares que nombran el origen de
 * producción coincidan entre sí — `domain` de `site.json`, `site.url` del contenido,
 * la línea `Sitemap:` de `static/robots.txt` y la existencia de `static/sitemap.xml`.
 *
 * Es pura: recibe los textos ya leídos y devuelve la lista de problemas (vacía si está
 * todo bien). La llaman los tests con los archivos reales y con entradas armadas para
 * cubrir las dos ramas (con y sin dominio). `sitemap: null` significa "el archivo no existe".
 */

/**
 * @param {{ domain: string, url: string, robots: string, sitemap: string | null }} input
 * @returns {string[]} Problemas encontrados, en español y diciendo qué editar.
 */
export function releaseProblems({ domain, url, robots, sitemap }) {
  /** @type {string[]} */
  const problems = [];
  const lines = robots.split(/\r?\n/).map((line) => line.trim());
  const hasSitemapLine = lines.some((line) => line.startsWith("Sitemap:"));

  if (domain === "") {
    if (url !== "") {
      problems.push(`site.url es «${url}» pero site.json.domain está vacío: vaciar site.url en content/site.js`);
    }
    if (sitemap !== null) {
      problems.push("static/sitemap.xml existe pero site.json.domain está vacío: borrarlo hasta tener dominio");
    }
    if (hasSitemapLine) {
      problems.push("static/robots.txt tiene una línea Sitemap: pero site.json.domain está vacío: sacarla");
    }
  } else {
    const origin = `https://${domain}`;
    if (url !== origin) {
      problems.push(`site.url es «${url || "(vacío)"}» y tiene que ser «${origin}» (content/site.js)`);
    }
    if (sitemap === null) {
      problems.push(`falta static/sitemap.xml: crearlo con <loc>${origin}/</loc> (ver README, "Salir a producción")`);
    } else if (!sitemap.includes(`<loc>${origin}/</loc>`)) {
      problems.push(`static/sitemap.xml no tiene <loc>${origin}/</loc>`);
    }
    const expected = `Sitemap: ${origin}/sitemap.xml`;
    if (!lines.includes(expected)) {
      problems.push(`static/robots.txt no tiene la línea «${expected}»`);
    }
  }

  // Independiente del dominio: el archivo tiene que dejar entrar a los bots
  if (!lines.includes("User-agent: *")) {
    problems.push("static/robots.txt no tiene «User-agent: *»");
  }
  if (lines.some((line) => /^Disallow:\s*\/[*]?\s*$/.test(line))) {
    problems.push("static/robots.txt tiene «Disallow: /»: los bots no podrían ver el X-Robots-Tag de QA");
  }

  return problems;
}
