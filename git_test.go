package main

import (
	"fmt"
	"strings"
	"testing"
)

func makeStatusRaw(n int) string {
	var b strings.Builder
	for i := 0; i < n; i++ {
		switch i % 5 {
		case 0:
			fmt.Fprintf(&b, "M  src/file%d.go\x00", i)
		case 1:
			fmt.Fprintf(&b, " M src/file%d.go\x00", i)
		case 2:
			fmt.Fprintf(&b, "?? newdir/file%d.go\x00", i)
		case 3:
			fmt.Fprintf(&b, "A  feat/added%d.ts\x00", i)
		case 4:
			fmt.Fprintf(&b, "R  new/path%d.go\x00old/path%d.go\x00", i, i)
		}
	}
	return b.String()
}

func BenchmarkParseStatus_Small(b *testing.B) {
	raw := makeStatusRaw(20)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = parseStatus(raw)
	}
}

func BenchmarkParseStatus_Large(b *testing.B) {
	raw := makeStatusRaw(2000)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = parseStatus(raw)
	}
}
