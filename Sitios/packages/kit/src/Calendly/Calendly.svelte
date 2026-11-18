<script>
  import { browser } from "$app/environment";
  import { onDestroy, onMount } from "svelte";

  /** URL del evento o página de Calendly (plan free: un solo event type activo). */
  export let url = "";

  /** @type {"inline" | "popup" | "link"} */
  export let mode = "inline";

  /** Texto del botón/enlace en modos popup y link. */
  export let text = "Agendá una llamada";

  /** Altura mínima del embed inline. */
  export let minHeight = "700px";

  /** Oculta foto, nombre, duración y descripción del evento. */
  export let hideDetails = false;

  /** Oculta el banner de cookies del embed. */
  export let hideGdpr = false;

  /** Prefill opcional: { name, email, firstName, lastName, customAnswers } */
  export let prefill = undefined;

  /** UTM opcional: { utmCampaign, utmSource, utmMedium, utmContent, utmTerm } */
  export let utm = undefined;

  /** Clase extra en el contenedor o en el botón/enlace. */
  export let className = "";

  const SCRIPT = "https://assets.calendly.com/assets/external/widget.js";
  const STYLES = "https://assets.calendly.com/assets/external/widget.css";

  let root;
  let ready = false;

  function buildUrl() {
    const target = new URL(url);
    if (hideDetails) target.searchParams.set("hide_event_type_details", "1");
    if (hideGdpr) target.searchParams.set("hide_gdpr_banner", "1");
    return target.toString();
  }

  function ensureAssets() {
    if (!document.querySelector(`link[href="${STYLES}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = STYLES;
      document.head.appendChild(link);
    }

    if (window.Calendly) return Promise.resolve();

    const existing = document.querySelector(`script[src="${SCRIPT}"]`);
    if (existing) {
      return new Promise((resolve, reject) => {
        if (window.Calendly) resolve();
        else {
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener("error", reject, { once: true });
        }
      });
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function initInline() {
    if (!root || !window.Calendly) return;
    root.innerHTML = "";
    window.Calendly.initInlineWidget({
      url: buildUrl(),
      parentElement: root,
      prefill,
      utm,
    });
  }

  function openPopup() {
    if (!window.Calendly) return;
    window.Calendly.initPopupWidget({
      url: buildUrl(),
      prefill,
      utm,
    });
  }

  onMount(async () => {
    if (!browser || !url) return;
    try {
      await ensureAssets();
      ready = true;
      if (mode === "inline") initInline();
    } catch {
      ready = false;
    }
  });

  onDestroy(() => {
    if (root) root.innerHTML = "";
  });
</script>

{#if url}
  {#if mode === "inline"}
    <div
      class="calendly-inline {className}"
      style="min-width:320px;height:{minHeight};"
      bind:this={root}
      data-url={url}
    ></div>
  {:else if mode === "popup"}
    <button type="button" class="calendly-popup-btn {className}" on:click={openPopup} disabled={!ready}>
      {text}
    </button>
  {:else}
    <a
      class="calendly-link {className}"
      href={url}
      on:click|preventDefault={openPopup}
    >
      {text}
    </a>
  {/if}
{/if}
