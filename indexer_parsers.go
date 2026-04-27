package main

import (
	"strings"
	"sync"
	"unsafe"

	ts "github.com/tree-sitter/go-tree-sitter"
	tsgo "github.com/tree-sitter/tree-sitter-go/bindings/go"
	tspython "github.com/tree-sitter/tree-sitter-python/bindings/go"
	tsrust "github.com/tree-sitter/tree-sitter-rust/bindings/go"
	tsts "github.com/tree-sitter/tree-sitter-typescript/bindings/go"
)

// indexer_parsers.go encapsula tudo que envolve tree-sitter: grammar, query
// e mapeamento de capturas pra Symbol. Um pool por linguagem é mantido
// porque ts.Parser não é thread-safe.

// detectLanguage devolve o id da linguagem com base na extensão. "" significa
// "ignora esse arquivo". TSX é grammar separada de TS (precisa parser próprio),
// JS reusa o grammar TS porque o subconjunto sintático bate.
func detectLanguage(path string) string {
	switch {
	case strings.HasSuffix(path, ".go"):
		return "go"
	case strings.HasSuffix(path, ".tsx"):
		return "tsx"
	case strings.HasSuffix(path, ".ts"),
		strings.HasSuffix(path, ".mts"),
		strings.HasSuffix(path, ".cts"):
		return "ts"
	case strings.HasSuffix(path, ".jsx"):
		return "tsx"
	case strings.HasSuffix(path, ".js"),
		strings.HasSuffix(path, ".mjs"),
		strings.HasSuffix(path, ".cjs"):
		return "ts"
	case strings.HasSuffix(path, ".rs"):
		return "rust"
	case strings.HasSuffix(path, ".py"),
		strings.HasSuffix(path, ".pyi"):
		return "python"
	default:
		return ""
	}
}

// langSpec define como uma linguagem é parseada e quais capturas viram quais
// kinds de símbolo. Centraliza tudo em um lugar pra fácil extensão.
type langSpec struct {
	id       string
	language *ts.Language
	query    *ts.Query
	// captureKind mapeia o nome da captura no .scm pro kind salvo no DB.
	// Capturas não mapeadas (ex.: @scope, @name) são contexto e não viram
	// Symbol sozinhas.
	captureKind map[string]string
}

// queryGo extrai top-level symbols de Go. Padrões mutuamente exclusivos pra
// evitar que o mesmo nó (ex.: type Foo struct{}) bata em múltiplos kinds.
const queryGo = `
(function_declaration
  name: (identifier) @name) @kind.function

(method_declaration
  receiver: (parameter_list) @scope
  name: (field_identifier) @name) @kind.method

(type_declaration
  (type_spec
    name: (type_identifier) @name
    type: (struct_type))) @kind.struct

(type_declaration
  (type_spec
    name: (type_identifier) @name
    type: (interface_type))) @kind.interface

(type_declaration
  (type_alias
    name: (type_identifier) @name)) @kind.type

(type_declaration
  (type_spec
    name: (type_identifier) @name
    type: [
      (type_identifier)
      (qualified_type)
      (pointer_type)
      (slice_type)
      (array_type)
      (map_type)
      (channel_type)
      (function_type)
      (generic_type)
      (parenthesized_type)
    ])) @kind.type

(source_file
  (const_declaration
    (const_spec
      name: (identifier) @name))) @kind.const

(source_file
  (var_declaration
    (var_spec
      name: (identifier) @name))) @kind.var
`

var goCaptureKind = map[string]string{
	"kind.function":  "function",
	"kind.method":    "method",
	"kind.struct":    "struct",
	"kind.interface": "interface",
	"kind.type":      "type",
	"kind.const":     "const",
	"kind.var":       "var",
}

// queryTS cobre TypeScript/JavaScript. Targets ficam nas declarations puras —
// `export class Foo {}` envelopa um class_declaration que matcha igual ao
// não-exportado, então não precisa duplicar com export_statement.
//
// `class_body` e `interface_body` capturam métodos sem matchar a classe
// inteira. Methods herdam o nome da classe via @scope.
const queryTS = `
(function_declaration
  name: (identifier) @name) @kind.function

(class_declaration
  name: (type_identifier) @name) @kind.class

(abstract_class_declaration
  name: (type_identifier) @name) @kind.class

(interface_declaration
  name: (type_identifier) @name) @kind.interface

(type_alias_declaration
  name: (type_identifier) @name) @kind.type

(enum_declaration
  name: (identifier) @name) @kind.enum

;; method foo() {}  e  async foo() {} dentro de class_body
(method_definition
  name: [
    (property_identifier) @name
    (private_property_identifier) @name
  ]) @kind.method

;; const foo = () => ... | const foo = function() {} no top-level
(program
  (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: [
        (arrow_function)
        (function_expression)
      ]))) @kind.function

(program
  (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: [
        (string)
        (number)
        (true)
        (false)
        (null)
        (object)
        (array)
        (template_string)
        (binary_expression)
        (member_expression)
        (call_expression)
        (identifier)
      ]))) @kind.const

(program
  (variable_declaration
    (variable_declarator
      name: (identifier) @name))) @kind.var

;; export const foo = () => ...
(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: [
        (arrow_function)
        (function_expression)
      ]))) @kind.function

;; export const VERSION = "..."  (todos os literais/expressões não-funcionais)
(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: [
        (string)
        (number)
        (true)
        (false)
        (null)
        (object)
        (array)
        (template_string)
        (binary_expression)
        (member_expression)
        (call_expression)
        (identifier)
      ]))) @kind.const
`

