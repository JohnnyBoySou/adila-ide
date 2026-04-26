/**
 * Bridge LSP direto ↔ Monaco, sem monaco-languageclient.
 *
 * Por que não monaco-languageclient v10? Ele depende de @codingame/monaco-vscode-api,
 * que substitui a instância Monaco — o que conflita com @monaco-editor/react (que carrega
 * monaco-editor diretamente). Os providers registrados via vscode-api ficam num módulo
 * Monaco diferente do editor real, e nada aparece na UI.
 *
 * Esta bridge:
 *  - Abre uma conexão JSON-RPC por (lang, rootUri) e compartilha entre abas.
 *  - Faz `initialize` / `initialized`, manda `didOpen` ao registrar um modelo,
 *    `didChange` em cada edit e `didClose` ao desregistrar.
 *  - Registra providers de completion + hover via monaco.languages.* (mesma instância
 *    que o editor usa).
 *  - Recebe `publishDiagnostics` e popula markers via monaco.editor.setModelMarkers.
 */

import { createMessageConnection } from "vscode-jsonrpc/browser";
import { toSocket } from "vscode-ws-jsonrpc";
import type * as proto from "vscode-languageserver-protocol";

type Monaco = typeof import("monaco-editor");
type ITextModel = import("monaco-editor").editor.ITextModel;
type IDisposable = import("monaco-editor").IDisposable;

type ConnectArgs = {
  monaco: Monaco;
  lang: string;
  rootUri: string;
  port: number;
  onError: (msg: string, err?: unknown) => void;
};

const MONACO_BUILTIN = new Set(["json", "css", "html"]);

export function isLSPRelevant(lang: string): boolean {
  return !!lang && lang !== "plaintext" && !MONACO_BUILTIN.has(lang);
}

const clients = new Map<string, Promise<LSPClient | null>>();

export function getOrCreateClient(args: ConnectArgs): Promise<LSPClient | null> {
  const key = `${args.lang}::${args.rootUri}`;
  let p = clients.get(key);
  if (!p) {
    p = LSPClient.connect(args).catch((err) => {
      args.onError(`Falha ao conectar LSP (${args.lang})`, err);
      clients.delete(key);
      return null;
    });
    clients.set(key, p);
  }
  return p;
}

class LSPClient {
  private connection: ReturnType<typeof createMessageConnection>;
  private monaco: Monaco;
  private lang: string;
  private rootUri: string;
  private serverCaps: proto.ServerCapabilities = {};
  private models = new Map<string, { version: number; subs: IDisposable[] }>();
  private providerDisposables: IDisposable[] = [];
  private onError: ConnectArgs["onError"];
  private disposed = false;

  private constructor(
    monaco: Monaco,
    lang: string,
    rootUri: string,
    connection: ReturnType<typeof createMessageConnection>,
    onError: ConnectArgs["onError"],
  ) {
    this.monaco = monaco;
    this.lang = lang;
    this.rootUri = rootUri;
    this.connection = connection;
    this.onError = onError;
  }

