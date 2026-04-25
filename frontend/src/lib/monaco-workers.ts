/**
 * Configura os workers embutidos do Monaco antes do primeiro uso.
 * Importar este módulo uma vez no entry point (main.tsx).
 *
 * TypeScript, JavaScript, JSON, CSS e HTML têm IntelliSense completo
 * sem qualquer servidor LSP externo — tudo roda no browser via worker.
 */

import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";

declare global {
  interface Window {
    MonacoEnvironment: {
      getWorker(_moduleId: string, label: string): Worker;
    };
  }
}

window.MonacoEnvironment = {
  getWorker(_moduleId: string, label: string): Worker {
    switch (label) {
      case "typescript":
      case "javascript":
        return new tsWorker();
      case "json":
        return new jsonWorker();
      case "css":
      case "scss":
      case "less":
        return new cssWorker();
      case "html":
      case "handlebars":
      case "razor":
        return new htmlWorker();
      default:
        return new editorWorker();
    }
  },
};