var tsCaptureKind = map[string]string{
	"kind.function":  "function",
	"kind.method":    "method",
	"kind.class":     "class",
	"kind.interface": "interface",
	"kind.type":      "type",
	"kind.enum":      "enum",
	"kind.const":     "const",
	"kind.var":       "var",
}

// queryRust foca em itens declarados em arquivos top-level e dentro de
// `impl Foo { ... }`. Methods de impl viram kind=method com @scope no nome
// do tipo; trait methods também aparecem.
const queryRust = `
(function_item
  name: (identifier) @name) @kind.function

(struct_item
  name: (type_identifier) @name) @kind.struct

(enum_item
  name: (type_identifier) @name) @kind.enum

(union_item
  name: (type_identifier) @name) @kind.struct

(trait_item
  name: (type_identifier) @name) @kind.interface

(type_item
  name: (type_identifier) @name) @kind.type

(const_item
  name: (identifier) @name) @kind.const

(static_item
  name: (identifier) @name) @kind.var

(macro_definition
  name: (identifier) @name) @kind.macro

(mod_item
  name: (identifier) @name) @kind.module

;; impl Foo { fn bar() {} }  → bar vira method com scope=Foo. Captura o
;; type da impl via @scope; o function_item filho via @kind.method.
(impl_item
  type: (type_identifier) @scope
  body: (declaration_list
    (function_item
      name: (identifier) @name) @kind.method))
`

var rustCaptureKind = map[string]string{
	"kind.function":  "function",
	"kind.method":    "method",
	"kind.struct":    "struct",
	"kind.enum":      "enum",
	"kind.interface": "interface", // trait
	"kind.type":      "type",
	"kind.const":     "const",
	"kind.var":       "var", // static
	"kind.macro":     "macro",
	"kind.module":    "module",
}

// queryPython captura definições top-level e methods de classe. Constantes
// são apenas atribuições simples no escopo do módulo (heurística PEP-8:
// variáveis em UPPER_CASE no top-level), mas pra simplificar capturamos
// qualquer assignment top-level — quem ranqueia é o frontend.
const queryPython = `
(function_definition
  name: (identifier) @name) @kind.function

(class_definition
  name: (identifier) @name) @kind.class

;; method dentro de classe. @scope vira o nome da classe pai.
(class_definition
  name: (identifier) @scope
  body: (block
    (function_definition
      name: (identifier) @name) @kind.method))

(module
  (expression_statement
    (assignment
      left: (identifier) @name))) @kind.const
`

var pythonCaptureKind = map[string]string{
	"kind.function": "function",
	"kind.method":   "method",
	"kind.class":    "class",
	"kind.const":    "const",
}

var (
	langOnce sync.Map // map[string]*langSpec — lazy: compila o Query só na 1a vez
)

// getLangSpec compila preguiçosamente o Query do tree-sitter. Compilar custa
// alguns ms — fazer isso por arquivo seria caro.
func getLangSpec(id string) (*langSpec, error) {
	if cached, ok := langOnce.Load(id); ok {
		return cached.(*langSpec), nil
	}
	spec, err := buildLangSpec(id)
	if err != nil {
		return nil, err
	}
	actual, _ := langOnce.LoadOrStore(id, spec)
	return actual.(*langSpec), nil
}

func buildLangSpec(id string) (*langSpec, error) {
	switch id {
	case "go":
		return compileSpec("go", tsgo.Language(), queryGo, goCaptureKind)
	case "ts":
		return compileSpec("ts", tsts.LanguageTypescript(), queryTS, tsCaptureKind)
	case "tsx":
		return compileSpec("tsx", tsts.LanguageTSX(), queryTS, tsCaptureKind)
	case "rust":
		return compileSpec("rust", tsrust.Language(), queryRust, rustCaptureKind)
	case "python":
		return compileSpec("python", tspython.Language(), queryPython, pythonCaptureKind)
	default:
		return nil, &unsupportedLangError{id: id}
	}
}

