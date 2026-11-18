/**
 * Contenido del sitio. Reemplazá brand, copy y links.
 */

export const site = {
  brand: "__BRAND__",
  description: "Descripción corta del sitio.",
  email: "hola@ejemplo.com",
  /** Measurement ID de GA4 (G-...). Vacío = sin Analytics. */
  gaMeasurementId: "",
};

export const nav = [
  { label: "Inicio", href: "/" },
  { label: "Contacto", href: "/#contacto" },
];

export const hero = {
  title: "Un titular claro.",
  mark: "Una frase de apoyo. Editá esto en data/site.js.",
  cta: "Contactanos",
  ctaHref: "/#contacto",
};
