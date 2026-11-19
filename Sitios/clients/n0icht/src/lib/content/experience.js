// @ts-check
/**
 * Experiencia: una línea de tiempo orientada a resultados. Las empresas, los clientes y los
 * años son datos confirmados; roles, resúmenes, resultados y stacks son placeholders.
 */

/** @type {import("./types.js").ExperienceContent} */
export const experience = {
  id: "experience",
  title: "Experience",
  lead: "Outcomes first. Titles second.",
  forLabel: "for",
  presentLabel: "present",
  outcomesLabel: "Outcomes",
  stackLabel: "Stack",
  entries: [
    {
      id: "baufest",
      company: "Baufest",
      client: "BBVA",
      // TODO(content): rol y resultados reales de Baufest.
      role: "Software Engineer",
      start: "2025",
      end: "2026",
      summary: "Backend work on banking systems inside a large, regulated delivery pipeline.",
      outcomes: [
        "Shipped backend changes inside an environment where correctness and audit trails are the default.",
        "Worked across team boundaries: APIs, data access and deployment inside an existing platform.",
      ],
      stack: ["Backend services", "Banking platform", "CI/CD"],
      todo: true,
    },
    {
      id: "janos",
      company: "Jano's Eventos",
      // TODO(content): rol y resultados reales de Jano's Eventos.
      role: "Software Engineer",
      start: "2024",
      end: "2024",
      summary: "Built and operated the software behind an events company's day-to-day operations.",
      outcomes: [
        "Turned manual, spreadsheet-driven work into a small system the team actually uses.",
        "Owned the full path: scoping, building, deploying and keeping it running.",
      ],
      stack: ["Backend services", "Databases", "Deployment"],
      todo: true,
    },
    {
      id: "nodus",
      company: "Nodus Company",
      // TODO(content): rol y resultados reales de Nodus Company.
      role: "Software Engineer",
      start: "2021",
      end: "2024",
      summary: "Three years building backend services and APIs for products going from zero to production.",
      outcomes: [
        "Took services from a blank repo to running in production: design, build, deploy, observe.",
        "Kept the systems boring: typed contracts, small changes, tested paths.",
      ],
      stack: ["Backend services", "APIs", "Cloud"],
      todo: true,
    },
  ],
};
