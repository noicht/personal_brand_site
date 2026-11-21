<script>
  /**
   * Hero: identidad, rol, lema, los dos botones y la terminal.
   *
   * Todo el texto es HTML prerenderizado y está fuera de la terminal: se lee sin JavaScript y no
   * espera a la animación de arranque. Los estilos están en site.css (`.n0-hero`).
   */
  import { hero, site } from "$lib/content/site.js";
  import Button from "./Button.svelte";
  import Container from "./Container.svelte";
  import StatusDot from "./StatusDot.svelte";
  import Terminal from "./Terminal.svelte";

  // El punto final del lema va en verde: es la celda "activa" del logo
  const endsWithDot = site.tagline.endsWith(".");
  const tagline = endsWithDot ? site.tagline.slice(0, -1) : site.tagline;
</script>

<section id="top" class="n0-hero" tabindex="-1" aria-labelledby="hero-title">
  <Container class="n0-hero-grid">
    <div class="n0-hero-copy">
      <div class="n0-hero-meta">
        <span class="n0-micro">{hero.label}</span>
        <StatusDot state="online" pulse label={hero.status} />
      </div>
      <h1 id="hero-title">{site.identity}</h1>
      <p class="n0-hero-role">{site.role}</p>
      <p class="n0-hero-tagline">{tagline}{#if endsWithDot}<span>.</span>{/if}</p>
      <p class="n0-hero-lead">{hero.lead}</p>
      <div class="n0-hero-ctas">
        {#each hero.ctas as cta}
          <Button href={cta.href} variant={cta.variant}>{cta.label}</Button>
        {/each}
      </div>
    </div>
    <Terminal />
  </Container>
</section>
