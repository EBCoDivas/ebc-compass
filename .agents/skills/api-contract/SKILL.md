---
name: api-contract
description: Revisa el contrato entre frontend, backend y plataforma de EBC Compass. Úsala al definir o modificar rutas, solicitudes, respuestas, errores, autenticación Cognito o variables públicas, sin inventar endpoints ni implementar cambios por defecto.
---

# API Contract

Review a proposed or implemented contract between EBC Compass frontend, backend, and platform. This skill is review-only by default: do not add routes, handlers, authorizers, or frontend calls unless the user explicitly asks for implementation.

## Current contract baseline

The platform foundation currently provides only public `GET /health`. Business endpoints, JWT-protected routes, and the backend service have not yet been integrated. Cognito provides a User Pool and a public web client for future authentication.

If a required package or route is absent on the current branch, state that fact and compare the relevant integration branch only when available. Do not infer an API contract from a diagram or a planned feature.

## Review checklist

For each endpoint, confirm the actual or proposed:

- HTTP method and path.
- Request parameters, headers, and JSON body.
- Success response status and schema.
- Error status codes and error schema.
- Authentication requirement and Cognito JWT expectations.
- CORS origin and public frontend configuration requirement.
- Owning handler, backend module, and `platform/infra/api.ts` route when implementation exists.

## Contract rules

- Keep API URLs, User Pool IDs, and Cognito client IDs as public build-time values only when the frontend needs them.
- Never expose credentials, AWS secrets, or server-only environment variables to `VITE_*`.
- Do not mark a business endpoint public merely because `GET /health` is public.
- Keep the API route, Lambda handler, frontend client, and documentation synchronized when a contract changes.
- Treat assistant retrieval, document ingestion, and Bedrock interactions as backend behavior; they are not frontend contracts unless an explicit HTTP route exposes them.

## Response format

Write the result in English:

```md
## API contract review

### Confirmed
- `METHOD /path`: verified contract detail.

### Missing or ambiguous
- Contract detail that needs a decision.

### Required implementation changes
- `path/to/file`: reason.

### No change needed
- Reason.
```
