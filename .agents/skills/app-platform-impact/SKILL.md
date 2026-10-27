---
name: app-platform-impact
description: Revisa cómo un cambio propuesto en EBC Compass afecta la plataforma SST. Úsala cuando un cambio en frontend/ o backend/ pueda requerir infraestructura, autenticación, API, almacenamiento documental, Bedrock Knowledge Base, almacenamiento vectorial o configuración de ejecución.
---

# App to Platform Impact

Assess infrastructure impact before changing `platform/`. This is a review skill by default: do not modify infrastructure, deploy, run `sst dev`, or run `sst deploy` unless the user explicitly asks.

## Repository boundaries

- `frontend/`: Vite React application.
- `backend/`: future application API and business logic.
- `platform/`: SST v3 infrastructure.
- `main`: integration base branch.
- `feature/infrastructure-sst`: source branch for the initial platform foundation until it is merged into `main`.

If `platform/` is absent from the checked-out branch, inspect the platform branch before making a conclusion. Do not assume an infrastructure resource exists just because it is described in a ticket or diagram.

## Current platform foundation

The initial platform declares:

- Cognito email sign-up/sign-in and a public web client.
- An API Gateway HTTP API with public `GET /health` only.
- Lambda and API CloudWatch logs with one-week retention.
- A private, encrypted, HTTPS-only academic-documents bucket.
- An S3 Vectors bucket and cosine index using `float32` vectors with 1,024 dimensions.
- A Bedrock Knowledge Base using Titan Text Embeddings V2, its S3 data source, and a least-privilege Bedrock role.

It deliberately does not yet declare business API routes, JWT-protected routes, a React `StaticSite`, CloudFront, document ingestion, or RAG handlers.

## Review process

1. Inspect the requested application change and the actual diff.
2. Inspect the relevant platform modules, or compare `feature/infrastructure-sst` if `platform/` is not present locally.
3. Identify required, optional, and non-required platform changes separately.
4. State the exact files and resources affected, plus the reason.
5. Propose the smallest next change. Do not implement it unless asked.

## Impact checklist

### API and backend

- A new HTTP route or method requires a handler and a route in `platform/infra/api.ts`.
- Business routes must use the Cognito JWT authorizer when authentication is required; `GET /health` is intentionally public.
- A new Lambda dependency, timeout, memory requirement, environment variable, or permission must be declared with the function that needs it.
- New AWS services, events, or storage require explicit resources and least-privilege permissions. Do not grant wildcard access by default.

### Frontend and authentication

- A frontend API call needs a stable API URL and the appropriate CORS origin.
- The eventual `StaticSite` integration must inject only `VITE_API_URL`, `VITE_COGNITO_USER_POOL_ID`, and `VITE_COGNITO_CLIENT_ID` unless the design explicitly requires more.
- When a deployed frontend domain replaces local development, update CORS deliberately; do not leave broad origins enabled.
- Do not expose credentials or server-only configuration through `VITE_*` variables.

### Documents, retrieval, and AI

- New academic-document formats or ingestion behavior may affect `platform/infra/knowledge-base.ts`, the documents bucket, and the Bedrock data source.
- Retrieval or assistant behavior belongs in the backend. It does not exist merely because the Knowledge Base is declared.
- Changes to the vector schema require deliberate compatibility review: embedding model, dimension, data type, metric, index, and Knowledge Base configuration must remain compatible.
- Do not upload source documents, trigger ingestion, or activate additional Bedrock models during a static review.

### Outputs and configuration

- Add a platform output only when a deployment-time consumer needs a non-sensitive identifier or URL.
- Keep secrets out of Git, outputs, frontend variables, and logs.
- Keep Node and package-manager changes scoped to the package that needs them.

## Local validation

For a platform change, recommend only local checks that match the affected package, normally:

```bash
npm run install:providers
npm run typecheck
npm test
```

Run no AWS-changing command unless explicitly requested and credentials, region, and Bedrock model access have been confirmed.

## Response format

Write the assessment in English:

```md
## Platform impact

### Required
- `path/to/file`: reason.

### Optional or later
- Item: reason it can wait.

### No platform change needed
- Item: reason.

### Validation
- Command or manual check.
```
