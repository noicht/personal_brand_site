<script>
  /**
   * Regulador del fondo (temporal). Con `?regulador` en la URL, un panel mueve en vivo las perillas
   * del CSS --fondo-transparencia, --fondo-calma y --fondo-contraste: las escribe en línea en .bib y
   * LivingLibrary las relee. Sirve para elegir los valores que después quedan fijos en
   * site.css. Queda abierto en la pestaña (recargas y otras páginas) hasta cerrarlo.
   *
   * Para sacarlo: borrar este archivo, su línea en +layout.svelte y el bloque .bib-tuner del CSS.
   * Las perillas siguen funcionando desde el CSS.
   */
  import { onMount } from "svelte";

  const KEY = "bib-regulador";
  const KNOBS = [
    { name: "--fondo-transparencia", label: "Transparencia", min: 0, max: 1, fallback: 0 },
    { name: "--fondo-calma", label: "Calma", min: 0, max: 1, fallback: 0 },
    { name: "--fondo-contraste", label: "Contraste", min: 0.5, max: 1.5, fallback: 1 },
  ];

  let host = null; // .bib: donde el CSS declara las perillas
  let open = false;
  let values = KNOBS.map((k) => k.fallback);
  let base = values; // lo que dice el CSS, para restablecer

  const pct = (v) => `${Math.round(v * 100)}%`;
  const num = (v) => String(Math.round(v * 100) / 100);
  const limit = (v, k) => Math.min(k.max, Math.max(k.min, Number.isFinite(v) ? v : k.fallback));

  function load() {
    try {
      return JSON.parse(sessionStorage.getItem(KEY));
    } catch {
      return null;
    }
  }

  function save(value) {
    try {
      if (value) sessionStorage.setItem(KEY, JSON.stringify(value));
      else sessionStorage.removeItem(KEY);
    } catch {}
  }

  function apply(on, values) {
    KNOBS.forEach((k, i) => {
      if (on) host.style.setProperty(k.name, String(values[i]));
      else host.style.removeProperty(k.name);
    });
  }

  function reset() {
    values = [...base];
  }

  function close() {
    open = false;
    save(null);
    reset();
  }

  $: if (host) apply(open, values);
  $: if (open) save(values);

  onMount(() => {
    host = document.querySelector(".bib");
    if (!host) return;
    const css = getComputedStyle(host);
    base = KNOBS.map((k) => limit(parseFloat(css.getPropertyValue(k.name)), k));
    const saved = load();
    open = new URLSearchParams(window.location.search).has("regulador") || Array.isArray(saved);
    values = KNOBS.map((k, i) => limit(Array.isArray(saved) ? saved[i] : base[i], k));
    return () => apply(false);
  });
</script>

{#if open}
  <div class="bib-tuner" role="group" aria-label="Regulador del fondo">
    <div class="bib-tuner-head">
      <strong>Fondo</strong>
      <button class="bib-tuner-close" type="button" aria-label="Cerrar el regulador" on:click={close}>×</button>
    </div>
    {#each KNOBS as k, i}
      <label>
        <span>{k.label} <output>{pct(values[i])}</output></span>
        <input type="range" min={k.min} max={k.max} step="0.01" bind:value={values[i]} />
      </label>
    {/each}
    <code>
      {#each KNOBS as k, i}{k.name}: {num(values[i])};<br />{/each}
    </code>
    <button class="bib-tuner-reset" type="button" on:click={reset}>Restablecer</button>
  </div>
{/if}
