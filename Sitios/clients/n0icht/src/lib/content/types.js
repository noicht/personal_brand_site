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
 * @property {string} [feature] Flag de `features` que lo prende; sin flag siempre está.
 */

/**
 * Flags de secciones optativas.
 * @typedef {object} Features
 * @property {boolean} writing Notas: se prende cuando haya posts reales.
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
 * @property {string} title
 * @property {string} summary Qué va a tener la sección.
 */

/**
 * Sección visible de la página, ya numerada (`SYS//01` en `index`).
 * @typedef {object} SectionRef
 * @property {string} id
 * @property {string} index Dos dígitos, en orden.
 * @property {string} [feature]
 */

/**
 * Encabezado que lleva cada sección de contenido.
 * @typedef {object} SectionMeta
 * @property {string} id El de la `<section>` y del ancla.
 * @property {string} title
 * @property {string} lead Bajada.
 */

/**
 * @typedef {object} PipelineStage
 * @property {import("../three/stages.ts").StageId} id La parada del recorrido 3D.
 * @property {string} label
 * @property {string} summary
 * @property {string} detail
 * @property {string} output Qué sale de la etapa.
 * @property {string[]} tools
 */

/**
 * @typedef {object} PipelineContent
 * @property {string} id
 * @property {string} title
 * @property {string} lead
 * @property {string} railLabel Nombre accesible del riel de etapas.
 * @property {string} stageLabel Prefijo de la micro-etiqueta (`STAGE//01`).
 * @property {string} toolsLabel
 * @property {string} outputLabel
 * @property {string} activeTag
 * @property {PipelineStage[]} stages
 */

/**
 * @typedef {"client" | "service" | "db" | "queue" | "cache" | "external"} DiagramNodeKind
 */

/**
 * Nodo del diagrama de arquitectura: una celda de la grilla 0..3 × 0..3.
 * @typedef {object} DiagramNode
 * @property {string} id
 * @property {string} label
 * @property {DiagramNodeKind} kind
 * @property {number} col
 * @property {number} row
 */

/**
 * @typedef {object} DiagramEdge
 * @property {string} from Id de nodo.
 * @property {string} to Id de nodo.
 * @property {string} [label]
 */

/**
 * @typedef {object} Diagram
 * @property {string} summary Descripción accesible en una frase.
 * @property {DiagramNode[]} nodes
 * @property {DiagramEdge[]} edges
 */

/**
 * @typedef {object} Decision
 * @property {string} title
 * @property {string} choice Lo que se eligió.
 * @property {string} tradeoff Qué se dejó de lado.
 */

/**
 * @typedef {object} ProjectLink
 * @property {string} label
 * @property {string} href https://…
 * @property {boolean} [todo] `true`: todavía no hay URL; se muestra como texto.
 */

/**
 * @typedef {object} Project
 * @property {string} slug
 * @property {string} name
 * @property {string} summary Una línea: qué es y con qué está hecho.
 * @property {string} period ("2024 – 2025")
 * @property {string} role
 * @property {string} problem
 * @property {Diagram} architecture
 * @property {Decision[]} decisions
 * @property {string[]} stack
 * @property {string[]} result
 * @property {ProjectLink[]} links
 * @property {boolean} [todo] `true`: placeholder; lleva el tag de placeholder.
 */

/**
 * @typedef {object} ProjectsContent
 * @property {string} id
 * @property {string} title
 * @property {string} lead
 * @property {string} caseLabel Prefijo de la micro-etiqueta (`CASE//01`).
 * @property {string} open Afirmación de abrir el caso.
 * @property {string} close Afirmación de cerrarlo.
 * @property {{ problem: string, architecture: string, decisions: string, choice: string, tradeoff: string, stack: string, result: string, links: string }} labels
 * @property {string} linkPending Tag de un link que todavía no tiene URL.
 * @property {string} diagramLabel `aria-label` del diagrama (`{name} architecture diagram`).
 * @property {string} flowLabel Título solo-lector-de-pantalla de la lista de conexiones.
 * @property {Record<DiagramNodeKind, string>} kinds Etiqueta de cada tipo de nodo.
 */

