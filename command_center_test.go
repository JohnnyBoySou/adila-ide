package main

import (
	"context"
	"testing"
)

func newBenchCommandCenter(tb testing.TB, root string) *CommandCenter {
	tb.Helper()
	cfg := NewConfig()
	cc := NewCommandCenter(NewGit(cfg), cfg)
	cc.startup(context.Background())
	cc.SetWorkdir(root)
	return cc
}

func BenchmarkListAllFiles_Small(b *testing.B) {
	root := makeWorkspace(b, 10, 20, 20)
	cc := newBenchCommandCenter(b, root)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if files := cc.ListAllFiles(); len(files) == 0 {
			b.Fatal("no files indexed")
		}
	}
}

func BenchmarkListAllFiles_Medium(b *testing.B) {
	root := makeWorkspace(b, 50, 50, 20)
	cc := newBenchCommandCenter(b, root)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if files := cc.ListAllFiles(); len(files) == 0 {
			b.Fatal("no files indexed")
		}
	}
}

func BenchmarkListAllFiles_Large(b *testing.B) {
	root := makeWorkspace(b, 100, 100, 10)
	cc := newBenchCommandCenter(b, root)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if files := cc.ListAllFiles(); len(files) == 0 {
			b.Fatal("no files indexed")
		}
	}
}
