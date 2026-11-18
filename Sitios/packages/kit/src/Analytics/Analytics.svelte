<script>
  import { browser, dev } from "$app/environment";
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { isQa } from "../host.js";

  /** Measurement ID de GA4, ej. `G-XXXXXXXX`. Vacío = no carga nada. */
  export let measurementId = "";

  /**
   * Si true, también corre en `npm run dev`.
   * Por defecto solo en build / preview / producción. En QA (*.qa.example.com) nunca: es el mismo
   * build que producción y sus visitas no van a las estadísticas del cliente.
   * Útil para probar una vez con tu propiedad de Google.
   */
  export let enableInDev = false;

  const SCRIPT = "https://www.googletagmanager.com/gtag/js";

  let ready = false;
  let lastPath = "";

  function active() {
    return Boolean(measurementId) && (!dev || enableInDev) && !isQa();
  }

  /** Measurement ID real: G- + letras/números. Un G- solo numérico suele ser el Property ID. */
  function looksLikeMeasurementId(id) {
    return /^G-[A-Z0-9]*[A-Z][A-Z0-9]*$/i.test(id) && !/^G-\d+$/i.test(id);
  }

  function ensureGtag() {
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== "function") {
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
    }
  }

  function loadScript() {
    const src = `${SCRIPT}?id=${encodeURIComponent(measurementId)}`;
    if (document.querySelector(`script[src^="${SCRIPT}"]`)) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function track(url) {
    if (!window.gtag || !url) return;
    const path = url.pathname + url.search;
    if (path === lastPath) return;
    lastPath = path;
    window.gtag("event", "page_view", {
      page_title: document.title,
      page_location: url.href,
      page_path: path,
      send_to: measurementId,
    });
  }

  onMount(async () => {
    if (!browser || !active()) return;
    if (dev && !looksLikeMeasurementId(measurementId)) {
      console.warn(
        `[Analytics] "${measurementId}" no parece un Measurement ID de GA4. ` +
          `Tiene que ser tipo G-ABC12XYZ34 (Admin → Flujos de datos → Web → Measurement ID), ` +
          `no el Property ID numérico.`
      );
    }
    try {
      ensureGtag();
      window.gtag("js", new Date());
      window.gtag("config", measurementId, { send_page_view: false });
      await loadScript();
      ready = true;
      track($page.url);
      if (dev) console.info(`[Analytics] GA4 listo (${measurementId})`);
    } catch (err) {
      ready = false;
      if (dev) console.warn("[Analytics] No se pudo cargar gtag", err);
    }
  });

  afterNavigate(({ to }) => {
    if (!browser || !ready || !active() || !to) return;
    track(to.url);
  });
</script>