/**
 * @typedef {"active" | "standby" | "bench"} StackStatus
 */

/**
 * @typedef {object} StackItem
 * @property {string} name
 * @property {StackStatus} status
 * @property {string} [note]
 */

/**
 * @typedef {object} StackGauge
 * @property {number} value Años en producción.
 * @property {number} max
 * @property {string} unit
 * @property {string} label
 */

/**
 * @typedef {object} StackGroup
 * @property {"backend" | "cloud" | "frontend" | "practices"} id
 * @property {string} label
 * @property {StackItem[]} items
 * @property {StackGauge} gauge
 */

/**
 * @typedef {object} StackContent
 * @property {string} id
 * @property {string} title
 * @property {string} lead
 * @property {string} panelLabel Prefijo de la micro-etiqueta (`PANEL//backend`).
 * @property {string} legendLabel Nombre accesible de la leyenda de estados.
 * @property {Record<StackStatus, { label: string, hint: string }>} statuses
 */

/**
 * @typedef {object} ExperienceEntry
 * @property {string} id
 * @property {string} company
 * @property {string} [client]
 * @property {string} role
 * @property {string} start Año ("2025").
 * @property {string} [end] Año; sin `end` es trabajo en curso.
 * @property {string} summary
 * @property {string[]} outcomes
 * @property {string[]} stack
 * @property {boolean} [todo]
 */

/**
 * @typedef {object} ExperienceContent
 * @property {string} id
 * @property {string} title
 * @property {string} lead
 * @property {string} forLabel Preposición del cliente ("for").
 * @property {string} presentLabel "present".
 * @property {string} outcomesLabel
 * @property {string} stackLabel
 * @property {ExperienceEntry[]} entries
 */

/**
 * @typedef {object} Post
 * @property {string} title
 * @property {string} summary
 * @property {string} date ISO ("2026-10-05").
 * @property {string} href https://… o ruta interna.
 * @property {string[]} tags
 * @property {boolean} [todo]
 */

/**
 * @typedef {object} WritingContent
 * @property {string} id
 * @property {string} title
 * @property {string} lead
 * @property {string} readLabel Cierre del nombre accesible de cada link.
 * @property {Post[]} posts
 */

/**
 * @typedef {object} ContactField
 * @property {string} label
 * @property {string} placeholder
 */

/**
 * @typedef {object} ContactContent
 * @property {string} id
 * @property {string} title
 * @property {string} lead
 * @property {string} panelTitle Barra de título del panel.
 * @property {string} promptChar Signo del prompt (`name>`).
 * @property {Record<"name" | "email" | "message", ContactField>} fields
 * @property {string} honeypotLabel
 * @property {string} submit Texto del botón.
 * @property {{ name: number, email: number, message: number }} limits
 * @property {{ required: string, invalid: string, tooLong: string }} errors Plantillas (`{field}`, `{max}`).
 * @property {{ ok: string, error: string, busy: string }} statusTags
 * @property {{ invalid: string, sending: string, sent: string, opened: string, failed: string }} status
 * @property {string} fallbackLabel Link de respaldo cuando el POST falla.
 * @property {string} directLabel
 * @property {string} mailSubject Plantilla (`{name}`).
 * @property {string} mailBody Plantilla (`{message}`, `{name}`, `{email}`).
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
 * @property {string} endpoint Endpoint del formulario. Vacío: modo mailto. Un https://… público: POST ahí.
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

/**
 * Todo lo que lee la página y sus secciones.
 * @typedef {object} PageContent
 * @property {Hero} hero
 * @property {Features} features
 * @property {SectionRef[]} sections
 * @property {SectionStub[]} pendingSections
 * @property {PipelineContent} pipeline
 * @property {ProjectsContent} projectsSection
 * @property {StackContent} stackSection
 * @property {ExperienceContent} experience
 * @property {WritingContent} writing
 * @property {ContactContent} contactSection
 */

export {};
