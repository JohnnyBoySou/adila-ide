// Monaco workers devem ser configurados antes de qualquer import do monaco-editor
import "@/lib/monaco-workers";
import React from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { TerminalProvider } from "@/features/terminal/store";

const container = document.getElementById("root");

const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <TerminalProvider>
      <App />
    </TerminalProvider>
  </React.StrictMode>
);
