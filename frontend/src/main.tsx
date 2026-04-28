// Monaco workers devem ser configurados antes de qualquer import do monaco-editor
import "@/lib/monaco-workers";
import React from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { TerminalProvider } from "@/features/terminal/store";

// Bench de I/O do terminal exposto via devtools.
//   await window.__termIOBench(500, 8)
// Carrega lazy pra não pesar bundle inicial.
(
  window as unknown as { __termIOBench?: (r?: number, s?: number) => Promise<unknown> }
).__termIOBench = async (rounds?: number, size?: number) => {
  const m = await import("@/__bench__/terminal_io");
  return m.runTerminalIOBench(rounds, size);
};

const container = document.getElementById("root");

const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <TerminalProvider>
      <App />
    </TerminalProvider>
  </React.StrictMode>,
);
