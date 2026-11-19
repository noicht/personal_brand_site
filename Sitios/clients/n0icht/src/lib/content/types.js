// @ts-check
/**
 * Tipos del contenido, en JSDoc. Los archivos de esta carpeta los usan con
 * `@type {import("./types.js").…}` y `validate.js` comprueba lo mismo en los tests.
 */

/**
 * @typedef {object} Site
 * @property {string} name Nombre real. Va en el JSON-LD (`name`).
 * @property {string} alias Nombre en línea. Va en el JSON-LD (`alternateName`).
 * @property {string} identity Cómo se muestra siempre la identidad, como texto.
 * @property {string} role Rol, en una línea.
 * @property {string} jobTitle Cargo para el JSON-LD.
 * @property {string} tagline
 * @property {string} title `<title>` de la página.
 * @property {string} description Meta description y `og:description`.
 * @property {string} url Origen de producción, sin barra final. Vacío: todavía no hay dominio.
 * @property {string} locale Para `og:locale`.
 * @property {string} logo Ruta del logo dentro de `static/`.
 * @property {string[]} knowsAbout Temas para el JSON-LD.
 */

/**
 * @typedef {object} NavItem
 * @property {string} label
 * @property {string} href Ancla de la página: `/#id`.
 */

/**
 * @typedef {object} Cta
 * @property {string} label
 * @property {string} href
 * @property {"primary" | "ghost"} variant
 */

/**
 * @typedef {object} Hero
 * @property {string} label Micro-etiqueta (`SYS//00`).
 * @property {string} status Texto junto al punto de estado.
 * @property {string} lead
 * @property {Cta[]} ctas
 */

/**
 * @typedef {object} SectionStub
 * @property {string} id Id de la `<section>`, el mismo del ancla en `nav`.
 * @property {string} index Número de la micro-etiqueta (`01`).
 * @property {string} title
 * @property {string} summary Qué va a tener la sección.
 */

/**
 * @typedef {object} Project
 * @property {string} slug
 * @property {string} name
 * @property {string} summary Una línea: qué es y con qué está hecho.
 */

/**
 * @typedef {object} StackGroup
 * @property {string} label
 * @property {string[]} items
 */

/**
 * @typedef {object} ContactLink
 * @property {string} label
 * @property {string} href
 * @property {boolean} [todo] `true`: es un placeholder. No sale en el JSON-LD (`sameAs`).
 */

/**
 * @typedef {object} Contact
 * @property {string} email
 * @property {boolean} [emailTodo] `true`: el mail es un placeholder.
 * @property {ContactLink[]} links
 */

/**
 * @typedef {object} TerminalLine
 * @property {string} text
 * @property {string} [tag] Prefijo corto (`[ ok ]`).
 */

/**
 * @typedef {object} TerminalCommandInfo
 * @property {string} name Primera palabra del comando.
 * @property {string} usage Cómo se escribe completo. Es lo que lista `help` y lo que corre la paleta.
 * @property {string} summary
 */

/**
 * @typedef {object} TerminalCopy
 * @property {string} title Barra de título de la terminal.
 * @property {string} prompt
 * @property {string} inputLabel Nombre accesible del campo.
 * @property {string} outputLabel Nombre accesible de la salida.
 * @property {string} placeholder
 * @property {string} skip Botón que saltea el arranque.
 * @property {string} tryLabel Etiqueta de los comandos sugeridos.
 * @property {string[]} suggestions Comandos que se ofrecen como botones (para pantallas táctiles).
 * @property {TerminalLine[]} boot Secuencia de arranque. Cada línea entra en una sola fila a 360px.
 * @property {TerminalCommandInfo[]} commands
 * @property {Record<"helpIntro" | "helpHint" | "notFound" | "notFoundHint" | "didYouMean" | "noSuchFile" | "lsUsage" | "catUsage" | "deployUsage" | "deployUnknown" | "projectsHead" | "stackHead" | "contactHead", string>} messages
 * @property {string[]} lsRoot Lo que lista `ls` sin argumentos.
 * @property {string[]} whoami Líneas que siguen a la identidad y el rol.
 * @property {TerminalLine[]} deploy Salida de `deploy --prod`.
 * @property {string} deployDone Última línea de `deploy --prod`.
 */

/**
 * @typedef {object} PaletteCopy
 * @property {string} button Texto del botón del header.
 * @property {string} title Nombre accesible del diálogo.
 * @property {string} inputLabel
 * @property {string} placeholder
 * @property {string} listLabel
 * @property {string} empty
 * @property {string} close
 * @property {string} hint Ayuda de teclado al pie.
 * @property {{ navigate: string, terminal: string, links: string }} groups
 * @property {string} emailLabel
 */

/**
 * Todo lo que leen la terminal y la paleta.
 * @typedef {object} TerminalContent
 * @property {Site} site
 * @property {NavItem[]} nav
 * @property {TerminalCopy} terminal
 * @property {Project[]} projects
 * @property {StackGroup[]} stack
 * @property {Contact} contact
 */

export {};
