// @ts-check
/**
 * Orden y visibilidad de las secciones. `enabled` filtra los ítems por las flags de `site.js`
 * y `numbered` les da el número de la micro-etiqueta (`SYS//01`). Sin DOM.
 */

/**
 * Deja los ítems sin `feature`, o con su flag prendido.
 * @template {{ feature?: string }} T
 * @param {T[]} items
 * @param {Record<string, boolean>} features
 * @returns {T[]}
 */
export function enabled(items, features) {
  return items.filter((item) => !item.feature || features[item.feature] === true);
}

/**
 * Numera en orden: "01", "02"… Devuelve copias con `index`.
 * @template T
 * @param {T[]} items
 * @returns {(T & { index: string })[]}
 */
export function numbered(items) {
  return items.map((item, i) => ({ ...item, index: String(i + 1).padStart(2, "0") }));
}
