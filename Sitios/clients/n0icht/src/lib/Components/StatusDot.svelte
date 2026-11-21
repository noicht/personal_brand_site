<script>
  /**
   * Punto de estado: una celda cuadrada, como las del logo. Verde quiere decir activo / online,
   * igual que la celda verde del logo. Estilos en site.css (`.n0-dot`).
   *
   * El punto es decorativo (`aria-hidden`): el estado lo dice el texto de `label`.
   */

  /** `online` (verde), `pending` (ámbar) u `off` (gris). */
  export let state = "online";

  /** Texto al lado del punto (`STATUS: ONLINE`). */
  export let label = "";

  /** Titila. */
  export let pulse = false;
</script>

<span class="n0-status n0-micro">
  <span class="n0-dot is-{state}" class:is-pulse={pulse} aria-hidden="true"></span>
  {#if label}<span>{label}</span>{/if}
</span>
