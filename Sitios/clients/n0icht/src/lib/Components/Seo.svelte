<script>
  /**
   * Etiquetas del `<head>`: título, descripción, Open Graph y el JSON-LD de la persona.
   * Todo sale de `content/site.js` y `content/contact.js`.
   *
   * Canonical y `og:url` necesitan una URL absoluta. QA y producción reciben el mismo build, así
   * que el origen es un dato del contenido (`site.url`): mientras esté vacío no se emiten.
   */
  import { contact } from "$lib/content/contact.js";
  import { jsonLdScript, personJsonLd } from "$lib/content/seo.js";
  import { site } from "$lib/content/site.js";

  const jsonLd = jsonLdScript(personJsonLd(site, contact));
</script>

<svelte:head>
  <title>{site.title}</title>
  <meta name="description" content={site.description} />
  <meta name="author" content={site.name} />
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content={site.identity} />
  <meta property="og:title" content={site.title} />
  <meta property="og:description" content={site.description} />
  <meta property="og:locale" content={site.locale} />
  <meta name="twitter:card" content="summary" />
  {#if site.url}
    <link rel="canonical" href="{site.url}/" />
    <meta property="og:url" content="{site.url}/" />
  {/if}
  {@html jsonLd}
</svelte:head>
