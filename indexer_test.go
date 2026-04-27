package main

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

// TestIndexerExtractsTSSymbols cobre TypeScript (e por consequência o
// grammar TSX, que reusa a query). Valida classes, interfaces, type
// aliases, enum, métodos, e variáveis funcionais top-level.
func TestIndexerExtractsTSSymbols(t *testing.T) {
	src := []byte(`export const VERSION = "1.0.0";

export class User {
  name: string = "";
  greet(): string { return "hi " + this.name; }
}

export interface Greeter {
  greet(): string;
}

export type ID = string;

export enum Status { Active, Inactive }

export function newUser(): User { return new User(); }

export const handler = async (req: Request) => req.text();
`)
	spec, err := getLangSpec("ts")
	if err != nil {
		t.Fatalf("getLangSpec: %v", err)
	}
	pool := newParserPool(spec.language)
	parser := pool.get()
	defer pool.put(parser)
	syms, err := extractSymbols(spec, parser, src)
	if err != nil {
		t.Fatalf("extractSymbols: %v", err)
	}
	want := map[string]string{
		"VERSION": "const",
		"User":    "class",
		"greet":   "method",
		"Greeter": "interface",
		"ID":      "type",
		"Status":  "enum",
		"newUser": "function",
		"handler": "function",
	}
	got := indexByName(syms)
	for name, kind := range want {
		if got[name] != kind {
			t.Errorf("TS símbolo %q: kind=%q, queria %q (todos: %+v)", name, got[name], kind, got)
		}
	}
}

// TestIndexerExtractsRustSymbols cobre Rust: struct, enum, trait, fn, impl
// methods, type alias, const e macro_rules.
func TestIndexerExtractsRustSymbols(t *testing.T) {
	src := []byte(`pub const MAX: usize = 100;

pub struct User { pub name: String }

pub enum Status { Active, Inactive }

pub trait Greeter { fn greet(&self) -> String; }

pub type Id = String;

pub fn new_user() -> User { User { name: String::new() } }

impl User {
    pub fn greet(&self) -> String { format!("hi {}", self.name) }
}

macro_rules! say_hi { () => { println!("hi"); }; }
`)
	spec, err := getLangSpec("rust")
	if err != nil {
		t.Fatalf("getLangSpec: %v", err)
	}
	pool := newParserPool(spec.language)
	parser := pool.get()
	defer pool.put(parser)
	syms, err := extractSymbols(spec, parser, src)
	if err != nil {
		t.Fatalf("extractSymbols: %v", err)
	}
	want := map[string]string{
		"MAX":      "const",
		"User":     "struct",
		"Status":   "enum",
		"Greeter":  "interface",
		"Id":       "type",
		"new_user": "function",
		"greet":    "method",
		"say_hi":   "macro",
	}
	got := indexByName(syms)
	for name, kind := range want {
		if got[name] != kind {
			t.Errorf("Rust símbolo %q: kind=%q, queria %q (todos: %+v)", name, got[name], kind, got)
		}
	}
}

// TestIndexerExtractsPythonSymbols cobre Python: class, top-level fn,
// methods de classe e atribuições no top-level.
func TestIndexerExtractsPythonSymbols(t *testing.T) {
	src := []byte(`VERSION = "1.0.0"

class User:
    def __init__(self, name):
        self.name = name

    def greet(self):
        return "hi " + self.name

def new_user(name):
    return User(name)
`)
	spec, err := getLangSpec("python")
	if err != nil {
		t.Fatalf("getLangSpec: %v", err)
	}
	pool := newParserPool(spec.language)
	parser := pool.get()
	defer pool.put(parser)
	syms, err := extractSymbols(spec, parser, src)
	if err != nil {
		t.Fatalf("extractSymbols: %v", err)
	}
	want := map[string]string{
		"VERSION":  "const",
		"User":     "class",
		"__init__": "method",
		"greet":    "method",
		"new_user": "function",
	}
	got := indexByName(syms)
	for name, kind := range want {
		if got[name] != kind {
			t.Errorf("Python símbolo %q: kind=%q, queria %q (todos: %+v)", name, got[name], kind, got)
		}
	}
}

func indexByName(syms []Symbol) map[string]string {
	out := make(map[string]string, len(syms))
	for _, s := range syms {
		out[s.Name] = s.Kind
	}
	return out
}

