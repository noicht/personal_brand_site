// @ts-check
/**
 * Datos estructurados (JSON-LD) de la persona. Sin DOM: lo usa `Seo.svelte` y se prueba en Node.
 */

/**
 * @param {import("./types.js").Site} site
 * @param {import("./types.js").Contact} contact
 * @returns {Record<string, unknown>}
 */
export function personJsonLd(site, contact) {
  // Solo los perfiles confirmados: un placeholder no se le declara a un buscador
  const sameAs = contact.links.filter((link) => !link.todo).map((link) => link.href);
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: site.name,
    alternateName: site.alias,
    jobTitle: site.jobTitle,
    description: site.description,
    knowsAbout: site.knowsAbout,
    ...(site.url ? { url: site.url, image: site.url + site.logo } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/**
 * El `<script type="application/ld+json">` listo para `{@html}`. Escapa `<` para que ningún texto
 * del contenido pueda cerrar el script.
 * @param {Record<string, unknown>} data
 */
export function jsonLdScript(data) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</` + "script>";
}
