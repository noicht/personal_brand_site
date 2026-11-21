/**
 * Decisión pura de la realineación posterior al montaje del playground.
 *
 * El simulador se monta apenas hidrata la página, pero si el usuario saltó por un ancla
 * a una sección debajo del playground antes de que terminara de montar, la página queda
 * corta: la sección creció después de que el navegador calculó el destino. Cuando el
 * simulador monta se revisa el `location.hash` y, si todo indica que el salto quedó
 * incompleto, se vuelve a pedir `scrollIntoView()` sobre el destino.
 */

/**
 * Las teclas que mueven el scroll con el teclado: si alguna se usa, el usuario scrolleó
 * a mano y la realineación no aplica (respetar su posición).
 */
export const SCROLL_KEYS: readonly string[] = [
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
];

export interface RealignInput {
  /** El usuario scrolleó (wheel, touch o una tecla de scroll) desde que cargó la página. */
  userScrolled: boolean;
  /** Hay un elemento en el documento para `location.hash`. */
  hasTarget: boolean;
  /** El destino queda después del playground en el documento. */
  targetFollows: boolean;
  /** El destino está dentro del playground (un ancla propia, no aplica). */
  targetInside: boolean;
}

/**
 * `true` solo cuando el salto por ancla quedó viejo: nadie scrolleó a mano, el hash
 * apunta a un elemento y ese elemento está debajo del playground sin ser parte de él.
 */
export function shouldRealign(input: RealignInput): boolean {
  return !input.userScrolled && input.hasTarget && input.targetFollows && !input.targetInside;
}
