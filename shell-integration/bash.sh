# Adila IDE — bash shell integration (OSC 133 + OSC 7)
# Source: eval "$(adila-ide shell-init bash)"

if [[ -n "${ADILA_SHELL_INTEGRATION:-}" ]]; then return; fi
export ADILA_SHELL_INTEGRATION=1

__adila_status=0

__adila_osc_cwd() {
  printf '\e]7;file://%s%s\a' "${HOSTNAME}" "$(pwd)"
}

__adila_prompt_start() { printf '\e]133;A\a'; }
__adila_prompt_end()   { printf '\e]133;B\a'; }
__adila_cmd_start()    { printf '\e]133;C\a'; }
__adila_cmd_end()      { printf '\e]133;D;%s\a' "$1"; }

__adila_preexec() {
  __adila_cmd_start
}

__adila_precmd() {
  __adila_status=$?
  __adila_cmd_end "$__adila_status"
  __adila_osc_cwd
}

# instala traps de pre-exec/pre-cmd
trap '__adila_preexec' DEBUG

if [[ -z "${PROMPT_COMMAND:-}" ]]; then
  PROMPT_COMMAND='__adila_precmd'
elif [[ "$PROMPT_COMMAND" != *"__adila_precmd"* ]]; then
  PROMPT_COMMAND="__adila_precmd; $PROMPT_COMMAND"
fi

PS1="\[$(__adila_prompt_start)\]${PS1}\[$(__adila_prompt_end)\]"
__adila_osc_cwd
