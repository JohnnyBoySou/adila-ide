import type { TokenType } from "./languages";

/**
 * Mapeamento de token para CSS var. As cores ficam definidas em
 * adila-editor.css consumindo as CSS vars do tema Tailwind do projeto.
 */
export const TOKEN_CLASS: Record<TokenType, string> = {
  plain: "tk-plain",
  keyword: "tk-keyword",
  string: "tk-string",
  number: "tk-number",
  comment: "tk-comment",
  operator: "tk-operator",
  punctuation: "tk-punctuation",
  variable: "tk-variable",
  function: "tk-function",
  type: "tk-type",
  constant: "tk-constant",
  tag: "tk-tag",
  attribute: "tk-attribute",
  namespace: "tk-namespace",
  parameter: "tk-parameter",
  property: "tk-property",
  decorator: "tk-decorator",
  regexp: "tk-regexp",
};
