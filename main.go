package main

import (
	"context"
	"embed"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	cfg := NewConfig()
	app := NewApp(cfg)
	if initial := resolveInitialPath(os.Args); initial != "" {
		app.SetInitialPath(initial)
	}
	term := NewTerminal()
	git := NewGit(cfg)
	about := NewAbout()
	lsp := NewLSP()
	cmd := NewCommandCenter(git, cfg)
	gh := NewGitHub(cfg, git)

	err := wails.Run(&options.App{
		Title:  "Adila IDE",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 24, G: 24, B: 27, A: 1},
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			term.startup(ctx)
			git.startup(ctx)
			cfg.startup(ctx)
			about.startup(ctx)
			lsp.startup(ctx)
			cmd.startup(ctx)
			gh.startup(ctx)
		},
		OnShutdown: func(ctx context.Context) {
			term.shutdown(ctx)
			cfg.shutdown(ctx)
			lsp.shutdown(ctx)
		},
		OnBeforeClose: func(ctx context.Context) bool {
			confirm, _ := cfg.Get("window.confirmClose", false).(bool)
			if !confirm {
				return false
			}
			result, err := wruntime.MessageDialog(ctx, wruntime.MessageDialogOptions{
				Type:          wruntime.QuestionDialog,
				Title:         "Fechar Adila IDE",
				Message:       "Deseja realmente sair?",
				Buttons:       []string{"Sair", "Cancelar"},
				DefaultButton: "Cancelar",
				CancelButton:  "Cancelar",
			})
			if err != nil {
				return false
			}
			return result != "Sair"
		},
		Bind: []interface{}{
			app,
			term,
			git,
			cfg,
			about,
			lsp,
			cmd,
			gh,
			bench,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}

// resolveInitialPath pega o primeiro arg posicional não-flag, resolve para
// caminho absoluto e valida que é um diretório existente. Retorna "" se
// nada foi passado ou o caminho é inválido.
func resolveInitialPath(args []string) string {
	for _, a := range args[1:] {
		if a == "" || a[0] == '-' {
			continue
		}
		abs, err := filepath.Abs(a)
		if err != nil {
			return ""
		}
		info, err := os.Stat(abs)
		if err != nil || !info.IsDir() {
			return ""
		}
		return abs
	}
	return ""
}
