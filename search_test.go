package main

import (
	"os"
	"path/filepath"
	"testing"
)

// TestSearchInFiles_Correctness valida os 3 caminhos do matcher (literal,
// literal case-insensitive e regex) com uma árvore conhecida e contagens de
// matches esperadas.
func TestSearchInFiles_Correctness(t *testing.T) {
	root := t.TempDir()
	files := map[string]string{
		"a.txt": "needle here\nNEEDLE caps\nno match\nneedle twice needle\n",
		"b.txt": "Needle mixed case\nplain text only\n",
		"c.txt": "no match anywhere here\n",
	}
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(root, name), []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	a := newBenchApp(t)

	tests := []struct {
		name string
		opts SearchOptions
		want int
	}{
		{"literal_cs", SearchOptions{Query: "needle", CaseSensitive: true, MaxResults: 100}, 3},
		{"literal_ci", SearchOptions{Query: "needle", CaseSensitive: false, MaxResults: 100}, 5},
		{"regex_cs", SearchOptions{Query: `needle\s+\w+`, Regex: true, CaseSensitive: true, MaxResults: 100}, 2},
		{"regex_ci", SearchOptions{Query: `needle\s+\w+`, Regex: true, CaseSensitive: false, MaxResults: 100}, 4},
		{"whole_word", SearchOptions{Query: "needle", WholeWord: true, CaseSensitive: true, MaxResults: 100}, 3},
		{"max_clamp", SearchOptions{Query: "needle", CaseSensitive: false, MaxResults: 2}, 2},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := a.SearchInFiles(root, tc.opts)
			if err != nil {
				t.Fatalf("err: %v", err)
			}
			if len(got) != tc.want {
				t.Errorf("got %d matches, want %d", len(got), tc.want)
				for _, m := range got {
					t.Logf("  %s:%d:%d %q", filepath.Base(m.Path), m.Line, m.Column, m.Preview)
				}
			}
		})
	}
}

func BenchmarkSearchInFiles_Literal(b *testing.B) {
	root := makeWorkspace(b, 20, 30, 100)
	a := newBenchApp(b)
	opts := SearchOptions{Query: "needle", MaxResults: 1000}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := a.SearchInFiles(root, opts); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkSearchInFiles_Regex(b *testing.B) {
	root := makeWorkspace(b, 20, 30, 100)
	a := newBenchApp(b)
	opts := SearchOptions{Query: `needle.*pkg\d{3}`, Regex: true, MaxResults: 1000}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := a.SearchInFiles(root, opts); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkSearchInFiles_CaseInsensitive(b *testing.B) {
	root := makeWorkspace(b, 20, 30, 100)
	a := newBenchApp(b)
	opts := SearchOptions{Query: "NEEDLE", CaseSensitive: false, MaxResults: 1000}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := a.SearchInFiles(root, opts); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkCompileSearchRegex(b *testing.B) {
	opts := SearchOptions{Query: `func\s+\w+\(`, Regex: true}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := compileSearchRegex(opts); err != nil {
			b.Fatal(err)
		}
	}
}
