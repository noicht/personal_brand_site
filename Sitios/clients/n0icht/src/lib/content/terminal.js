// @ts-check
/**
 * Textos de la terminal del hero: arranque, comandos y mensajes.
 * La lógica está en `src/lib/terminal/`; acá solo hay contenido.
 */

/** @type {import("./types.js").TerminalCopy} */
export const terminal = {
  title: "n0icht@prod: ~",
  prompt: "n0icht@prod:~$",
  inputLabel: "Terminal command",
  outputLabel: "Terminal output",
  placeholder: "type 'help'",
  skip: "Skip boot",
  tryLabel: "Try",
  suggestions: ["help", "whoami", "ls projects", "cat stack", "contact"],
  // Recorren el pipeline del sitio: idea, design, build, test, deploy, observe.
  boot: [
    { text: "n0icht/os :: cold boot" },
    { tag: "[ ok ]", text: "mount /dev/idea" },
    { tag: "[ ok ]", text: "load design.blueprint" },
    { tag: "[ ok ]", text: "build :: 0 errors" },
    { tag: "[ ok ]", text: "test :: all green" },
    { tag: "[ ok ]", text: "deploy :: production" },
    { tag: "[ ok ]", text: "observe :: metrics online" },
    { text: "ready. type 'help' to begin." },
  ],
  commands: [
    { name: "help", usage: "help", summary: "list commands" },
    { name: "whoami", usage: "whoami", summary: "who runs this system" },
    { name: "ls", usage: "ls projects", summary: "list projects" },
    { name: "cat", usage: "cat stack", summary: "print the stack" },
    { name: "contact", usage: "contact", summary: "how to reach me" },
    { name: "deploy", usage: "deploy --prod", summary: "ship it" },
    { name: "clear", usage: "clear", summary: "clear the screen" },
  ],
  messages: {
    helpIntro: "Available commands:",
    helpHint: "Up/Down recall history. Ctrl+K opens the palette.",
    notFound: "command not found: {cmd}",
    notFoundHint: "Type 'help' to list commands.",
    didYouMean: "Did you mean '{cmd}'?",
    noSuchFile: "{cmd}: {arg}: No such file or directory",
    lsUsage: "usage: ls projects",
    catUsage: "usage: cat stack",
    deployUsage: "usage: deploy --prod",
    deployUnknown: "deploy: unknown target '{arg}'. Only --prod is wired here.",
    projectsHead: "projects/",
    stackHead: "stack",
    contactHead: "contact",
  },
  lsRoot: ["projects/", "stack"],
  whoami: [
    "5+ years taking products from zero to production.",
    "I design, build, ship and operate production systems.",
  ],
  deploy: [
    { tag: "[ ok ]", text: "build :: image built" },
    { tag: "[ ok ]", text: "test :: all green" },
    { tag: "[ ok ]", text: "push :: registry" },
    { tag: "[ ok ]", text: "rollout :: 3/3 replicas" },
    { tag: "[ ok ]", text: "health :: 200 OK" },
  ],
  deployDone: "Deployed to production. Zero downtime, as usual.",
};
