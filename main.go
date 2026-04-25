package main

import (
	"context"
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()
	term := NewTerminal()
	git := NewGit()
	cfg := NewConfig()
	about := NewAbout()
	lsp := NewLSP()
	cmd := NewCommandCenter(git, cfg)

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
		},
		OnShutdown: func(ctx context.Context) {
			term.shutdown(ctx)
			cfg.shutdown(ctx)
			lsp.shutdown(ctx)
		},
		Bind: []interface{}{
			app,
			term,
			git,
			cfg,
			about,
			lsp,
			cmd,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
