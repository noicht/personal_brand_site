import { health } from "./health.js";

/**
 * Registro de features generales.
 * Cada uno recibe `{ method, body, request, url }` y devuelve un objeto JSON
 * o lanza con `.status` y `.message`.
 *
 * Para sumar uno: un archivo en esta carpeta (ver health.js) y una línea acá.
 * Queda en /api/v1/<nombre>.
 *
 * Features específicos de un solo sitio van en otro servicio o se agregan acá
 * solo si varios sitios los comparten.
 */
export const features = {
  health,
};
