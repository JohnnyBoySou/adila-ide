//go:build windows

package main

import (
	"os/exec"
	"strconv"
	"syscall"
)

// Windows não tem process groups Unix-style; taskkill /T /F caminha
// pela árvore parent→child via PID e termina cada processo.
func killProcessTree(pid int) {
	if pid <= 0 {
		return
	}
	cmd := exec.Command("taskkill", "/T", "/F", "/PID", strconv.Itoa(pid))
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	_ = cmd.Run()
}
