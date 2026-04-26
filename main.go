package main

import (
	"context"
	"embed"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var embeddedAppIcon []byte

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
	sp := NewSpotify(cfg)
	linear := NewLinear(cfg)
	tasks := NewTasks(term)
	wcfg := NewWorkspaceConfig()
	cfg.AttachWorkspace(wcfg)

	err := wails.Run(&options.App{
		Title:     "Adila IDE",
		Width:     1280,
		Height:    800,
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 24, G: 24, B: 27, A: 0},
		Linux: &linux.Options{
			Icon:                embeddedAppIcon,
			ProgramName:         "adila",
			WindowIsTranslucent: true,
		},
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			term.startup(ctx)
			git.startup(ctx)
			cfg.startup(ctx)
			about.startup(ctx)
			lsp.startup(ctx)
			cmd.startup(ctx)
			gh.startup(ctx)
			sp.startup(ctx)
			linear.startup(ctx)
			tasks.startup(ctx)
			wcfg.startup(ctx)
		},
		OnShutdown: func(ctx context.Context) {
			term.shutdown(ctx)
			cfg.shutdown(ctx)
			lsp.shutdown(ctx)
			wcfg.shutdown(ctx)
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
			// MessageDialog no Linux/GTK pode devolver o label com whitespace,
			// case diferente ou prefixo de mnemonic ("_Sair"). Comparamos só
			// pelo botão de cancelar — qualquer outra coisa libera o close.
			normalized := strings.ToLower(strings.TrimSpace(strings.ReplaceAll(result, "_", "")))
			return normalized == "cancelar"
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
			sp,
			linear,
			tasks,
			wcfg,
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
