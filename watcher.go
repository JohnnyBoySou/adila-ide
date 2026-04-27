package main

import (
	"context"
	"os"
	"sync"
	"time"
)

// fileWatcher observa um diretório e emite "fileTree.changed" com debounce de 400ms.
type fileWatcher struct {
	mu     sync.Mutex
	cancel context.CancelFunc
	timer  *time.Timer
	ctx    context.Context
}

func (w *fileWatcher) watch(appCtx context.Context, path string) {
	w.mu.Lock()
	defer w.mu.Unlock()

	// Cancela observação anterior
	if w.cancel != nil {
		w.cancel()
	}

	ctx, cancel := context.WithCancel(appCtx)
	w.cancel = cancel
	w.ctx = appCtx

	go func() {
		var lastMod time.Time
		ticker := time.NewTicker(800 * time.Millisecond)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				info, err := os.Stat(path)
				if err != nil {
					continue
				}
				mod := info.ModTime()
				if !lastMod.IsZero() && mod.After(lastMod) {
					w.emit()
				}
				lastMod = mod
			}
		}
	}()
}

func (w *fileWatcher) emit() {
	defer bench.Time("Watcher.emit")()
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.timer != nil {
		w.timer.Stop()
	}
	ctx := w.ctx
	w.timer = time.AfterFunc(400*time.Millisecond, func() {
		defer bench.Time("Watcher.fileTreeChanged")()
		if ctx != nil {
			emit("fileTree.changed")
		}
	})
}
