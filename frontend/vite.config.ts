import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Em dev, injeta o script do React DevTools standalone (rodando em :8097)
// no index.html. Removido em build de produção.
function reactDevtoolsPlugin(): Plugin {
  return {
    name: "react-devtools-standalone",
    apply: "serve",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html.replace(
          "</body>",
          '  <script src="http://localhost:8097"></script>\n  </body>',
        );
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), reactDevtoolsPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    fs: {
      // Permite importar arquivos do repo root (RELEASES.md) via ?raw.
      allow: [path.resolve(__dirname, ".."), __dirname],
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        codeSplitting: true,
      },
    },
  },
});
