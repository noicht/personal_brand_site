<script>
  import "$lib/css/site.css";
  import "@sitios/kit/fx.css";
  import * as env from "$env/static/public";
  import Analytics from "@sitios/kit/Analytics.svelte";
  import { nav, site } from "$lib/data/site.js";

  // $env/static/public lee .env del cliente al buildear. El prerender no puede usar $env/dynamic.
  // Import con namespace: si la variable no está definida queda undefined y no rompe el build.
  const gaMeasurementId = env.PUBLIC_GA_MEASUREMENT_ID || site.gaMeasurementId || "";
  const gaEnableInDev = env.PUBLIC_GA_ENABLE_IN_DEV === "true";
</script>

<Analytics measurementId={gaMeasurementId} enableInDev={gaEnableInDev} />

<header class="site-header">
  <div class="site-wrap site-header-inner">
    <a class="site-logo" href="/">{site.brand}</a>
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
