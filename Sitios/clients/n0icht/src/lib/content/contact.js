// @ts-check
/**
 * Contacto. Lo usan el comando `contact`, la paleta, el JSON-LD y el formulario de la sección.
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
  // Vacío: el formulario abre el cliente de mail (modo mailto). Una URL https pública: POST ahí.
  // CI buildea sin `.env`, así que el valor de producción vive acá, no en una variable de entorno.
  endpoint: "",
};

/** @type {import("./types.js").ContactContent} */
export const contactSection = {
  id: "contact",
  title: "Contact",
  lead: "A direct line. Tell me about the system you need to build, ship or rescue.",
  panelTitle: "n0icht@prod: ~/contact",
  promptChar: ">",
  fields: {
    name: { label: "name", placeholder: "your name" },
    email: { label: "email", placeholder: "you@example.com" },
    message: { label: "message", placeholder: "what are you building?" },
  },
  honeypotLabel: "leave this field empty",
  submit: "send",
  limits: { name: 80, email: 254, message: 2000 },
  errors: {
    required: "{field}: required",
    invalid: "{field}: not a valid address",
    tooLong: "{field}: max {max} characters",
  },
  statusTags: { ok: "[ ok ]", error: "[ err ]", busy: "[ .. ]" },
  status: {
    invalid: "fix the fields above and try again",
    sending: "sending",
    sent: "message sent. I will get back to you.",
    opened: "opening your mail client with the message ready to send",
    failed: "could not send. Try the mail link instead.",
  },
  fallbackLabel: "Send by mail instead",
  directLabel: "Or reach me directly",
  mailSubject: "[n0icht] Message from {name}",
  mailBody: "{message}\n\n-- \n{name}\n{email}",
};
