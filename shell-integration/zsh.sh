# Adila IDE — zsh shell integration (OSC 133 + OSC 7)
# Source: eval "$(adila-ide shell-init zsh)"

[[ -n "${ADILA_SHELL_INTEGRATION:-}" ]] && return
export ADILA_SHELL_INTEGRATION=1

__adila_osc_cwd() { printf '\e]7;file://%s%s\a' "${HOST}" "${PWD}"; }
__adila_prompt_start() { print -nP '%{\e]133;A\a%}'; }
__adila_prompt_end()   { print -nP '%{\e]133;B\a%}'; }

autoload -Uz add-zsh-hook

__adila_preexec() { print -n $'\e]133;C\a'; }
__adila_precmd()  {
  local s=$?
  print -n $'\e]133;D;'"$s"$'\a'
  __adila_osc_cwd
}

add-zsh-hook preexec __adila_preexec
add-zsh-hook precmd  __adila_precmd

PS1="$(__adila_prompt_start)${PS1}$(__adila_prompt_end)"
__adila_osc_cwd
