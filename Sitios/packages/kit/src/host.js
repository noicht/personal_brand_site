/**
 * QA o producción. Es el mismo build en los dos: deploy.yml lo publica en <sitio>.qa.example.com
 * y promote.yml copia esos archivos al dominio de producción. Lo que tiene que cambiar entre uno y
 * otro (Analytics, herramientas para revisar el sitio) se decide en el navegador, por el host.
 *
 * QA_DOMAIN se repite en otros lugares y tienen que coincidir todos (ver docs/github-actions.md):
 *   - .github/workflows/deploy.yml y promote.yml (env QA_DOMAIN)
 *   - Sitios/infra/Caddyfile (el `ask` de on_demand_tls)
 *   - Sitios/infra/sites/qa.example.com.caddy (nombre del archivo y el bloque)
 */
export const QA_DOMAIN = "qa.example.com";

/**
 * true en QA (<sitio>.qa.example.com). Sin `hostname` usa el de la página; en el prerender
 * (sin `location`) da false, así que llamalo en onMount o en un handler.
 * @param {string} [hostname]
 */
export function isQa(hostname = typeof location !== "undefined" ? location.hostname : "") {
  return hostname === QA_DOMAIN || hostname.endsWith(`.${QA_DOMAIN}`);
}
