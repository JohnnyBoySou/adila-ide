//go:build windows

package main

import "os/exec"

func setLSPSysProcAttr(cmd *exec.Cmd) {}