// compileSpec é o atalho compartilhado entre todas as linguagens; isola o
// boilerplate de NewLanguage + NewQuery + erro tipado. As bindings de cada
// grammar devolvem unsafe.Pointer com o cookie do tree-sitter, que é o
// formato esperado por ts.NewLanguage.
func compileSpec(id string, raw unsafe.Pointer, source string, kinds map[string]string) (*langSpec, error) {
	lang := ts.NewLanguage(raw)
	q, qerr := ts.NewQuery(lang, source)
	if qerr != nil {
		return nil, qerr
	}
	return &langSpec{id: id, language: lang, query: q, captureKind: kinds}, nil
}

type unsupportedLangError struct{ id string }

func (e *unsupportedLangError) Error() string { return "linguagem não suportada: " + e.id }

// parserPool reusa Parser entre arquivos. Um Parser tem custo de alocação
// não-trivial e dá pra reusar livremente desde que cada goroutine pegue um.
type parserPool struct {
	pool sync.Pool
	lang *ts.Language
}

func newParserPool(lang *ts.Language) *parserPool {
	return &parserPool{
		lang: lang,
		pool: sync.Pool{
			New: func() any {
				p := ts.NewParser()
				_ = p.SetLanguage(lang)
				return p
			},
		},
	}
}

func (pp *parserPool) get() *ts.Parser {
	return pp.pool.Get().(*ts.Parser)
}

func (pp *parserPool) put(p *ts.Parser) {
	pp.pool.Put(p)
}

// kindPriority resolve conflitos quando o mesmo identificador bate em
// múltiplos padrões. Ex.: em Rust, `fn greet` dentro de `impl Foo` matcha
// o pattern de impl method E o pattern bare function_item — queremos manter
// "method". Mesmo issue em Python (function_definition aparece sozinho e
// dentro de class_definition.body).
//
// Mais específico = maior. Em empate vence o último a chegar.
var kindPriority = map[string]int{
	"method":    100,
	"function":  50,
	"class":     50,
	"struct":    50,
	"interface": 50,
	"enum":      50,
	"type":      40,
	"macro":     40,
	"module":    40,
	"const":     10,
	"var":       5,
}

// extractSymbols parseia src com a linguagem, roda a query e devolve os
// símbolos top-level. Faz dedup por (linha, coluna, nome) priorizando o
// kind mais específico — necessário porque tree-sitter aplica TODOS os
// padrões que matcham e padrões "method" frequentemente sobrepõem com
// "function".
func extractSymbols(spec *langSpec, parser *ts.Parser, src []byte) ([]Symbol, error) {
	tree := parser.Parse(src, nil)
	if tree == nil {
		return nil, nil
	}
	defer tree.Close()
	root := tree.RootNode()

	cursor := ts.NewQueryCursor()
	defer cursor.Close()

	captureNames := spec.query.CaptureNames()
	matches := cursor.Matches(spec.query, root, src)

	type key struct {
		line, col int
		name      string
	}
	dedup := make(map[key]Symbol, 64)

	for {
		m := matches.Next()
		if m == nil {
			break
		}
		var name, scope, signature, kind string
		var line, col, endLine int
		for _, cap := range m.Captures {
			capName := captureNames[cap.Index]
			node := cap.Node
			switch capName {
			case "name":
				name = node.Utf8Text(src)
				line = int(node.StartPosition().Row)
				col = int(node.StartPosition().Column)
			case "scope":
				scope = strings.TrimSpace(node.Utf8Text(src))
			default:
				if k, ok := spec.captureKind[capName]; ok {
					kind = k
					endLine = int(node.EndPosition().Row)
					signature = firstLine(node.Utf8Text(src))
				}
			}
		}
		if name == "" || kind == "" {
			continue
		}
		k := key{line, col, name}
		candidate := Symbol{
			Name:      name,
			Kind:      kind,
			Scope:     scope,
			Line:      line,
			Col:       col,
			EndLine:   endLine,
			Signature: signature,
		}
		existing, has := dedup[k]
		if !has || kindPriority[candidate.Kind] > kindPriority[existing.Kind] {
			dedup[k] = candidate
		}
	}

	out := make([]Symbol, 0, len(dedup))
	for _, s := range dedup {
		out = append(out, s)
	}
	return out, nil
}

// firstLine devolve a primeira linha não-vazia do texto, truncada em 200
// chars. Suficiente pra exibir a assinatura no tooltip do palette sem
// inflar o DB com corpos inteiros de função.
func firstLine(s string) string {
	for _, line := range strings.Split(s, "\n") {
		t := strings.TrimSpace(line)
		if t == "" {
			continue
		}
		if len(t) > 200 {
			t = t[:200]
		}
		return t
	}
	return ""
}