  static async connect(args: ConnectArgs): Promise<LSPClient | null> {
    const { monaco, lang, rootUri, port, onError } = args;
    const url = `ws://127.0.0.1:${port}/lsp/${lang}?root=${encodeURIComponent(rootUri)}`;
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error(`WebSocket falhou: ${url}`));
    });

    const socket = toSocket(ws);
    const reader = new (await import("vscode-ws-jsonrpc")).WebSocketMessageReader(socket);
    const writer = new (await import("vscode-ws-jsonrpc")).WebSocketMessageWriter(socket);
    const connection = createMessageConnection(reader, writer);

    const client = new LSPClient(monaco, lang, rootUri, connection, onError);

    connection.onClose(() => {
      client.dispose();
      clients.delete(`${lang}::${rootUri}`);
    });
    connection.onError(([err]) => onError(`Erro LSP (${lang})`, err));

    connection.listen();

    try {
      const initResp = await connection.sendRequest<proto.InitializeResult>("initialize", {
        processId: null,
        rootUri,
        workspaceFolders: [{ uri: rootUri, name: "root" }],
        capabilities: {
          textDocument: {
            synchronization: { didSave: true, willSave: false, willSaveWaitUntil: false },
            completion: {
              completionItem: {
                snippetSupport: true,
                documentationFormat: ["markdown", "plaintext"],
                insertReplaceSupport: true,
                resolveSupport: { properties: ["documentation", "detail"] },
              },
              contextSupport: true,
            },
            hover: { contentFormat: ["markdown", "plaintext"] },
            publishDiagnostics: { relatedInformation: true },
          },
        },
      } as proto.InitializeParams);

      client.serverCaps = initResp.capabilities ?? {};
      await connection.sendNotification("initialized", {});
    } catch (err) {
      onError(`Falha no initialize do LSP (${lang})`, err);
      ws.close();
      return null;
    }

    client.installProviders();
    client.installDiagnosticsHandler();
    return client;
  }

  /**
   * Registra um modelo Monaco no LSP: didOpen + ouve mudanças (didChange).
   * Retorna função de detach que dispara didClose e desregistra os listeners.
   */
  attachModel(model: ITextModel): () => void {
    const uri = model.uri.toString();
    if (this.models.has(uri)) {
      return () => this.detachModel(uri);
    }

    const version = 1;
    this.models.set(uri, { version, subs: [] });

    void this.connection.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri,
        languageId: this.lang,
        version,
        text: model.getValue(),
      },
    } satisfies proto.DidOpenTextDocumentParams);

    const sub = model.onDidChangeContent(() => {
      const entry = this.models.get(uri);
      if (!entry) return;
      entry.version += 1;
      void this.connection.sendNotification("textDocument/didChange", {
        textDocument: { uri, version: entry.version },
        contentChanges: [{ text: model.getValue() }],
      } satisfies proto.DidChangeTextDocumentParams);
    });
    this.models.get(uri)!.subs.push(sub);

    const onDispose = model.onWillDispose(() => this.detachModel(uri));
    this.models.get(uri)!.subs.push(onDispose);

    return () => this.detachModel(uri);
  }

  private detachModel(uri: string) {
    const entry = this.models.get(uri);
    if (!entry) return;
    entry.subs.forEach((s) => s.dispose());
    this.models.delete(uri);
    void this.connection.sendNotification("textDocument/didClose", {
      textDocument: { uri },
    } satisfies proto.DidCloseTextDocumentParams);
  }

  /**
   * Instala providers de completion + hover na linguagem. Idempotente — Monaco
   * permite múltiplos providers, mas só queremos um por (lang, instância).
   */
  private installProviders() {
    const monaco = this.monaco;
    const triggers = this.serverCaps.completionProvider?.triggerCharacters ?? [".", ":", "/", "@"];

    if (this.serverCaps.completionProvider) {
      const d = monaco.languages.registerCompletionItemProvider(this.lang, {
        triggerCharacters: triggers,
        provideCompletionItems: async (model, position) => {
          if (!this.models.has(model.uri.toString())) return { suggestions: [] };
          try {
            const resp = await this.connection.sendRequest<
              proto.CompletionItem[] | proto.CompletionList | null
            >("textDocument/completion", {
              textDocument: { uri: model.uri.toString() },
              position: { line: position.lineNumber - 1, character: position.column - 1 },
              context: { triggerKind: 1 },
            } satisfies proto.CompletionParams);

            const items = Array.isArray(resp) ? resp : (resp?.items ?? []);
            const word = model.getWordUntilPosition(position);
            const fallbackRange = {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn,
            };
            return {
              suggestions: items.map((it) => toMonacoCompletion(monaco, it, fallbackRange)),
              incomplete: !Array.isArray(resp) && !!resp?.isIncomplete,
            };
          } catch (err) {
            this.onError(`Erro em completion (${this.lang})`, err);
            return { suggestions: [] };
          }
        },
      });
      this.providerDisposables.push(d);
    }

    if (this.serverCaps.hoverProvider) {
      const d = monaco.languages.registerHoverProvider(this.lang, {
        provideHover: async (model, position) => {
          if (!this.models.has(model.uri.toString())) return null;
          try {
            const resp = await this.connection.sendRequest<proto.Hover | null>(
              "textDocument/hover",
              {
                textDocument: { uri: model.uri.toString() },
                position: { line: position.lineNumber - 1, character: position.column - 1 },
              } satisfies proto.HoverParams,
            );
            if (!resp) return null;
            return {
              range: resp.range ? toMonacoRange(resp.range) : undefined,
              contents: hoverContents(resp.contents),
            };
          } catch (err) {
            this.onError(`Erro em hover (${this.lang})`, err);
            return null;
          }
        },
      });
      this.providerDisposables.push(d);
    }
  }

  private installDiagnosticsHandler() {
    this.connection.onNotification(
      "textDocument/publishDiagnostics",
      (params: proto.PublishDiagnosticsParams) => {
        const model = this.monaco.editor.getModels().find((m) => m.uri.toString() === params.uri);
        if (!model) return;
        const markers = params.diagnostics.map((d) => toMonacoMarker(this.monaco, d));
        this.monaco.editor.setModelMarkers(model, `lsp:${this.lang}`, markers);
      },
    );
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.providerDisposables.forEach((d) => d.dispose());
    this.providerDisposables = [];
    for (const [uri, entry] of this.models) {
      entry.subs.forEach((s) => s.dispose());
      const model = this.monaco.editor.getModels().find((m) => m.uri.toString() === uri);
      if (model) this.monaco.editor.setModelMarkers(model, `lsp:${this.lang}`, []);
    }
    this.models.clear();
    try {
      this.connection.dispose();
    } catch {
      /* ignore */
    }
  }
}

