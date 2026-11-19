<script>
  import "$lib/css/tokens.css";
  import "$lib/css/site.css";
  import "$lib/css/terminal.css";
  import "@sitios/kit/fx.css";
  import { onMount } from "svelte";
  import Container from "$lib/Components/Container.svelte";
  import Seo from "$lib/Components/Seo.svelte";
  import StatusDot from "$lib/Components/StatusDot.svelte";
  import { nav, palette, site, ui } from "$lib/content/site.js";
  import { openPalette, paletteOpen } from "$lib/stores/ui.js";

  // La paleta se descarga la primera vez que se abre: no pesa en la carga inicial
  let paletteWanted = false;
  $: if ($paletteOpen) paletteWanted = true;

  // El atajo que muestra el botón. En el prerender no hay navegador: se ajusta al montar
  let shortcut = "Ctrl K";

  function onKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if ($paletteOpen) paletteOpen.set(false);
      else openPalette();
    }
  }

  // `pointerType` dice con qué se hizo el click. Donde el click todavía no lo trae, se mira si la
  // pantalla es táctil
  function onMenuClick(event) {
    const known = event.pointerType !== undefined;
    openPalette(known ? event.pointerType === "touch" : window.matchMedia("(hover: none)").matches);
  }

  onMount(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) shortcut = "⌘K";
  });
</script>

<svelte:window on:keydown={onKeydown} />

<Seo />

<div class="n0-app">
  <a class="n0-skip" href="#main">{ui.skipLink}</a>

  <!-- Fondo decorativo, solo CSS. Más adelante acá también va el canvas 3D. -->
  <div class="n0-bg" aria-hidden="true"></div>

  <header class="site-header">
    <Container class="site-header-inner">
      <!-- El logo va con alt vacío: el nombre ya está al lado como texto -->
      <a class="site-logo" href="/#top" aria-label={ui.homeLabel}>
        <img src={site.logo} alt="" width="28" height="28" />
        <span>{site.identity}</span>
      </a>
      <nav class="site-nav" aria-label={ui.navLabel}>
        {#each nav as item}
          <a href={item.href}>{item.label}</a>
        {/each}
      </nav>
      <button
        type="button"
        class="n0-menu"
        aria-haspopup="dialog"
        aria-expanded={$paletteOpen}
        aria-keyshortcuts="Control+K Meta+K"
        on:click={onMenuClick}
      >
        {palette.button}
        <kbd aria-hidden="true">{shortcut}</kbd>
      </button>
    </Container>
  </header>

  <slot />

  <footer class="site-footer">
    <Container class="site-footer-inner">
      <p class="site-footer-seal">
        <img src={site.logo} alt="" width="20" height="20" loading="lazy" />
        <span>© {new Date().getFullYear()} {site.identity}</span>
      </p>
      <StatusDot state="online" label={ui.footerStatus} />
    </Container>
  </footer>
</div>

{#if paletteWanted}
  {#await import("$lib/Components/CommandPalette.svelte") then palette}
    <svelte:component this={palette.default} />
  {/await}
{/if}
