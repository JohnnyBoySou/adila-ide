//go:build !windows

package main

import (
	"os/exec"
	"syscall"
)

func setLSPSysProcAttr(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
}
