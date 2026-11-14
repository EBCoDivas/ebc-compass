---
name: environment-readiness
description: Verifica que el entorno local de EBC Compass esté listo y sea seguro para desarrollar. Úsala para revisar versiones, scripts, configuración de entorno y archivos ignorados, sin instalar dependencias ni exponer secretos por defecto.
---

# Environment Readiness

Review whether the checked-out EBC Compass workspace is ready for local development. This is a diagnostic skill by default: do not install dependencies, change shell profiles, create credentials, or modify `.env` files unless the user explicitly asks.

## Review boundaries

- Inspect the packages that are present on the current branch. Do not assume that `frontend/`, `backend/`, or `platform/` has already been merged.
- Check the package manager and Node version declared by each package before recommending commands.
- Verify that sample configuration is safe to commit and that real configuration remains ignored.
- Never print secret values, tokens, SSH keys, AWS profiles, or `.env` contents.

## Checks

1. Inspect repository status and the files that define local setup: package manifests, version files, `.gitignore`, and `.env.example` files when present.
2. Compare declared Node and package-manager requirements with the installed versions when the user requests a live readiness check.
3. Identify required environment-variable names without reading or showing their values.
4. Confirm which package scripts can be run locally and which prerequisites they need.
5. Separate missing prerequisites from optional tooling.

## Platform-specific boundary

`platform/` targets Node.js 22 and SST v3. A future AWS deployment requires AWS credentials, `us-east-1`, Bedrock model access, and the provider installation documented in `platform/README.md`. Do not run `sst dev` or `sst deploy` during a readiness review.

## Response format

Write the result in English:

~~~md
## Environment status

### Ready
- Verified item.

### Required before development
- Missing prerequisite and the package it affects.

### Optional
- Non-blocking tool or configuration.

### Safe next command
```bash
command actually supported by the checked-out package
```
~~~
