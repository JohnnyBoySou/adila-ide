import { describe, expect, it } from "vitest";
import type * as proto from "vscode-languageserver-protocol";
import { editsFromCompletion, editsFromWorkspaceEdit, snippetToPlainText } from "./applyLspEdits";

describe("snippetToPlainText", () => {
  it("converte placeholders simples de snippet em texto aplicável", () => {
    expect(snippetToPlainText("console.log(${1:value})$0")).toBe("console.log(value)");
  });

  it("usa a primeira opção de choice placeholders", () => {
    expect(snippetToPlainText("${1|const,let,var|} name = $2")).toBe("const name = ");
  });
});

describe("editsFromCompletion", () => {
  it("usa textEdit quando o servidor envia range explícito", () => {
    const item: proto.CompletionItem = {
      label: "render",
      textEdit: {
        range: {
          start: { line: 2, character: 4 },
          end: { line: 2, character: 7 },
        },
        newText: "render()",
      },
    };

    expect(
      editsFromCompletion(item, {
        start: { line: 0, col: 0 },
        end: { line: 0, col: 0 },
      }),
    ).toEqual([
      {
        range: { start: { line: 2, col: 4 }, end: { line: 2, col: 7 } },
        text: "render()",
      },
    ]);
  });

  it("inclui additionalTextEdits antes do edit principal", () => {
    const item: proto.CompletionItem = {
      label: "Button",
      insertText: "Button",
      additionalTextEdits: [
        {
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
          },
          newText: "import { Button } from './ui';\n",
        },
      ],
    };

    expect(
      editsFromCompletion(item, {
        start: { line: 4, col: 10 },
        end: { line: 4, col: 12 },
      }),
    ).toEqual([
      {
        range: { start: { line: 0, col: 0 }, end: { line: 0, col: 0 } },
        text: "import { Button } from './ui';\n",
      },
      {
        range: { start: { line: 4, col: 10 }, end: { line: 4, col: 12 } },
        text: "Button",
      },
    ]);
  });
});

describe("editsFromWorkspaceEdit", () => {
  it("filtra edições para o documento atual", () => {
    const edit: proto.WorkspaceEdit = {
      changes: {
        "file:///workspace/a.ts": [
          {
            range: {
              start: { line: 1, character: 2 },
              end: { line: 1, character: 5 },
            },
            newText: "abc",
          },
        ],
        "file:///workspace/b.ts": [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 0 },
            },
            newText: "ignored",
          },
        ],
      },
    };

    expect(editsFromWorkspaceEdit(edit, "file:///workspace/a.ts")).toEqual([
      {
        range: { start: { line: 1, col: 2 }, end: { line: 1, col: 5 } },
        text: "abc",
      },
    ]);
  });
});
