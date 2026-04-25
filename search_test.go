package main

import (
	"testing"
)

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
