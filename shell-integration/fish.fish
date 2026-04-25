# Adila IDE — fish shell integration (OSC 133 + OSC 7)
# Source: adila-ide shell-init fish | source

if set -q ADILA_SHELL_INTEGRATION
    exit 0
end
set -gx ADILA_SHELL_INTEGRATION 1

function __adila_osc_cwd --on-variable PWD
    printf '\e]7;file://%s%s\a' (hostname) "$PWD"
end

function __adila_prompt --on-event fish_prompt
    printf '\e]133;A\a'
end

function __adila_preexec --on-event fish_preexec
    printf '\e]133;C\a'
end

function __adila_postexec --on-event fish_postexec
    printf '\e]133;D;%s\a' $status
    __adila_osc_cwd
end

__adila_osc_cwd
