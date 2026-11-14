param([switch]$Check)

$message = $null
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $message = 'Hooks inactivos: instala Node.js y agrega node al PATH; reinicia Codex al terminar.'
} else {
    & node --version >$null 2>$null
    if ($LASTEXITCODE -ne 0) {
        $message = 'Hooks inactivos: no se puede ejecutar node; repara Node.js y reinicia Codex.'
    }
}
$hook = Join-Path $PSScriptRoot 'block_risky.cjs'
if (-not $message -and -not (Test-Path -LiteralPath $hook -PathType Leaf)) {
    $message = 'Hooks inactivos: falta .codex/hooks/block_risky.cjs; restaura los archivos del repositorio.'
}
if ($message) {
    if ($Check) {
        @{ systemMessage = $message } | ConvertTo-Json -Compress
        exit 0
    }
    [Console]::Error.WriteLine($message)
    exit 2
}
if ($Check) { exit 0 }
$input | & node $hook
if ($LASTEXITCODE -ne 0) {
    if ($LASTEXITCODE -ne 2) {
        [Console]::Error.WriteLine('No se pudo ejecutar el hook; revisa Node.js y los archivos del repositorio.')
    }
    exit 2
}
exit 0
