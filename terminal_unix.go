//go:build !windows

package main

import (
	"syscall"
	"time"
)

// go-pty cria a sessão já em um novo session/process group,
// então kill(-pid) atinge todos os filhos.
func killProcessTree(pid int) {
	if pid <= 0 {
		return
	}
	_ = syscall.Kill(-pid, syscall.SIGTERM)
	time.Sleep(150 * time.Millisecond)
	_ = syscall.Kill(-pid, syscall.SIGKILL)
}
