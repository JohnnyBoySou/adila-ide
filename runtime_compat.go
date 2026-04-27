package main

import (
	"fmt"

	"github.com/pkg/browser"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// runtime_compat.go centraliza o adaptador entre as chamadas de runtime
// herdadas (estilo Wails v2) e a API da v3. Cada serviço continua chamando
// emit/logInfof/openBrowser, e este arquivo é o único ponto que conhece
// o pacote application da v3.

// emit dispara um evento custom para o frontend com payload variádico.
// Equivale ao runtime.EventsEmit do antigo Wails v2.
func emit(name string, data ...any) {
	app := application.Get()
	if app == nil {
		return
	}
	app.Event.Emit(name, data...)
}

// onEvent registra um listener mantendo a assinatura legada (args ...any).
// O CustomEvent.Data carrega o payload emitido pelo lado JS ou Go;
// se for slice, é repassado por spread, caso contrário vai como argumento único.
func onEvent(name string, fn func(args ...any)) func() {
	app := application.Get()
	if app == nil {
		return func() {}
	}
	return app.Event.On(name, func(e *application.CustomEvent) {
		switch v := e.Data.(type) {
		case nil:
			fn()
		case []any:
			fn(v...)
		default:
			fn(v)
		}
	})
}

func logInfof(format string, args ...any) {
	if app := application.Get(); app != nil {
		app.Logger.Info(fmt.Sprintf(format, args...))
	}
}

func logErrorf(format string, args ...any) {
	if app := application.Get(); app != nil {
		app.Logger.Error(fmt.Sprintf(format, args...))
	}
}

func logDebugf(format string, args ...any) {
	if app := application.Get(); app != nil {
		app.Logger.Debug(fmt.Sprintf(format, args...))
	}
}

// openBrowser abre uma URL no navegador padrão do sistema.
// Usa github.com/pkg/browser pois o app.Browser.OpenURL do Wails v3 falha
// silenciosamente em alguns ambientes Linux (ex.: WebKitGTK).
func openBrowser(url string) {
	if err := browser.OpenURL(url); err != nil {
		logErrorf("openBrowser: %v", err)
	}
}

// reloadCurrentWindow força reload da WebView ativa. Usado pelo command
// center para o atalho "Recarregar janela".
func reloadCurrentWindow() {
	app := application.Get()
	if app == nil {
		return
	}
	if w := app.Window.Current(); w != nil {
		if r, ok := w.(interface{ Reload() }); ok {
			r.Reload()
		}
	}
}

// pickDirectory abre o diálogo nativo de seleção de diretório e devolve
// o caminho escolhido (string vazia se o usuário cancelar).
func pickDirectory(title string) (string, error) {
	app := application.Get()
	if app == nil {
		return "", fmt.Errorf("application not ready")
	}
	return app.Dialog.OpenFile().
		CanChooseDirectories(true).
		CanChooseFiles(false).
		SetTitle(title).
		PromptForSingleSelection()
}
