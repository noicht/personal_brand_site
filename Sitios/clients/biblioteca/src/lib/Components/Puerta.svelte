<script>
  /**
   * Puerta de entrada. La primera vez en la sesión el sitio arranca afuera: una puerta de madera
   * de dos hojas, cerrada, con la luz del salón colándose por la rendija, por debajo y por el
   * montante de vidrio. Al tocarla (o con Enter) las hojas se abren hacia adentro, la cámara cruza
   * el vano y queda el sitio.
   *
   * Detrás de la puerta está el sitio de verdad: el vano y el montante son agujeros en la pared
   * (mask-image en .bib-puerta-pared), así que al cruzar no hay corte ni foto duplicada. El
   * salón vivo ya estaba ahí.
   *
   * - Una vez por sesión (sessionStorage `bib-puerta`). Con `?puerta` en la URL se muestra igual.
   * - app.html pone `bib-adentro` en <html> antes de pintar si ya se entró: la puerta ni se ve.
   * - Mientras está cerrada, <html> lleva `bib-en-la-puerta` (sin scroll, header escondido) y el
   *   sitio va `inert` (lo hace el layout con los eventos `puerta` y `adentro`).
   * - Con movimiento reducido no hay giro ni viaje: la puerta se funde en 0,6 s.
   * - El zoom final se calcula al tocar: el justo para que el vano tape la pantalla. Al llegar, la
   *   escena ya no se ve (todo lo que no es agujero quedó afuera) y se saca del DOM.
   *
   * Los estilos están en site.css (bloque "Puerta de entrada").
   */
  import { createEventDispatcher, onMount } from "svelte";

  /** Nombre en la placa de latón del travesaño. */
  export let brand = "";
  /** Titular debajo de la puerta. */
  export let title = "Bienvenido";
  /** Indicación chica debajo del titular. */
  export let hint = "Tocá la puerta para entrar";
  /** Nombre accesible del botón (la puerta entera). */
  export let label = "Entrar";

  const KEY = "bib-puerta";
  const dispatch = createEventDispatcher();

  let root;
  let escena;
  let vano;
  let visible = true; // false: ya se entró en esta sesión
  let abriendo = false;
  let quieta = false; // prefers-reduced-motion
  let timer;

  function salir() {
    clearTimeout(timer);
    visible = false;
    document.documentElement.classList.remove("bib-en-la-puerta");
    dispatch("adentro");
  }

  function entrar() {
    if (abriendo) return;
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {}

    // La cámara cruza por el centro del vano: el zoom justo para que el vano tape toda la pantalla
    const r = vano.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const zoom =
      Math.max(
        (2 * Math.max(cx, window.innerWidth - cx)) / r.width,
        (2 * Math.max(cy, window.innerHeight - cy)) / r.height,
      ) * 1.15;
    root.style.setProperty("--ox", `${cx}px`);
    root.style.setProperty("--oy", `${cy}px`);
    root.style.setProperty("--zoom", zoom.toFixed(3));
    abriendo = true;

    // Por si el transitionend no llega (pestaña en segundo plano)
    timer = setTimeout(salir, quieta ? 1000 : 3000);
  }

  // Termina cuando la cámara llega (transform de la escena); con movimiento reducido, cuando se
  // fundió el contenedor
  function onEnd(event) {
    if (!abriendo) return;
    const { target, propertyName } = event;
    if ((target === escena && propertyName === "transform") || (target === root && propertyName === "opacity")) {
      salir();
    }
  }

  onMount(() => {
    const force = new URLSearchParams(window.location.search).has("puerta");
    let entrado = false;
    try {
      entrado = !!sessionStorage.getItem(KEY);
    } catch {}
    if (entrado && !force) {
      visible = false;
      dispatch("adentro");
      return;
    }
    quieta = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const html = document.documentElement;
    html.classList.remove("bib-adentro"); // con ?puerta, aunque ya se haya entrado
    html.classList.add("bib-en-la-puerta");
    dispatch("puerta");
    return () => {
      clearTimeout(timer);
      html.classList.remove("bib-en-la-puerta");
    };
  });
</script>

{#if visible}
  <div
    class="bib-puerta"
    class:is-abriendo={abriendo}
    class:is-quieta={quieta}
    bind:this={root}
    on:transitionend={onEnd}
  >
    <div class="bib-puerta-escena" bind:this={escena}>
      <div class="bib-puerta-pared" aria-hidden="true"></div>

      <button class="bib-puerta-boton" type="button" aria-label={label} on:click={entrar}>
        <!-- Marco: cabezal, enjutas del arco, vidrio del montante, travesaño con la placa y jambas -->
        <span class="bib-puerta-cabezal"></span>
        <span class="bib-puerta-arco"></span>
        <span class="bib-puerta-vidrio"></span>
        <span class="bib-puerta-travesano">
          {#if brand}<span class="bib-puerta-placa">{brand}</span>{/if}
        </span>
        <span class="bib-puerta-jamba is-izq"></span>
        <span class="bib-puerta-jamba is-der"></span>

        <!-- Vano: la luz del salón y las dos hojas, que giran sobre las jambas -->
        <span class="bib-puerta-vano" bind:this={vano}>
          <span class="bib-puerta-luz"></span>
          <span class="bib-puerta-hoja is-izq">
            <span class="bib-puerta-panel"></span>
            <span class="bib-puerta-panel"></span>
            <span class="bib-puerta-tirador"></span>
            <span class="bib-puerta-canto"></span>
          </span>
          <span class="bib-puerta-hoja is-der">
            <span class="bib-puerta-panel"></span>
            <span class="bib-puerta-panel"></span>
            <span class="bib-puerta-tirador"></span>
            <span class="bib-puerta-canto"></span>
          </span>
        </span>

        <!-- Luz que se cuela por debajo y se posa en el piso -->
        <span class="bib-puerta-umbral"></span>
      </button>

      <div class="bib-puerta-texto">
        <p class="bib-puerta-titulo">{title}</p>
        <p class="bib-puerta-pista">{hint}</p>
      </div>
    </div>
  </div>
{/if}
