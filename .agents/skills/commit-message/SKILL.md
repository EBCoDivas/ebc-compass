---
name: commit-message
description: Sugiere mensajes Conventional Commit breves en inglés a partir del diff actual de EBC Compass. Úsala cuando se solicite un mensaje de commit o dividir los cambios actuales; nunca crea, modifica ni publica commits.
---

# Commit Message

Suggest a commit message only after inspecting the actual working-tree and staged changes. This skill never runs `git commit`, `git commit --amend`, or `git push`.

## Inspect first

Use the smallest relevant read-only Git checks:

```bash
git status --short
git diff --name-status
git diff --cached --name-status
```

Read the changed files when filenames alone do not explain the intent. If the user asks about branch-level work rather than the working tree, compare the branch with `main`.

## EBC Compass convention

Use concise English Conventional Commits:

```text
<type>(<scope>): <imperative description>
```

Use a scope only when it improves clarity. Typical repository scopes are `platform`, `frontend`, `backend`, `skills`, `docs`, and `repo`.

Choose the type that describes the delivered change:

- `feat`: new user-facing or platform capability.
- `fix`: bug correction.
- `docs`: documentation only.
- `test`: test-only change.
- `refactor`: behavior-preserving restructuring.
- `chore`: repository maintenance, tooling, or agent configuration.
- `build` or `ci`: build or automation configuration.

## Commit boundaries

- Suggest one message when all changes form one coherent unit.
- Suggest separate commits only for independently reviewable changes.
- Do not combine application code with generated files, credentials, local `.env` files, `.sst/`, `node_modules/`, or macOS metadata.
- Do not infer a feature from an empty diff or from untracked files that have not been inspected.

## Examples

```text
feat(platform): add SST infrastructure foundation
docs(platform): document Bedrock deployment prerequisites
chore(skills): add repository collaboration skills
feat(frontend): scaffold React application
```

## Response format

Return a short English result based only on inspected changes:

```md
Suggested commit:
`type(scope): concise description`

Includes: `path/one`, `path/two`.
```

If the changes should be split, list each suggested commit and its files. If no meaningful change is present, say so instead of inventing a message.
