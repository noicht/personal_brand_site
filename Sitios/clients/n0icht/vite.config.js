import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  // El worker de la escena se arma como módulo y se divide: primero prueba el
  // contexto GL y recién después importa la escena y three.
  worker: { format: "es" },
});
