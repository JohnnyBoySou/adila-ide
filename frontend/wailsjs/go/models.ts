// Shim de compatibilidade Wails v2 -> v3.
// O gerador v2 expunha os models dentro de um namespace `main`. A v3 emite
// classes diretamente em frontend/bindings/ide/models.ts. Reexportamos como
// namespace para manter `import type { main } from "../wailsjs/go/models"`
// funcionando e `main.FileEntry` resolvendo corretamente.

export * as main from "../../bindings/ide/models";
