# Flujo de colaboración

## Reglas

- `main` es la versión estable. Desarrolla en `feature/<nombre-de-tarea>`, con una actividad por rama.
- Mantén commits pequeños y enfocados, con mensajes Conventional Commit en inglés; por ejemplo, `feat(assistant): add explicit memory`.
- No incluyas secretos, archivos `.env` ni artefactos generados.
- Mantén el historial nuevo lineal: actualiza features con **rebase** e integra con **fast-forward**. No hagas merge de `main` dentro de una feature ni crees commits de merge al integrar PRs.
- No reescribas el historial publicado de `main`. Estas reglas no requieren modificar los merges anteriores.

## Crear una feature

Con el árbol de trabajo limpio:

```sh
git fetch origin
git switch -c feature/nombre-de-tarea origin/main
```

Trabaja y crea los commits en esa rama. Evita comenzar una nueva actividad desde una feature ya integrada.

## Antes de abrir o actualizar un PR

Guarda tus cambios en commits y actualiza la base:

```sh
git fetch origin
git rebase origin/main
```

Si hay conflictos, resuélvelos, agrega los archivos resueltos y ejecuta `git rebase --continue`. Para cancelar el rebase usa `git rebase --abort`. Revisa el diff final y ejecuta las pruebas, typecheck y lint pertinentes, además de:

```sh
git diff --check origin/main...HEAD
git log --oneline origin/main..HEAD
```

Publica por primera vez con:

```sh
git push -u origin feature/nombre-de-tarea
```

Si el rebase cambió commits ya publicados, revisa primero la rama remota y coordínate con quienes trabajen en ella. Publica con `git push --force-with-lease origin feature/nombre-de-tarea`, nunca con `--force`. Si el lease falla, revisa los cambios remotos; no fuerces el push. No hagas rebase de una rama compartida sin coordinación.

Abre el PR hacia `main`, completa la descripción, incluye evidencia y señala los pendientes. Atiende las revisiones y cumple las aprobaciones y verificaciones exigidas por el repositorio. La validación corresponde al contenido final después de resolver conflictos.

## Integrar con fast-forward

Justo antes de integrar, comprueba que la feature contiene el último `origin/main`. Si `main` avanzó, repite el rebase, las comprobaciones afectadas y la revisión del PR actualizado.

Para un PR revisado, una persona con permiso de integración puede avanzar `main` sin crear commits nuevos. Este es el único uso de `main` en este flujo; no se desarrolla allí:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
git merge --ff-only origin/feature/nombre-de-tarea
git push origin main
```

Integra exactamente la revisión publicada y revisada del PR. Si el merge o el push se rechazan por divergencia, vuelve a la feature y actualízala; no crees un merge de respaldo ni fuerces `main`. Si las protecciones requieren integrar mediante GitHub, respétalas.

## Integración desde GitHub

Usa **Rebase and merge** o `gh pr merge --rebase` cuando la integración deba realizarse en GitHub. Mantiene una secuencia lineal y conserva los cambios como commits separados, pero GitHub reescribe sus identificadores: no equivale al fast-forward exacto de Git.

No uses **Create a merge commit**, `gh pr merge --merge` ni **Squash and merge** como flujo habitual. Después de integrar, crea la siguiente feature desde el nuevo `origin/main`; elimina la rama anterior cuando ya no se necesite. Comprueba que el PR quedó marcado como integrado.

Referencias: [fast-forward en Git](https://git-scm.com/docs/git-merge#_fast_forward_merge) y [métodos de integración en GitHub](https://docs.github.com/en/pull-requests/reference/pull-request-merges).
