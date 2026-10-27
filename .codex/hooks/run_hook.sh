#!/bin/sh
message=''
if ! node --version >/dev/null 2>&1; then
    message='Hooks inactivos: instala Node.js y agrega node al PATH; reinicia Codex después.'
fi
hook="${0%/*}/block_risky.cjs"
if [ -z "$message" ] && [ ! -f "$hook" ]; then
    message='Hooks inactivos: falta .codex/hooks/block_risky.cjs; restaura los archivos del repositorio.'
fi
if [ -n "$message" ]; then
    if [ "${1:-}" = check ]; then
        printf '{"systemMessage":"%s"}\n' "$message"
        exit 0
    fi
    printf '%s\n' "$message" >&2
    exit 2
fi
if [ "${1:-}" = check ]; then exit 0; fi
node "$hook"
status=$?
if [ "$status" -ne 0 ]; then
    if [ "$status" -ne 2 ]; then printf '%s\n' 'No se pudo ejecutar el hook; revisa Node.js y los archivos del repositorio.' >&2; fi
    exit 2
fi
