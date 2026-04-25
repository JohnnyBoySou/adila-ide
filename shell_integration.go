package main

import (
	_ "embed"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

//go:embed shell-integration/bash.sh
var shellIntegrationBash string

//go:embed shell-integration/zsh.sh
var shellIntegrationZsh string

//go:embed shell-integration/fish.fish
var shellIntegrationFish string

// ShellInitScript devolve o script pra inspeção/debug pelo frontend.
func (t *Terminal) ShellInitScript(shell string) (string, error) {
	script, _, err := integrationScript(shell)
	return script, err
}

// integrationScript devolve (conteúdo, nome do arquivo, erro).
func integrationScript(shell string) (string, string, error) {
	name := shellName(shell)
	switch name {
	case "bash", "sh":
		return shellIntegrationBash, "adila.sh", nil
	case "zsh":
		return shellIntegrationZsh, "adila.zsh", nil
	case "fish":
		return shellIntegrationFish, "adila.fish", nil
	default:
		return "", "", errors.New("shell não suportado: " + name)
	}
}

// configDir devolve ~/.config/adila/shell-integration, criando se necessário.
func configDir() (string, error) {
	cfg, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(cfg, "adila", "shell-integration")
	return dir, os.MkdirAll(dir, 0o755)
}

// writeIntegrationScript escreve o script no disco e devolve o caminho.
func writeIntegrationScript(shell string) (string, error) {
	script, fname, err := integrationScript(shell)
	if err != nil {
		return "", err
	}
	dir, err := configDir()
	if err != nil {
		return "", err
	}
	path := filepath.Join(dir, fname)
	return path, os.WriteFile(path, []byte(script), 0o644)
}

// injectIntegration modifica args e env do Cmd pra carregar a shell
// integration automaticamente, sem alterar os dotfiles do usuário.
//
// bash  → --rcfile wrapper que faz source ~/.bashrc && source adila.sh
// zsh   → ZDOTDIR apontando pra dir com .zshrc que faz source
// fish  → argumento -C "source adila.fish" antes do prompt
// outros → noop, sem erro
func injectIntegration(shell string, existingArgs []string, existingEnv []string) (args []string, env []string, err error) {
	args = existingArgs
	env = existingEnv

	scriptPath, werr := writeIntegrationScript(shell)
	if werr != nil {
		// falha silenciosa — terminal ainda funciona, só sem integração
		return args, env, nil
	}

	name := shellName(shell)
	switch name {
	case "bash", "sh":
		// wrapper rcfile: carrega ~/.bashrc do usuário e depois nosso script
		dir := filepath.Dir(scriptPath)
		rcWrapper := filepath.Join(dir, "bash-rc-wrapper.sh")
		home, _ := os.UserHomeDir()
		wrapContent := fmt.Sprintf(
			"[ -f %q ] && source %q\nsource %q\n",
			filepath.Join(home, ".bashrc"),
			filepath.Join(home, ".bashrc"),
			scriptPath,
		)
		if werr2 := os.WriteFile(rcWrapper, []byte(wrapContent), 0o644); werr2 == nil {
			args = append([]string{"--rcfile", rcWrapper}, args...)
		}

	case "zsh":
		// cria ZDOTDIR com .zshrc que faz source do .zshrc real + nosso script
		dir := filepath.Dir(scriptPath)
		zdotdir := filepath.Join(dir, "zsh-zdotdir")
		if werr2 := os.MkdirAll(zdotdir, 0o755); werr2 == nil {
			home, _ := os.UserHomeDir()
			zshrc := fmt.Sprintf(
				"ZDOTDIR=%q\n[ -f %q ] && source %q\nsource %q\n",
				home,
				filepath.Join(home, ".zshrc"),
				filepath.Join(home, ".zshrc"),
				scriptPath,
			)
			zshrcPath := filepath.Join(zdotdir, ".zshrc")
			if werr3 := os.WriteFile(zshrcPath, []byte(zshrc), 0o644); werr3 == nil {
				env = append(env, "ZDOTDIR="+zdotdir)
			}
		}

	case "fish":
		// fish aceita -C para rodar um comando antes do prompt interativo
		args = append([]string{"-C", "source " + scriptPath}, args...)
	}

	return args, env, nil
}

func shellName(shell string) string {
	name := strings.ToLower(filepath.Base(shell))
	return strings.TrimSuffix(name, ".exe")
}
