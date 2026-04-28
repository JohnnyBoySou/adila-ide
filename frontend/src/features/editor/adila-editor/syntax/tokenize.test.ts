import { describe, expect, it } from "vitest";
import { INITIAL_STATE, tokenizeLine } from "./tokenize";

function tokens(line: string, lang = "typescriptreact") {
  return tokenizeLine(line, lang, INITIAL_STATE).tokens.map((token) => ({
    type: token.type,
    text: line.slice(token.start, token.end),
  }));
}

describe("tokenizeLine TSX/JSX", () => {
  it("colore tags e atributos JSX", () => {
    expect(tokens('<ToolBox variant="ghost" disabled />')).toEqual([
      { type: "punctuation", text: "<" },
      { type: "component", text: "ToolBox" },
      { type: "attribute", text: "variant" },
      { type: "operator", text: "=" },
      { type: "string", text: '"ghost"' },
      { type: "attribute", text: "disabled" },
      { type: "punctuation", text: "/>" },
    ]);
  });

  it("colore variáveis declaradas e funções arrow", () => {
    expect(tokens("const handleClick = () => setOpen(true);", "typescript")).toEqual([
      { type: "keyword", text: "const" },
      { type: "variable", text: "handleClick" },
      { type: "operator", text: "=" },
      { type: "punctuation", text: "(" },
      { type: "punctuation", text: ")" },
      { type: "operator", text: "=>" },
      { type: "function", text: "setOpen" },
      { type: "punctuation", text: "(" },
      { type: "constant", text: "true" },
      { type: "punctuation", text: ")" },
      { type: "punctuation", text: ";" },
    ]);
  });
});
