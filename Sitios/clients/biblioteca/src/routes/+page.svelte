<script>
  import { reveal } from "@sitios/kit/motion/reveal.js";
  import { contact, hero, resources, rooms, services, site } from "$lib/data/site.js";
</script>

<svelte:head>
  <title>{site.brand} · {site.label}</title>
  <meta name="description" content={site.description} />
</svelte:head>

<!-- Cada <section> es un tramo del recorrido de la cámara del fondo (LivingLibrary) -->
<main>
  <section class="site-hero" id="inicio">
    <div class="site-wrap">
      <img class="site-hero-logo" src={site.logo} alt={site.brand} width="120" height="120" />
      <p class="site-kicker">{site.label}</p>
      <h1>{hero.title}</h1>
      <p class="site-lead">{hero.mark}</p>
      <div class="site-actions">
        <a class="site-btn" href={hero.ctaHref}>{hero.cta}</a>
        <a class="site-btn site-btn-ghost" href={hero.secondaryHref}>{hero.secondary}</a>
      </div>
    </div>
  </section>

  <section id="salas" class="site-section fx-reveal" use:reveal>
    <div class="site-wrap">
      <p class="site-kicker">{rooms.kicker}</p>
      <h2>{rooms.title}</h2>
      <p class="site-mark">{rooms.mark}</p>
      <div class="site-grid">
        {#each rooms.items as item}
          <article class="site-card">
            <h3>{item.name}</h3>
            <p>{item.text}</p>
          </article>
        {/each}
      </div>
      <ul class="site-tags" aria-label={rooms.tagsLabel}>
        {#each rooms.tags as tag}
          <li>{tag}</li>
        {/each}
      </ul>
    </div>
  </section>

  <section id="servicios" class="site-section fx-reveal" use:reveal>
    <div class="site-wrap">
      <p class="site-kicker">{services.kicker}</p>
      <h2>{services.title}</h2>
      <p class="site-mark">{services.mark}</p>
      <div class="site-grid">
        {#each services.points as point}
          <article class="site-card">
            <h3>{point.title}</h3>
            <p>{point.text}</p>
          </article>
        {/each}
      </div>
    </div>
  </section>

  <section id="recursos" class="site-section fx-reveal" use:reveal>
    <div class="site-wrap">
      <p class="site-kicker">{resources.kicker}</p>
      <h2>{resources.title}</h2>
      <p class="site-mark">{resources.mark}</p>
      <div class="site-grid">
        {#each resources.items as item}
          <a class="site-card" href={item.href} target="_blank" rel="noopener noreferrer">
            <h3>{item.label}</h3>
            <span class="site-card-note">{item.note}</span>
          </a>
        {/each}
      </div>
    </div>
  </section>

  <section id="contacto" class="site-section fx-reveal" use:reveal>
    <div class="site-wrap">
      <p class="site-kicker">{contact.kicker}</p>
      <h2>{contact.title}</h2>
      <p class="site-mark">{contact.mark}</p>
      <div class="site-grid">
        {#each [contact.hours, contact.place] as block}
          <article class="site-card">
            <h3>{block.title}</h3>
            {#each block.lines as line}
              <p>{line}</p>
            {/each}
          </article>
        {/each}
      </div>
      <div class="site-actions">
        <a class="site-btn" href="mailto:{contact.email}">{contact.cta}</a>
      </div>
    </div>
  </section>
</main>
