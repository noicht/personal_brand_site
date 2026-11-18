/**
 * Action Svelte 4: agrega la clase de visible cuando el nodo entra en viewport.
 * Pensado para usarse con `.fx-reveal` de `@sitios/kit/fx.css`.
 *
 * Uso: <section class="fx-reveal" use:reveal>
 *
 * Accesibilidad:
 * - `prefers-reduced-motion: reduce` → visible de inmediato (sin opacity 0 permanente)
 * - sin IntersectionObserver o si falla → visible
 *
 * @param {HTMLElement} node
 * @param {{ threshold?: number, rootMargin?: string, className?: string }} [opts]
 */
export function reveal(node, opts = {}) {
  const {
    threshold = 0.2,
    rootMargin = "0px 0px -80px 0px",
    className = "is-visible",
  } = opts ?? {};

  function show() {
    node.classList.add(className);
  }

  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    show();
    return {};
  }

  if (typeof IntersectionObserver === "undefined") {
    show();
    return {};
  }

  /** @type {IntersectionObserver | undefined} */
  let observer;

  try {
    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          show();
          observer?.unobserve(node);
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(node);
  } catch {
    show();
    return {};
  }

  return {
    destroy() {
      observer?.disconnect();
    },
  };
}