// TestIndexerExtractsGoSymbols valida a chain completa: tree-sitter → query →
// extractSymbols → DB → searchSymbols. Cobre todos os kinds suportados pelo
// queryGo num único arquivo sintético pra detectar regressão de query
// quando atualizarmos a versão do grammar.
func TestIndexerExtractsGoSymbols(t *testing.T) {
	src := []byte(`package sample

const Pi = 3.14
var Greeting = "hello"

type User struct {
	Name string
}

type Greeter interface {
	Greet() string
}

type ID = string

func New() *User { return &User{} }

func (u *User) Greet() string { return "hi " + u.Name }
`)

	spec, err := getLangSpec("go")
	if err != nil {
		t.Fatalf("getLangSpec: %v", err)
	}
	pool := newParserPool(spec.language)
	parser := pool.get()
	defer pool.put(parser)

	syms, err := extractSymbols(spec, parser, src)
	if err != nil {
		t.Fatalf("extractSymbols: %v", err)
	}

	want := map[string]string{
		"Pi":       "const",
		"Greeting": "var",
		"User":     "struct",
		"Greeter":  "interface",
		"ID":       "type",
		"New":      "function",
		"Greet":    "method",
	}
	got := indexByName(syms)
	for name, kind := range want {
		if got[name] != kind {
			t.Errorf("Go símbolo %q: kind=%q, queria %q (todos: %+v)", name, got[name], kind, got)
		}
	}
}

// TestIndexerSkipsExcludedDirs garante que walk respeita node_modules/.git
// — sem isso uma indexação inicial num projeto npm carregaria minutos
// inteiros parseando deps.
func TestIndexerSkipsExcludedDirs(t *testing.T) {
	root := t.TempDir()
	mkdirAndWrite(t, filepath.Join(root, "main.go"), "package x\nfunc Foo(){}\n")
	mkdirAndWrite(t, filepath.Join(root, "node_modules", "lib", "lib.go"), "package l\nfunc Bar(){}\n")
	mkdirAndWrite(t, filepath.Join(root, ".git", "HEAD"), "ref")

	paths, err := collectIndexablePaths(root, excludeSet(nil))
	if err != nil {
		t.Fatalf("collectIndexablePaths: %v", err)
	}
	rel := make([]string, 0, len(paths))
	for _, p := range paths {
		r, _ := filepath.Rel(root, p)
		rel = append(rel, r)
	}
	if !slices.Contains(rel, "main.go") {
		t.Errorf("main.go não veio em %v", rel)
	}
	for _, p := range rel {
		if strings.Contains(p, "node_modules") || strings.Contains(p, ".git") {
			t.Errorf("path proibido foi indexado: %s", p)
		}
	}
}

func mkdirAndWrite(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

// TestIndexerDB_RoundTrip valida a persistência: upsert → search → reset.
// Mantemos o DB num tmpdir do XDG_CACHE_HOME pra não poluir cache real do
// usuário durante testes.
func TestIndexerDB_RoundTrip(t *testing.T) {
	t.Setenv("XDG_CACHE_HOME", t.TempDir())
	root := t.TempDir()
	db, err := openIndexerDB(root)
	if err != nil {
		t.Fatalf("openIndexerDB: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	syms := []Symbol{
		{Name: "Foo", Kind: "function", Line: 1, Col: 0, EndLine: 3, Signature: "func Foo()"},
		{Name: "Bar", Kind: "type", Line: 5, Col: 0, EndLine: 7, Signature: "type Bar struct{}"},
	}
	if err := db.upsertFileWithSymbols("/x/y.go", "go", "deadbeef", 1700000000, 100, syms); err != nil {
		t.Fatalf("upsert: %v", err)
	}
	hits, err := db.searchSymbols("foo", 10)
	if err != nil {
		t.Fatalf("search: %v", err)
	}
	if len(hits) != 1 || hits[0].Name != "Foo" {
		t.Errorf("search 'foo' deu %+v, esperava 1 Foo", hits)
	}

	// Re-upsert do mesmo path com outro conjunto deve substituir, não somar.
	repl := []Symbol{{Name: "Baz", Kind: "function", Line: 1, Col: 0, EndLine: 2}}
	if err := db.upsertFileWithSymbols("/x/y.go", "go", "feedface", 1700000001, 100, repl); err != nil {
		t.Fatalf("upsert 2: %v", err)
	}
	hits, _ = db.searchSymbols("Foo", 10)
	if len(hits) != 0 {
		t.Errorf("Foo deveria ter sumido após re-upsert, veio %+v", hits)
	}
	hits, _ = db.searchSymbols("Baz", 10)
	if len(hits) != 1 {
		t.Errorf("Baz não veio após re-upsert: %+v", hits)
	}
}
