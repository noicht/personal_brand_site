<script>
  import { reveal } from "@sitios/kit/motion/reveal.js";
  import { hero, site } from "$lib/data/site.js";
</script>

<svelte:head>
  <title>{site.brand}</title>
  <meta name="description" content={site.description} />
</svelte:head>

<main>
  <section class="site-hero">
    <div class="site-wrap">
      <p class="site-brand">{site.brand}</p>
      <h1>{hero.title}</h1>
      <p class="site-lead">{hero.mark}</p>
      <a class="site-btn" href={hero.ctaHref}>{hero.cta}</a>
    </div>
  </section>

  <section class="site-section fx-reveal" use:reveal>
    <div class="site-wrap">
      <h2>Próximo paso</h2>
      <p>Editá el contenido en <code>src/lib/data/site.js</code> y los estilos en <code>src/lib/css/site.css</code>.</p>
    </div>
  </section>

  <section id="contacto" class="site-section fx-reveal" use:reveal>
    <div class="site-wrap">
      <h2>Contacto</h2>
      <p>Escribinos a <a href="mailto:{site.email}">{site.email}</a>.</p>
    </div>
  </section>
</main>
