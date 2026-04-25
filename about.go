package main

import (
	"context"
	"runtime"

	"github.com/pkg/browser"
)

// version é injetada em build time via: -ldflags "-X main.version=0.1.0"
var version = "0.1.0"

// ProductInfo descreve o produto para a AboutView.
type ProductInfo struct {
	Name       string `json:"name"`
	Version    string `json:"version"`
	GoVersion  string `json:"goVersion"`
	OS         string `json:"os"`
	Arch       string `json:"arch"`
	Repo       string `json:"repo"`
	IssuesUrl  string `json:"issuesUrl"`
	LicenseUrl string `json:"licenseUrl"`
}

type About struct {
	ctx context.Context
}

func NewAbout() *About {
	return &About{}
}

func (a *About) startup(ctx context.Context) {
	a.ctx = ctx
}

// GetProductInfo retorna metadados do app.
func (a *About) GetProductInfo() ProductInfo {
	return ProductInfo{
		Name:       "Adila IDE",
		Version:    version,
		GoVersion:  runtime.Version(),
		OS:         runtime.GOOS,
		Arch:       runtime.GOARCH,
		Repo:       "https://github.com/300f-co/adila",
		IssuesUrl:  "https://github.com/300f-co/adila/issues",
		LicenseUrl: "https://github.com/300f-co/adila/blob/main/LICENSE",
	}
}

// OpenUrl abre uma URL no navegador padrão do sistema.
func (a *About) OpenUrl(url string) error {
	return browser.OpenURL(url)
}
