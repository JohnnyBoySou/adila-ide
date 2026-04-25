package main

import (
	"context"
	"testing"
)

func newBenchApp(tb testing.TB) *App {
	tb.Helper()
	a := NewApp(NewConfig())
	a.ctx = context.Background()
	return a
}

func BenchmarkListDir_Small(b *testing.B) {
	root := makeWorkspace(b, 5, 20, 50)
	a := newBenchApp(b)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := a.ListDir(root); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkListDir_Medium(b *testing.B) {
	root := makeWorkspace(b, 50, 50, 100)
	a := newBenchApp(b)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := a.ListDir(root); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkSearchFiles_Small(b *testing.B) {
	root := makeWorkspace(b, 10, 30, 50)
	a := newBenchApp(b)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := a.SearchFiles(root, "file01"); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkSearchFiles_Medium(b *testing.B) {
	root := makeWorkspace(b, 50, 50, 50)
	a := newBenchApp(b)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := a.SearchFiles(root, "file"); err != nil {
			b.Fatal(err)
		}
	}
}
