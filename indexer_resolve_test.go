package main

import (
	"os"
	"path/filepath"
	"testing"
)

// TestResolveImport_Aliases cobre o fluxo completo: tsconfig.json com
// paths "@/*" → resolveOnDisk testando .tsx/.ts/index.tsx. Casos
// representativos do mundo Next.js/Vite que motivaram a feature.
func TestResolveImport_Aliases(t *testing.T) {
	t.Setenv("XDG_CACHE_HOME", t.TempDir())
	root := t.TempDir()

	// tsconfig com baseUrl="." e "@/*": "src/*"
	mkdirAndWrite(t, filepath.Join(root, "tsconfig.json"), `{
  // tsconfig de exemplo
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}`)
	mkdirAndWrite(t, filepath.Join(root, "src", "components", "ui", "SiteHeader.tsx"), "export default function SiteHeader(){return null}")
	mkdirAndWrite(t, filepath.Join(root, "src", "lib", "utils.ts"), "export const x = 1")
	mkdirAndWrite(t, filepath.Join(root, "src", "feature", "index.tsx"), "export default function F(){}")
	mkdirAndWrite(t, filepath.Join(root, "src", "page.tsx"), "import S from '@/components/ui/SiteHeader'")

	idx := NewIndexer(NewConfig())
	idx.startup(t.Context())
	if err := idx.SetWorkdir(root); err != nil {
		t.Fatalf("SetWorkdir: %v", err)
	}
	t.Cleanup(func() { idx.shutdown(nil) })

	page := filepath.Join(root, "src", "page.tsx")

	cases := []struct {
		name string
		spec string
		want string
	}{
		{"alias com extensão tsx", "@/components/ui/SiteHeader", filepath.Join(root, "src", "components", "ui", "SiteHeader.tsx")},
		{"alias com extensão ts", "@/lib/utils", filepath.Join(root, "src", "lib", "utils.ts")},
		{"alias resolvendo /index.tsx", "@/feature", filepath.Join(root, "src", "feature", "index.tsx")},
		{"relativo ./", "./components/ui/SiteHeader", filepath.Join(root, "src", "components", "ui", "SiteHeader.tsx")},
		{"bare specifier inexistente", "react", ""},
		{"alias inexistente", "@/inexistente", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := idx.ResolveImport(page, tc.spec)
			if err != nil {
				t.Fatalf("ResolveImport: %v", err)
			}
			if got != tc.want {
				t.Errorf("spec=%q got=%q want=%q", tc.spec, got, tc.want)
			}
		})
	}
}

func TestResolveImport_NodeModulesPackage(t *testing.T) {
	t.Setenv("XDG_CACHE_HOME", t.TempDir())
	root := t.TempDir()

	mkdirAndWrite(t, filepath.Join(root, "src", "page.tsx"), "import { Button } from 'pkg'")
	mkdirAndWrite(t, filepath.Join(root, "node_modules", "pkg", "package.json"), `{
  "name": "pkg",
  "types": "dist/index.d.ts",
  "main": "dist/index.js"
}`)
	mkdirAndWrite(t, filepath.Join(root, "node_modules", "pkg", "dist", "index.d.ts"), "export declare const Button: unknown")

	idx := NewIndexer(NewConfig())
	idx.startup(t.Context())
	if err := idx.SetWorkdir(root); err != nil {
		t.Fatalf("SetWorkdir: %v", err)
	}
	t.Cleanup(func() { idx.shutdown(nil) })

	got, err := idx.ResolveImport(filepath.Join(root, "src", "page.tsx"), "pkg")
	if err != nil {
		t.Fatalf("ResolveImport: %v", err)
	}
	want := filepath.Join(root, "node_modules", "pkg", "dist", "index.d.ts")
	if got != want {
		t.Errorf("node_modules package got=%q want=%q", got, want)
	}
}

func TestResolveImport_NodeModulesScopedPackage(t *testing.T) {
	t.Setenv("XDG_CACHE_HOME", t.TempDir())
	root := t.TempDir()

	mkdirAndWrite(t, filepath.Join(root, "src", "page.tsx"), "import x from '@scope/pkg/subpath'")
	mkdirAndWrite(t, filepath.Join(root, "node_modules", "@scope", "pkg", "subpath.ts"), "export default 1")

	idx := NewIndexer(NewConfig())
	idx.startup(t.Context())
	if err := idx.SetWorkdir(root); err != nil {
		t.Fatalf("SetWorkdir: %v", err)
	}
	t.Cleanup(func() { idx.shutdown(nil) })

	got, err := idx.ResolveImport(filepath.Join(root, "src", "page.tsx"), "@scope/pkg/subpath")
	if err != nil {
		t.Fatalf("ResolveImport: %v", err)
	}
	want := filepath.Join(root, "node_modules", "@scope", "pkg", "subpath.ts")
	if got != want {
		t.Errorf("scoped package subpath got=%q want=%q", got, want)
	}
}

// TestResolveImport_NoTsconfig garante que projetos sem tsconfig ainda
// resolvem o "@/" pelo fallback heurístico (src/), porque muitos projetos
// reais usam só jsconfig OU nenhum config.
func TestResolveImport_NoTsconfig(t *testing.T) {
	t.Setenv("XDG_CACHE_HOME", t.TempDir())
	root := t.TempDir()
	mkdirAndWrite(t, filepath.Join(root, "src", "Foo.tsx"), "export default function Foo(){return null}")
	mkdirAndWrite(t, filepath.Join(root, "src", "page.tsx"), "")

	idx := NewIndexer(NewConfig())
	idx.startup(t.Context())
	if err := idx.SetWorkdir(root); err != nil {
		t.Fatalf("SetWorkdir: %v", err)
	}
	t.Cleanup(func() { idx.shutdown(nil) })

	got, err := idx.ResolveImport(filepath.Join(root, "src", "page.tsx"), "@/Foo")
	if err != nil {
		t.Fatalf("ResolveImport: %v", err)
	}
	want := filepath.Join(root, "src", "Foo.tsx")
	if got != want {
		t.Errorf("fallback heurístico falhou: got=%q want=%q", got, want)
	}
}

// TestStripJSONComments lida com JSONC (tsconfig permite // e /* */).
func TestStripJSONComments(t *testing.T) {
	in := []byte(`{
  // line comment
  "a": 1, /* block */
  "b": "// not a comment in string",
  "c": 2
}`)
	out := stripJSONComments(in)
	// O strip preserva strings literais e remove comments — basta o
	// resultado ser JSON válido com o mesmo conteúdo semântico. Round-trip
	// via os.WriteFile + json.Unmarshal seria mais robusto, mas
	// verificação textual aqui já pega regressões grosseiras.
	if !contains(out, []byte(`"a": 1`)) ||
		!contains(out, []byte(`"// not a comment in string"`)) ||
		contains(out, []byte("// line comment")) ||
		contains(out, []byte("/* block */")) {
		t.Errorf("stripJSONComments errou: %s", string(out))
	}
	_ = os.Stdout
}

func contains(haystack, needle []byte) bool {
	if len(needle) == 0 {
		return true
	}
	for i := 0; i+len(needle) <= len(haystack); i++ {
		match := true
		for j := 0; j < len(needle); j++ {
			if haystack[i+j] != needle[j] {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}
