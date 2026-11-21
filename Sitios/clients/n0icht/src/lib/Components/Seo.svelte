<script>
  /**
   * Etiquetas del `<head>`: título, descripción, Open Graph, Twitter y el JSON-LD de la persona.
   * Todo sale de `content/site.js` y `content/contact.js`.
   *
   * QA y producción reciben el mismo build, así que el origen es un dato del contenido
   * (`site.url`): toda etiqueta que necesita una URL absoluta (canonical, `og:url`,
   * `og:image*`, `twitter:image*`) depende de él y no se emite mientras esté vacío.
   * `twitter:title`, `twitter:description` y `twitter:card` van siempre: no necesitan dominio.
   */
  import { contact } from "$lib/content/contact.js";
  import { absoluteUrl, jsonLdScript, personJsonLd } from "$lib/content/seo.js";
  import { site } from "$lib/content/site.js";

  const jsonLd = jsonLdScript(personJsonLd(site, contact));
  const canonical = absoluteUrl(site, "/");
  const image = absoluteUrl(site, site.ogImage.path);
  const card = image ? "summary_large_image" : "summary";
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
  <meta name="twitter:title" content={site.title} />
  <meta name="twitter:description" content={site.description} />
  <meta name="twitter:card" content={card} />
  {#if site.url}
    <link rel="canonical" href={canonical} />
    <meta property="og:url" content={canonical} />
    <meta property="og:image" content={image} />
    <meta property="og:image:type" content={site.ogImage.type} />
    <meta property="og:image:width" content={site.ogImage.width} />
    <meta property="og:image:height" content={site.ogImage.height} />
    <meta property="og:image:alt" content={site.ogImage.alt} />
    <meta name="twitter:image" content={image} />
    <meta name="twitter:image:alt" content={site.ogImage.alt} />
  {/if}
  {@html jsonLd}
</svelte:head>
