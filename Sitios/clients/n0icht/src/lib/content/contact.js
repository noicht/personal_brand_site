// @ts-check
/**
 * Contacto. En este hito lo usan el comando `contact`, la paleta y el JSON-LD.
 */

/** @type {import("./types.js").Contact} */
export const contact = {
  // TODO(content): mail real. Cuando lo sea, sacar `emailTodo`.
  email: "hello@example.com",
  emailTodo: true,
  // TODO(content): perfiles reales. Mientras tengan `todo: true` no salen en el JSON-LD (`sameAs`).
  links: [
    { label: "GitHub", href: "https://github.com/n0icht", todo: true },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/n0icht", todo: true },
  ],
};
