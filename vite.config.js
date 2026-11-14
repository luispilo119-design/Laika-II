import { defineConfig } from 'vite';

// base relativa: el sitio funciona igual en GitHub Pages (/Laika-II/) que en local.
// La navegación usa hash (#/modulo), así que no hace falta configurar rutas en el servidor.
export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: false },
});
