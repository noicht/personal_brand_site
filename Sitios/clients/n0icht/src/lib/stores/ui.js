// @ts-check
/**
 * Estado de interfaz compartido entre el layout, la paleta y la terminal, y la función que aplica
 * los efectos que devuelven los comandos (`src/lib/terminal/commands.ts`).
 */
import { writable } from "svelte/store";

/** La paleta de comandos está abierta. Para abrirla, `openPalette`. */
export const paletteOpen = writable(false);

let openedByTouch = false;

/**
 * Abre la paleta. `byTouch` dice si se abrió tocando la pantalla: en ese caso el foco no va al
 * campo de búsqueda, para que el teclado en pantalla no tape la lista.
 */
export function openPalette(byTouch = false) {
  openedByTouch = byTouch;
  paletteOpen.set(true);
}

/** La última vez, ¿la paleta se abrió tocando la pantalla? */
export const paletteOpenedByTouch = () => openedByTouch;

/**
 * Pedido de correr un comando en la terminal del hero (lo hace la paleta). La terminal lo corre y
 * lo vuelve a poner en `null`.
 * @type {import("svelte/store").Writable<string | null>}
 */
export const terminalRequest = writable(null);

/** Va a una sección de la página y le deja el foco, para que el teclado siga desde ahí. */
function navigate(/** @type {string} */ href) {
  const url = new URL(href, location.href);
  const target = url.pathname === location.pathname && url.hash ? document.getElementById(url.hash.slice(1)) : null;
  if (!target) {
    location.assign(href);
    return;
  }
  // Cambiar el hash scrollea como un link; si ya es el actual, el navegador no hace nada
  if (location.hash === url.hash) target.scrollIntoView();
  else location.hash = url.hash;
  target.focus({ preventScroll: true });
}

/**
 * Aplica efectos en el navegador. Se llama solo desde manejadores de eventos, nunca en el prerender.
 * `clear` lo resuelve la sesión y `pulse` lo dibuja la terminal.
 * @param {import("../terminal/commands.ts").Effect[]} effects
 */
export function runEffects(effects) {
  for (const effect of effects) {
    if (effect.type === "navigate") navigate(effect.href);
    else if (effect.type === "open") {
      if (effect.href.startsWith("mailto:")) location.href = effect.href;
      else window.open(effect.href, "_blank", "noopener");
    } else if (effect.type === "run") terminalRequest.set(effect.command);
  }
}