function toMonacoRange(r: proto.Range) {
  return {
    startLineNumber: r.start.line + 1,
    startColumn: r.start.character + 1,
    endLineNumber: r.end.line + 1,
    endColumn: r.end.character + 1,
  };
}

function toMonacoCompletion(
  monaco: Monaco,
  item: proto.CompletionItem,
  fallbackRange: ReturnType<typeof toMonacoRange>,
): import("monaco-editor").languages.CompletionItem {
  const Kind = monaco.languages.CompletionItemKind;
  const KIND_MAP: Record<number, number> = {
    1: Kind.Text,
    2: Kind.Method,
    3: Kind.Function,
    4: Kind.Constructor,
    5: Kind.Field,
    6: Kind.Variable,
    7: Kind.Class,
    8: Kind.Interface,
    9: Kind.Module,
    10: Kind.Property,
    11: Kind.Unit,
    12: Kind.Value,
    13: Kind.Enum,
    14: Kind.Keyword,
    15: Kind.Snippet,
    16: Kind.Color,
    17: Kind.File,
    18: Kind.Reference,
    19: Kind.Folder,
    20: Kind.EnumMember,
    21: Kind.Constant,
    22: Kind.Struct,
    23: Kind.Event,
    24: Kind.Operator,
    25: Kind.TypeParameter,
  };

  const insertText = item.insertText ?? item.label.toString();
  // InsertTextFormat: 1=PlainText, 2=Snippet
  const isSnippet = item.insertTextFormat === 2;

  let range: ReturnType<typeof toMonacoRange> = fallbackRange;
  let finalText = insertText;
  if (item.textEdit) {
    if ("range" in item.textEdit) {
      range = toMonacoRange(item.textEdit.range);
    } else if ("insert" in item.textEdit) {
      range = toMonacoRange(item.textEdit.insert);
    }
    finalText = item.textEdit.newText;
  }

  return {
    label: item.label as string,
    kind: KIND_MAP[item.kind ?? 0] ?? Kind.Text,
    insertText: finalText,
    insertTextRules: isSnippet
      ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      : monaco.languages.CompletionItemInsertTextRule.None,
    detail: item.detail,
    documentation:
      typeof item.documentation === "string"
        ? item.documentation
        : item.documentation
          ? { value: item.documentation.value }
          : undefined,
    sortText: item.sortText,
    filterText: item.filterText,
    preselect: item.preselect,
    range,
  };
}

function hoverContents(contents: proto.Hover["contents"]) {
  if (typeof contents === "string") return [{ value: contents }];
  if (Array.isArray(contents)) {
    return contents.map((c) =>
      typeof c === "string" ? { value: c } : { value: `\`\`\`${c.language}\n${c.value}\n\`\`\`` },
    );
  }
  // MarkupContent
  if ("kind" in contents) return [{ value: contents.value }];
  // MarkedString single
  return [{ value: `\`\`\`${contents.language}\n${contents.value}\n\`\`\`` }];
}

function toMonacoMarker(
  monaco: Monaco,
  d: proto.Diagnostic,
): import("monaco-editor").editor.IMarkerData {
  const Sev = monaco.MarkerSeverity;
  const sev =
    d.severity === 1
      ? Sev.Error
      : d.severity === 2
        ? Sev.Warning
        : d.severity === 3
          ? Sev.Info
          : Sev.Hint;
  return {
    severity: sev,
    message: d.message,
    source: d.source,
    code: d.code !== undefined ? String(d.code) : undefined,
    startLineNumber: d.range.start.line + 1,
    startColumn: d.range.start.character + 1,
    endLineNumber: d.range.end.line + 1,
    endColumn: d.range.end.character + 1,
  };
}
