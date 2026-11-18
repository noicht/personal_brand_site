/**
 * Contenido del sitio. Todo lo que se lee en la página sale de acá: para cambiar un texto no hace
 * falta tocar los .svelte.
 *
 * "Biblioteca del Ombú" es una biblioteca inventada para el ejemplo. La dirección, el mail y los
 * horarios son de mentira.
 */

export const site = {
  brand: "Biblioteca del Ombú",
  label: "Biblioteca popular de barrio",
  description:
    "Biblioteca popular de barrio: préstamo de libros, sala de lectura, talleres y club de lectura. Entrada libre y gratuita.",
  /** Logo en SVG: se ve nítido en cualquier tamaño. */
  logo: "/assets/logo.svg",
  /** Measurement ID de GA4 (G-...). Vacío = sin Analytics. */
  gaMeasurementId: "",
};

/** Cada href apunta al id de una sección de la página. */
export const nav = [
  { label: "Salas", href: "/#salas" },
  { label: "Qué hacemos", href: "/#servicios" },
  { label: "Recursos", href: "/#recursos" },
  { label: "Contacto", href: "/#contacto" },
];

export const hero = {
  title: "Un lugar para leer, sin apuro.",
  mark: "Libros para llevar, mesas para quedarse y gente con ganas de recomendarte el próximo.",
  cta: "Cómo llegar",
  ctaHref: "/#contacto",
  secondary: "Ver las salas",
  secondaryHref: "/#salas",
};

/**
 * Puerta de entrada (Puerta.svelte): la primera vez en la sesión el sitio arranca afuera, en la
 * puerta del salón; al tocarla se abre y se entra. `brand` es el nombre de la placa de latón del
 * marco (corto: no entra uno largo); si no está, va `site.brand`.
 * Para verla de nuevo: `?puerta` en la URL. Para sacarla: `door = null`.
 */
export const door = {
  brand: "Ombú",
  title: "Bienvenido",
  hint: "Tocá la puerta para entrar",
  /** Nombre accesible del botón (la puerta entera) */
  label: "Entrar a la Biblioteca del Ombú",
};

/**
 * Fondo de todo el sitio: la foto del salón, viva en WebGL.
 * La cámara recorre el salón con el scroll: cada ruta de `pages` es un tramo y cada sección, una parte.
 * Este sitio es una sola página, así que el recorrido lo hacen las secciones.
 */
export const library = {
  image: "/assets/biblioteca.jpg",
  maps: "/assets/biblioteca-mapas.png",
  pages: ["/"],
};

export const rooms = {
  kicker: "Salas",
  title: "Tres salas, tres ritmos",
  mark: "Cada una con su volumen de voz y su tipo de mesa.",
  items: [
    {
      name: "Sala de lectura",
      text: "Silencio, buena luz y enchufes en todas las mesas. Para leer, estudiar o escribir.",
    },
    {
      name: "Sala infantil",
      text: "Cuentos, almohadones y una mesa baja para dibujar. Acá se puede hablar fuerte.",
    },
    {
      name: "Hemeroteca",
      text: "Diarios del día y revistas de los últimos años, para consultar en la sala.",
    },
  ],
  /** Etiquetas debajo de las tarjetas */
  tagsLabel: "Colecciones",
  tags: ["Novela", "Poesía", "Historieta", "Ensayo", "Ciencia", "Infantil"],
};

export const services = {
  kicker: "Qué hacemos",
  title: "Más que prestar libros",
  mark: "La biblioteca es del barrio: la sostienen sus socios y la usa cualquiera.",
  points: [
    {
      title: "Préstamo a domicilio",
      text: "Hasta tres libros por dos semanas. Hacerse socio es gratis.",
    },
    {
      title: "Club de lectura",
      text: "Un libro por mes y una charla el último jueves, con mate.",
    },
    {
      title: "Talleres",
      text: "Escritura, encuadernación y lectura en voz alta, para chicos y grandes.",
    },
    {
      title: "Wifi y computadoras",
      text: "Para hacer un trámite, imprimir un apunte o buscar trabajo.",
    },
  ],
};

/** Links externos: se abren en otra pestaña. */
export const resources = {
  kicker: "Recursos",
  title: "Para leer desde casa",
  mark: "Bibliotecas digitales abiertas, con miles de libros de dominio público.",
  items: [
    { label: "Proyecto Gutenberg", href: "https://www.gutenberg.org/", note: "Clásicos de dominio público" },
    { label: "Open Library", href: "https://openlibrary.org/", note: "Catálogo abierto y préstamo digital" },
    { label: "Wikisource", href: "https://es.wikisource.org/", note: "Textos libres en español" },
    { label: "Biblioteca Digital Hispánica", href: "https://bdh.bne.es/", note: "Biblioteca Nacional de España" },
  ],
};

export const contact = {
  kicker: "Contacto",
  title: "Vení cuando quieras",
  mark: "La entrada es libre. Para hacerte socio traé tu documento.",
  hours: {
    title: "Horarios",
    lines: ["Lunes a viernes, de 10 a 20", "Sábados, de 10 a 14"],
  },
  place: {
    title: "Dónde",
    lines: ["Calle Falsa 123", "Barrio del Ombú"],
  },
  email: "hola@example.com",
  cta: "Escribinos",
};
