package main

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestResolveBinPrefersWorkspaceNodeModules(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	root := t.TempDir()
	binDir := filepath.Join(root, "node_modules", ".bin")
	if err := os.MkdirAll(binDir, 0o755); err != nil {
		t.Fatal(err)
	}
	name := "typescript-language-server"
	if runtime.GOOS == "windows" {
		name += ".cmd"
	}
	want := filepath.Join(binDir, name)
	if err := os.WriteFile(want, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}

	lsp := NewLSP()
	got := lsp.resolveBin("typescript", []string{"typescript-language-server"}, root)
	if got != want {
		t.Fatalf("resolveBin = %q, want %q", got, want)
	}
}

func TestBundledBinPathChecksManagedLayout(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	root := t.TempDir()
	managedDir, err := lspInstallDir()
	if err != nil {
		t.Fatal(err)
	}
	binDir := filepath.Join(managedDir, "node_modules", ".bin")
	if err := os.MkdirAll(binDir, 0o755); err != nil {
		t.Fatal(err)
	}
	name := "typescript-language-server"
	if runtime.GOOS == "windows" {
		name += ".cmd"
	}
	want := filepath.Join(binDir, name)
	if err := os.WriteFile(want, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}

	if got := bundledBinPath("typescript-language-server", root); got != want {
		t.Fatalf("bundledBinPath = %q, want %q", got, want)
	}
}
