<script>
  import "$lib/css/site.css";
  import "@sitios/kit/fx.css";
  import * as env from "$env/static/public";
  import Analytics from "@sitios/kit/Analytics.svelte";
  import LivingLibrary from "$lib/Components/LivingLibrary.svelte";
  import FondoRegulador from "$lib/Components/FondoRegulador.svelte";
  import Puerta from "$lib/Components/Puerta.svelte";
  import { door, library, nav, site } from "$lib/data/site.js";

  // $env/static/public lee .env del cliente al buildear. El prerender no puede usar $env/dynamic.
  // Import con namespace: si la variable no está definida queda undefined y no rompe el build.
  const gaMeasurementId = env.PUBLIC_GA_MEASUREMENT_ID || site.gaMeasurementId || "";
  const gaEnableInDev = env.PUBLIC_GA_ENABLE_IN_DEV === "true";

  // Mientras la puerta está cerrada, el sitio de atrás no recibe foco ni clicks. Solo se decide en
  // el navegador (la puerta sabe si ya se entró en la sesión): el HTML prerenderizado no lleva inert
  let enLaPuerta = false;
</script>

<Analytics measurementId={gaMeasurementId} enableInDev={gaEnableInDev} />

<div class="bib">
  <LivingLibrary image={library.image} maps={library.maps} pages={library.pages} />
  <FondoRegulador />
  {#if door}
    <!-- door.brand, si está, reemplaza a site.brand en la placa (el spread va después) -->
    <Puerta brand={site.brand} {...door} on:puerta={() => (enLaPuerta = true)} on:adentro={() => (enLaPuerta = false)} />
  {/if}

  <div class="bib-sitio" inert={enLaPuerta ? "" : undefined}>
    <header class="site-header">
      <div class="site-wrap site-header-inner">
        <a class="site-logo" href="/">
          <img src={site.logo} alt={site.brand} width="120" height="120" />
        </a>
        <nav class="site-nav" aria-label="Principal">
          {#each nav as item}
            <a href={item.href}>{item.label}</a>
          {/each}
        </nav>
      </div>
    </header>

    <slot />

    <footer class="site-footer">
      <div class="site-wrap site-footer-inner">
        <p>© {new Date().getFullYear()} {site.brand}</p>
      </div>
    </footer>
  </div>
</div>
