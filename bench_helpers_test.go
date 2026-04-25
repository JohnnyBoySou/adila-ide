package main

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

// makeWorkspace cria uma árvore sintética com `dirs` subdiretórios, cada um
// com `filesPerDir` arquivos. Cada arquivo tem `linesPerFile` linhas com
// conteúdo previsível, contendo a string "needle" em ~10% das linhas para que
// buscas tenham resultados não-triviais.
//
// Retorna o root absoluto. Limpeza é feita pelo tb.Cleanup do TempDir.
func makeWorkspace(tb testing.TB, dirs, filesPerDir, linesPerFile int) string {
	tb.Helper()
	root := tb.TempDir()
	for d := 0; d < dirs; d++ {
		dirPath := filepath.Join(root, fmt.Sprintf("pkg%03d", d))
		if err := os.MkdirAll(dirPath, 0o755); err != nil {
			tb.Fatalf("mkdir: %v", err)
		}
		for f := 0; f < filesPerDir; f++ {
			path := filepath.Join(dirPath, fmt.Sprintf("file%03d.go", f))
			if err := os.WriteFile(path, []byte(synthFile(d, f, linesPerFile)), 0o644); err != nil {
				tb.Fatalf("write: %v", err)
			}
		}
	}
	return root
}

func synthFile(d, f, lines int) string {
	var b []byte
	b = append(b, fmt.Sprintf("package pkg%03d\n\n", d)...)
	for i := 0; i < lines; i++ {
		if i%10 == 3 {
			b = append(b, fmt.Sprintf("// needle marker line %d in pkg%03d/file%03d\n", i, d, f)...)
		} else {
			b = append(b, fmt.Sprintf("var v%d = %d\n", i, i*d+f)...)
		}
	}
	return string(b)
}
