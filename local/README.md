# Entorno local de EBC Compass

Demo local del asistente: **AWS Emulator** (DynamoDB, S3…) + un **puente** que responde las llamadas de Bedrock con la API de OpenAI. Es independiente de `platform/` (SST); los nombres de recursos y variables son los mismos que en el lab de AWS, así que el backend no cambia entre local y lab.

> Los comandos se ejecutan desde la **raíz del repo**. Plan completo: [docs/plans/plan-asistente-integracion.md](../docs/plans/plan-asistente-integracion.md). Hallazgos del emulador: [docs/local-emulator-findings.md](../docs/local-emulator-findings.md).

## Requisitos

- macOS con Node 22, npm y **Docker Desktop encendido**.
- Una clave de la API de OpenAI (solo para el modo con LLM).

## Primer arranque

```sh
npm run env:create   # crea backend/.env, frontend/.env y local/.env desde sus .env.example
# Abre local/.env y completa OPENAI_API_KEY (tú la colocas; git la ignora)
npm run setup        # instala dependencias, levanta el emulador y aprovisiona recursos
npm run dev          # emulador + puente + backend + frontend
```

Sin clave de OpenAI: `npm run dev:rules` (el asistente responde solo con reglas y plantillas).

## Comandos principales (raíz)

| Comando | Qué hace |
|---|---|
| `npm run env:create` | Crea los `.env` que falten (nunca sobrescribe) y lista qué debes llenar |
| `npm run setup` | Verifica prerrequisitos, instala dependencias (`--skip-platform` omite SST), levanta el emulador y aprovisiona |
| `npm run dev` / `dev:rules` | Levanta todo, con o sin LLM. Ctrl+C detiene backend, frontend y puente |
| `npm run stop` | Detiene el emulador (**borra sus datos: viven en memoria**) |
| `npm run doctor` | Diagnóstico ✔/✖ con la acción correctiva |
| `npm run provision` | Crea la tabla `ConversationCheckpoints` y el bucket en el emulador (idempotente) |
| `npm run emulator:up` / `emulator:down` | Controla solo el emulador |
| `npm run bridge` | Levanta solo el puente |
| `npm run kb:upload` / `kb:status` / `kb:verify` | Carga el corpus de `knowledge/` al Vector Store de OpenAI (idempotente), muestra su estado y comprueba la recuperación (5 preguntas ES + 5 EN) |
| `npm run kb:query -- "texto" [--lang es]` | Consulta de prueba: pasajes recuperados con puntaje |
| `npm run kb:export` / `kb:sync-s3` | Genera archivos + `.metadata.json` para S3/Bedrock KB y los sube al bucket del emulador |
| `npm run kb:reset` | Borra el Vector Store y sus archivos de OpenAI |
| `npm run verify:checkpointer` | Verifica el checkpointer de DynamoDB contra el emulador (12 comprobaciones) |
| `npm run verify:lambda` | Verifica el handler de Lambda con eventos de API Gateway (sin nube) |
| `npm run lab:*` | Despliegue al lab de AWS (ver [docs/deploy-lab.md](../docs/deploy-lab.md)) |
| `npm run verify:rules` / `verify:llm` | Revisión del asistente sin LLM (5 ES + 5 EN) y con LLM (2 ES + 2 EN; consume API) |
| `npm run spike` | Matriz de servicios del emulador (Fase 0) |
| `npm run typecheck` / `lint` / `build` | Comprueban backend, frontend y local |
| `npm run backend:*`, `frontend:*`, `platform:*`, `local:*` | Delegan al script del mismo nombre del paquete |
| `npm run sst:dev` / `sst:deploy` / `sst:remove` | **Reservados** a actividades con autorización de infraestructura; exigen `-- --confirm` |

Cada paquete conserva sus propios scripts en su directorio (`backend/`, `frontend/`, `platform/`, `local/`).

## Cómo funciona

```
Backend ─ AWS_ENDPOINT_URL ──────────────────────► AWS Emulator (Docker, https://127.0.0.1:9297)
        ─ AWS_ENDPOINT_URL_BEDROCK_RUNTIME ──┐
        ─ AWS_ENDPOINT_URL_BEDROCK_AGENT_RUNTIME ─► bedrock-bridge (http://127.0.0.1:8787) ─► API de OpenAI
```

- El emulador genera **credenciales y certificado nuevos en cada arranque** en `~/.aws/emulator/9297/`. `npm run dev` y `npm run provision` los inyectan; los `.env` no llevan credenciales.
- **Todo vive en memoria** y se borra al detener el emulador. `dev` y `setup` re-aprovisionan en cada arranque.
- El puente implementa `Converse` (modelo de chat) y `Retrieve` (base de conocimiento) con la forma de la API de Bedrock. No registra el contenido de los mensajes ni la clave.
- Solo escuchan en `127.0.0.1`.

## Problemas frecuentes

| Síntoma | Solución |
|---|---|
| `Docker no responde` | Abre Docker Desktop y espera a que arranque |
| `OPENAI_API_KEY vacía` | Edita `local/.env`, o usa `npm run dev:rules` |
| `El emulador no está en marcha` | `npm run emulator:up` |
| Perdí las conversaciones | Se reinició el emulador (datos en memoria); es esperado |
| Puerto 3000/5173 ocupado | Cierra el proceso que lo usa (`lsof -i :3000`) y vuelve a ejecutar |
