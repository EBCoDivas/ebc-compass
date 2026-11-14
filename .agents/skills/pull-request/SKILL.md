---
name: pull-request
description: Revisa o redacta un pull request de EBC Compass hacia main usando la rama actual y evidencia real de Git. Úsala para preparar, verificar o describir un PR; no lo crea ni publica sin una solicitud explícita.
---

# Pull Request

Prepare or review pull requests from the current feature branch into `main`. Use the real branch state and diff; never invent a ticket, deployment, test result, reviewer, or remote PR URL.

## Inspect first

Start with read-only checks:

```bash
git branch --show-current
git status --short
git log --oneline main..HEAD
git diff --stat main...HEAD
git diff --check main...HEAD
```

Inspect changed files when needed to determine intent, risks, or validation. If `main` is not current locally, use `origin/main` only after confirming it exists.

## Readiness rules

- The base branch is `main` unless the user explicitly selects another base.
- A PR is not ready if the branch has no commits ahead of its base, the working tree contains unintended changes, or validation evidence is missing for risky changes.
- A dirty working tree is not automatically a blocker, but distinguish committed PR content from local, uncommitted work.
- A missing remote branch or denied push permission prevents publication, not preparation of the title and body. Report the exact blocker without claiming that a PR was created.
- Do not push, create a draft, request review, merge, or modify branch protection unless the user explicitly asks.

## PR title

Use a concise English title that reflects the branch diff. Prefer the same style as the commit convention when appropriate:

```text
feat(platform): add SST infrastructure foundation
chore(skills): add repository collaboration skills
```

## PR body

Write the PR body in English and include only verified information:

```md
## Summary

- What this branch adds or changes.

## Changes

- Important implementation details by area.

## Validation

- Commands actually run and their results.

## Follow-up

- Intentional deferrals, integration work, or known prerequisites.
```

For platform changes, explicitly state whether AWS deployment, `sst dev`, resource creation, Bedrock model activation, and ingestion were intentionally not run. For frontend or backend changes, state only the checks actually performed.

## Response format

Return a compact English readiness report:

```md
PR status: Ready | Needs attention | Blocked

Base: `main`
Branch: `feature/example`

Blockers or notes:
- ...

Suggested title:
`type(scope): description`

Suggested body:
...
```
