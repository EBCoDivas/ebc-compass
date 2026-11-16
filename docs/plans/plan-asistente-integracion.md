# Plan de implementación: asistente conversacional e integración (demo local)

- **Rama:** `feature/agents-core`
- **Estado:** v3, con LangGraph, modelo `luna`, `.env` a cargo del usuario y decisiones de la ronda anterior cerradas (ver sección 16)
- **Fecha:** 2026-11-16
- **Actividad asignada:** *Asistente e integración: crear el asistente conversacional simulado, integrar las funcionalidades, probar el flujo completo.*

### Cambios respecto a la v2

| Tema | v2 | v3 |
|---|---|---|
| Orquestación del asistente | Servicio propio (`AssistantService`) | **LangGraph.js**: un grafo determinista con nodos finos sobre funciones puras |
| Persistencia | Tabla a medida con GSI y versión optimista | **`DynamoDBSaver` portado a TypeScript** desde el de AWS (LangGraph persiste el estado en checkpoints) |
| Modelo del chat | Por confirmar | **`gpt-6-luna`** con `reasoning_effort=high` (nombre tomado de `.codex/config.toml`; configurable) |
| Clave de OpenAI | `setup` la pedía | **La pones tú** en `local/.env`; el repo solo trae `.env.example` y el comando **`npm run env:create`** |
| Pruebas | Vitest + Playwright opcional | **Sin pruebas automatizadas** (ni unitarias ni de componentes, ni Vitest ni Playwright); la verificación es con scripts (`doctor`, `kb:verify`, `verify:flow`) y revisión manual |
| Plataforma del equipo | macOS y Windows | **Solo macOS** |
| Coordinación con otras ramas | Acordar interfaces y tipos | **Sin coordinación**: el asistente define sus propios tipos y adaptadores |
| Ubicación del plan | `docs/` | **`docs/plans/`** |
| Esfuerzo | ~54–68 h | **~66–82 h** |

---

## 1. Objetivo y alcance

Entregar una **demo local** del flujo completo de EBC Compass con un asistente conversacional real:

- **AWS se emula en local** con AWS Emulator (región `us-east-1`).
- **El asistente es un grafo de LangGraph.js** que corre en el backend Express. Persiste su estado en **DynamoDB** (emulado) mediante un checkpointer propio.
- **El backend habla solo "AWS"**: usa Bedrock Runtime (Converse) para el LLM y Bedrock Agent Runtime (Retrieve) para el conocimiento. En local, un **puente** (`bedrock-bridge`) responde esas llamadas con la **API de OpenAI** (modelo `gpt-6-luna` y Vector Store). En el lab/prod se quitan los overrides de endpoint y las mismas llamadas van a **Bedrock + Knowledge Base sobre S3 Vectors**.
- **El entorno local queda separado de SST** (`platform/`) y **todos los comandos están centralizados** en un `package.json` raíz, además de los scripts propios de cada paquete.

**Requisitos que cubre**

| Fuente | Cobertura |
|---|---|
| `requirements.md` RF-05.1 a RF-05.14 | Asistente bilingüe, contexto, explicaciones, fallbacks |
| `requirements.md` NF-03.5 | Borrar la conversación del estudiante |
| `requirements.md` RF-02 / RF-06 | Integración: recomendaciones y catálogo accesibles desde el chat |
| `tasks.md` 8.1 a 8.11 | Detector de idioma, matcher, contexto, handlers, orquestador y UI |
| `tasks.md` 10.4, 11.5 | Verificación del flujo completo (por script y manual) y de RF-05 |

**Fuera de alcance:** motor de recomendaciones, ampliación de datos mock, calendario/alertas y validaciones de perfil (otras actividades). El asistente no espera a que existan: define sus propios tipos y proveedores provisionales (sección 5.5).

**Restricciones del repo (AGENTS.md):** demo con datos mock, sin integraciones institucionales, sin información sensible real, cambios pequeños y enfocados, TypeScript, UI en español, sin secretos en el repo, PRs hacia `main`. LangGraph es una dependencia que sí pediste explícitamente.

---

## 2. Contraste: lo que necesitamos vs lo que tenemos

| Pieza | Necesitamos (diseño / diagrama MVP) | Hoy en `main` | Brecha |
|---|---|---|---|
| Asistente (RF-05) | Idioma, intents, contexto, fallback | Nada | Todo |
| Orquestación | Grafo de LangGraph | Nada | Todo |
| Página de chat | `/asistente` con historial, entrada, sugerencias | Rutas `/`, `/catalogo`, `/perfil` | Todo |
| API del asistente | Mensajes y conversaciones | Solo `/api/health`, `/api/profiles`, `/api/opportunities` | Todo |
| Persistencia de conversación | DynamoDB `ConversationCheckpoints` | Perfiles en memoria; perfil del frontend en localStorage | Todo (incluido el checkpointer en TypeScript) |
| LLM | Bedrock | Nada | Todo |
| Base de conocimiento | Bedrock KB + S3 Vectors (definidos en `platform/infra/knowledge-base.ts`) | Infra definida, **sin documentos ni ingesta** | Corpus, scripts de carga, retriever |
| Entorno local | Emulador de AWS | Sin Docker Compose ni scripts; `platform/` solo despliega a AWS real | Todo |
| Comandos y `.env` | Un punto de entrada | Cada paquete con sus scripts; **sin `package.json` raíz**; `.env.example` solo en la raíz y en `backend/` (solo `PORT`) | Raíz, `local/`, `.env.example` |
| Datos | 20+ oportunidades en 6 tipos | 9 en 4 tipos | Otra actividad; el asistente tolera ambos |
| Pruebas | Vitest | Backend y frontend sin pruebas | **No se agregan pruebas automatizadas** (decisión del equipo); se verifica con scripts y manualmente |

**Hechos del entorno de esta máquina (verificados):** Node 22.23, npm 11, AWS CLI 2.31, Docker 28.5 instalado pero con el **daemon apagado**, Mac arm64 con 32 GB.

**Hecho de integración:** el frontend guarda el perfil en `localStorage` y el backend no lo conoce; por eso el asistente recibe un *resumen del perfil* en cada petición (sección 6).

---

## 3. Decisiones de arquitectura

### D1. Entorno local separado de SST

SST v3 despliega con Pulumi contra AWS real y no sabemos si funciona contra el emulador. **`local/` es un paquete independiente** (Docker, puente, aprovisionamiento por SDK, carga del conocimiento). Los nombres de recursos y variables son los mismos que en el lab, así que el código del backend no cambia entre local y lab: solo desaparecen los *endpoints* sobrescritos. SST sigue siendo el camino de despliegue al lab (sección 15).

### D2. AWS Emulator en `us-east-1`

- Un emulador para `us-east-1` (misma región que `platform/sst.config.ts`), por endpoint: `AWS_ENDPOINT_URL` para todos los servicios y variables por servicio (`AWS_ENDPOINT_URL_BEDROCK_RUNTIME`, `AWS_ENDPOINT_URL_BEDROCK_AGENT_RUNTIME`) para los que atiende el puente.
- **Comprobado en la Fase 0:** el emulador sirve por **HTTPS en `127.0.0.1:9297`** con certificado propio y **genera credenciales nuevas en cada arranque** (`~/.aws/emulator/9297/`). Los comandos npm inyectan `AWS_SHARED_CREDENTIALS_FILE`, `AWS_CONFIG_FILE`, `AWS_CA_BUNDLE` y `NODE_EXTRA_CA_CERTS` con rutas absolutas; los `.env` no llevan credenciales. **Todo vive en memoria**: `provision` y `kb:sync-s3` corren en cada arranque y las conversaciones no sobreviven a reiniciar el emulador.
- **Riesgo:** AWS declara verificar fidelidad solo en `us-west-2` y varía por servicio. La **Fase 0 (spike)** prueba cada servicio y deja la evidencia en `docs/local-emulator-findings.md`. No se asume nada que no esté en esa matriz.
- Puerto, forma de ejecución en Mac (contenedor) y servicios soportados: **por confirmar con la guía oficial** (el proxy bloquea `docs.aws.amazon.com`; hace falta pegar la guía/PDF o leerla localmente).

### D3. Bedrock vía puente hacia OpenAI (`gpt-6-luna`, esfuerzo `high`)

El backend usa **solo** Bedrock Runtime (Converse). Dos caminos, según el spike:

1. Si el Bedrock del emulador es utilizable y configurable hacia OpenAI → se usa directo.
2. Si no (lo más probable) → **`local/bedrock-bridge`**, un servidor HTTP en `127.0.0.1` que implementa `POST /model/{modelId}/converse` y traduce a la API de OpenAI con `OPENAI_API_KEY`. El backend apunta con `AWS_ENDPOINT_URL_BEDROCK_RUNTIME=http://127.0.0.1:8787`.

Detalles:
- `BEDROCK_MODEL_ID` es un identificador lógico (`local-chat`); el puente lo mapea a `OPENAI_MODEL=gpt-6-luna` y envía `OPENAI_REASONING_EFFORT=high`. **El nombre exacto del modelo y el parámetro de razonamiento se confirman contra la API en la Fase 1** (el nombre sale de `.codex/config.toml`, no de la documentación de OpenAI). En el lab, `BEDROCK_MODEL_ID` pasa a ser el modelo real de Bedrock.
- **Latencia:** con esfuerzo `high` una respuesta puede tardar decenas de segundos. Por eso el tiempo límite del LLM es de 45 s, la UI muestra "escribiendo…" y `OPENAI_REASONING_EFFORT` es configurable (`medium`/`low`) si la demo se siente lenta.
- Errores traducidos al formato de Bedrock (`ValidationException`, `ThrottlingException`, `ModelTimeoutException`) para que el manejo de errores sea el mismo.
- Alcance MVP: `Converse` **sin streaming** (`ConverseStream` usa event-stream binario). Sin tool use: los datos los resuelven las reglas.
- **La clave de OpenAI vive solo en `local/.env`** (la lee el puente). El backend nunca la ve. La colocas tú; ver `npm run env:create` (sección 10).

### D4. Asistente híbrido, orquestado con LangGraph

RF-05.11 pide *lógica basada en reglas, sin ML* y AGENTS.md dice *asistente simulado*. Para tener un LLM real sin perder control:

- **Reglas (funciones puras):** idioma, intent, entidades, elegibilidad y datos (prerrequisitos, fechas, requisitos). Deterministas y probadas.
- **LLM:** solo redacta, a partir de una *hoja de hechos* (`FactSheet`) y pasajes recuperados; no puede introducir datos nuevos (guardrail, 8.5).
- **LangGraph** conecta esos pasos como un **grafo determinista** (no un agente que decide qué herramienta llamar) y le da **memoria persistente** por conversación. Esto mantiene el comportamiento predecible y verificable.
- **Modo `rules`** (sin LLM): plantillas deterministas; fallback automático si el LLM falla o tarda, y modo con el que se verifica RF-05.12 (< 2 s).
- `ASSISTANT_MODE=llm|rules`.

Esto contradice la letra de RF-05.11/05.12 y queda registrado como decisión aprobada (V1).

### D5. Conocimiento: Vector Store de OpenAI hoy, S3 Vectors en prod

El backend consulta el conocimiento con **`Retrieve` de Bedrock Agent Runtime**, tanto en local como en prod. Solo cambia quién responde:

| Entorno | Quién responde `Retrieve` | Dónde están los vectores |
|---|---|---|
| Local (demo) | `bedrock-bridge` (`POST /knowledgebases/{id}/retrieve`) | Vector Store de OpenAI (búsqueda semántica con atributos) |
| Lab / prod | Bedrock Knowledge Base real (ya definida en SST) | S3 Vectors |

- **El backend no contiene código de OpenAI.** Al pasar a prod solo se quitan los overrides de endpoint.
- El puente traduce `retrievalQuery` + `filter` (p. ej. `equals` sobre `language`) a la búsqueda del Vector Store y devuelve `retrievalResults[]` con texto, ubicación (nombre del archivo), puntaje y metadatos. *(El contrato exacto se confirma contra el SDK en la Fase 1.)*
- **Fallback:** `KeywordRetriever` (coincidencia por tokens sobre los mismos archivos) si no hay internet o clave.
- Si el spike muestra que `s3vectors` del emulador funciona de verdad, se puede ensayar el camino S3 completo en local; no es requisito.

**Un solo corpus alimenta ambos destinos** (sección 9): los mismos Markdown con el mismo metadato, cargados por script al Vector Store hoy y exportados con `.metadata.json` para S3/Bedrock KB mañana.

### D6. Persistencia: LangGraph + `DynamoDBSaver` portado a TypeScript

LangGraph guarda el estado del grafo en un **checkpointer**. AWS publica `DynamoDBSaver` solo para **Python** (`langgraph-checkpoint-aws`); para TypeScript solo existe un paquete comunitario joven (`@farukada/aws-langgraph-dynamodb-ts`, v0.0.11, "en desarrollo activo", con dos tablas). **Decisión: portar el de AWS a TypeScript** (opción que elegiste).

- Clase `DynamoDBSaver extends BaseCheckpointSaver` (de `@langchain/langgraph-checkpoint`) con los métodos del contrato: `getTuple`, `list`, `put`, `putWrites` y `deleteThread`; serialización con el `serde` del checkpointer.
- **Diseño de la tabla** (una sola, `ConversationCheckpoints`, como en el diagrama), siguiendo el de AWS: clave `PK` (string) y `SK` (string), TTL en el atributo `ttl`, y offload a S3 por encima de ~350 KB (opcional; con nuestros estados pequeños no se usa en el MVP, pero el punto de extensión queda). El **esquema exacto de los ítems** (valores de `PK`/`SK` para checkpoints y *writes*) se toma del código fuente de AWS al inicio de la Fase 4; no se inventa aquí. Propuesta de partida: `PK = THREAD#<thread_id>`, `SK = CKPT#<namespace>#<checkpoint_id>` para checkpoints y `SK = WRITE#<namespace>#<checkpoint_id>#<task_id>#<idx>` para *writes*.
- **No hay GSI ni "esquema a medida".** Lo que mostraba el diagrama (mensajes, último intent, última respuesta, estado, idioma, timestamp) vive **dentro del estado del grafo** y se serializa en los checkpoints.
- **Aislamiento:** `thread_id = "<studentId>#<conversationId>"`; un estudiante no puede leer una conversación sin conocer su `studentId`. Una conversación activa por estudiante en la demo (el `conversationId` se guarda en `localStorage`).
- **Borrado (NF-03.5):** `deleteThread`. **Expiración:** TTL de 7 días.
- Escrituras: cada nodo del grafo genera un checkpoint; se evalúa el modo de durabilidad de LangGraph para escribir solo al final del turno.
- **Riesgos del port:** operaciones que el emulador debe soportar (`Query` con `begins_with` y orden descendente, `BatchWriteItem`, TTL, escritura condicional). Se prueban en la Fase 0; si fallan, plan B: DynamoDB Local (imagen oficial).

### D7. ¿Migrar el backend a NestJS? — No

| Criterio | Express 5 (hoy) | NestJS |
|---|---|---|
| Tamaño | ~100 líneas, 3 routers, datos en memoria | Pensado para apps grandes |
| Dependencias | 2 (+ LangGraph y AWS SDK para el asistente) | Decenas (`@nestjs/*`, `reflect-metadata`) |
| AGENTS.md | "no introducir dependencias innecesarias" | Contradice |
| Lambda (destino del lab) | Handler simple | Bundle mayor, cold start más lento |
| Conflictos con otras ramas | Cambios aditivos | Reescribe el backend que otras ramas tocan |
| Beneficios (DI, módulos, testing) | Los da *ports & adapters* con composición manual | Nativos |

**Recomendación (vigente):** mantener Express; LangGraph ya aporta la estructura del flujo.

### D8. Autenticación en la demo local

Sin login: el frontend genera un `studentId` anónimo (UUID en `localStorage`). Cognito/JWT pasa al lab (sección 15).

### D9. Comandos y `.env` centralizados

- **`package.json` raíz (nuevo, sin dependencias):** punto de entrada único. Sus scripts delegan (`npm --prefix <paquete> run …`) o son orquestadores en Node plano (`scripts/*.mjs`), que funcionan antes de instalar nada.
- **Cada paquete conserva y amplía sus scripts** en su directorio: `frontend/`, `backend/`, `platform/` (SST) y `local/`.
- Convención: `<paquete>:<script>` para delegar (p. ej. `backend:test`) y nombres cortos para flujos transversales (`setup`, `dev`, `doctor`, `test`, `kb:upload`, `env:create`).
- Los comandos de SST que despliegan (`dev`, `deploy`, `remove`) siguen **reservados**: la raíz los envuelve con un guard que exige `--confirm`.
- **`.env`:** cada paquete trae su `.env.example` con solo nombres y valores no secretos. **`npm run env:create`** copia cada `.env.example` a `.env` **solo si no existe** y te lista qué variables debes llenar (hoy, `OPENAI_API_KEY` en `local/.env`). Nunca sobrescribe, nunca imprime valores.

---

## 4. Arquitectura objetivo (local)

```
Navegador (Vite :5173)
   │  HTTP JSON
   ▼
Backend Express :3000 ─────────────────────────────── (mismo código → Lambda en el lab)
 ├─ routes/assistantRoutes.ts
 └─ assistant/
      ├─ domain/    funciones puras: idioma, intents, entidades, hechos, plantillas, guardrails
      ├─ graph/     StateGraph de LangGraph (nodos finos sobre domain/) + compilación con checkpointer
      ├─ ports/     LlmProvider · KnowledgeRetriever · CatalogReader · RecommendationProvider · DatesProvider
      └─ adapters/  ChatBedrockConverse (LLM) · BedrockKnowledgeBaseRetriever (Retrieve) · KeywordRetriever
                    DynamoDBSaver (checkpointer) · catálogo en memoria
        │
        ├─ AWS_ENDPOINT_URL ──────────────────────────────► AWS Emulator :PUERTO (Docker, us-east-1)
        │                                                     DynamoDB · S3 · (Lambda/Cognito según spike)
        ├─ …_BEDROCK_RUNTIME ──────┐
        └─ …_BEDROCK_AGENT_RUNTIME ┴─► bedrock-bridge :8787 ──► API de OpenAI (gpt-6-luna, high)
                                          ├─ /model/{id}/converse          → modelo de chat
                                          └─ /knowledgebases/{id}/retrieve → Vector Store de OpenAI

Lab / prod:  los overrides desaparecen → Bedrock + Knowledge Base (S3 Vectors) + DynamoDB reales
```

---

## 5. Estructura, comandos y configuración

### 5.1 Árbol

```
ebc-compass/
├─ package.json                      # NUEVO: orquestación (sin dependencias)
├─ scripts/                          # NUEVO: orquestadores en Node plano (.mjs)
│  ├─ env-create.mjs  setup.mjs  dev.mjs  doctor.mjs  sst-guard.mjs
├─ knowledge/                        # NUEVO: corpus mock listo para cargar (sección 9)
│  ├─ manifest.json
│  └─ *.md
├─ local/                            # NUEVO: entorno local (independiente de platform/)
│  ├─ package.json                   # scripts propios + dependencias (tsx, openai, AWS SDK)
│  ├─ .env.example
│  ├─ docker-compose.yml  emulator/Dockerfile
│  ├─ bedrock-bridge/                # Converse + Retrieve → OpenAI
│  ├─ kb/                            # scripts de carga/consulta/export del conocimiento
│  ├─ scripts/                       # provision, spike, e2e
│  └─ .state/                        # IDs locales (vector store, hashes). Ignorado por git
├─ backend/   (package.json propio)  # + src/assistant/, src/routes/assistantRoutes.ts, src/config/env.ts, .env.example ampliado
├─ frontend/  (package.json propio)  # + pages/Assistant.tsx, components/assistant/, services/assistantService.ts, .env.example
├─ platform/  (package.json propio)  # SST; sin cambios en esta actividad (ver sección 15)
└─ docs/{plans/, local-emulator-findings.md, demo-script.md}   # planes (este documento), resultados y guion
```

Los scripts de la raíz son JavaScript plano y los de `local/` TypeScript con `tsx`; todo asume macOS.

### 5.2 Catálogo de comandos

**Raíz (`npm run <script>` desde `ebc-compass/`)**

| Script | Qué hace |
|---|---|
| `env:create` | Crea `backend/.env`, `frontend/.env` y `local/.env` desde sus `.env.example` si no existen (nunca sobrescribe) y lista las variables que debes llenar |
| `setup` | Verifica prerrequisitos; ejecuta `env:create`; instala dependencias en todos los paquetes; construye y levanta el emulador; aprovisiona; carga el conocimiento si hay clave; smoke test. Idempotente |
| `dev` | **Levanta todo**: emulador, puente, backend y frontend, con logs con prefijo, esperas de salud, URLs impresas y apagado ordenado con Ctrl+C |
| `dev:rules` | Igual que `dev`, con `ASSISTANT_MODE=rules` (sin OpenAI: plan B de la demo) |
| `stop` | Detiene emulador y puente |
| `doctor` | Diagnóstico ✔/✖ con acción correctiva |
| `verify:flow` | Verifica el flujo completo de la demo contra el entorno levantado (script de API; sustituye al e2e) |
| `verify:rules` | Compara el grafo en modo `rules` con una lista de preguntas de ejemplo (ES/EN) e imprime el resultado para revisión manual |

| `typecheck`, `lint`, `build` | Ejecuta el script homónimo en cada paquete que lo tenga |
| `kb:upload` / `kb:status` / `kb:query -- "texto"` / `kb:verify` / `kb:export` / `kb:sync-s3` / `kb:reset` | Gestión del corpus en el Vector Store de OpenAI y exportación para S3 (sección 9.3) |
| `emulator:up` / `emulator:down` / `provision` / `bridge` | Controlan por separado el emulador, los recursos y el puente |
| `backend:*`, `frontend:*`, `platform:*`, `local:*` | Delegan al script del mismo nombre en cada paquete (p. ej. `backend:dev`, `frontend:test`) |
| `sst:dev`, `sst:deploy`, `sst:remove` | **Reservados**: pasan por `sst-guard.mjs`, que exige `--confirm` y rechaza ejecutarse dentro de `setup`/`dev` |

**Por paquete (cada uno en su directorio)**

| Paquete | Scripts |
|---|---|
| `backend/` | `dev`, `build`, `start` (existentes); **nuevo:** `typecheck` |
| `frontend/` | `dev`, `build`, `lint`, `preview` (existentes); **nuevo:** `typecheck` |
| `platform/` | `typecheck`, `test`, `install:providers` (existentes); `dev`, `deploy`, `remove` siguen reservados |
| `local/` | `up`, `down`, `provision`, `bridge`, `kb:*`, `spike`, `doctor`, `verify:flow`, `verify:rules` |

La raíz no duplica lógica. Los comandos se documentan en `local/README.md` y en una sección breve del `README.md` raíz (aprobado).

### 5.3 Variables de entorno

`.env` está ignorado por git (`.env.*` salvo `.env.example`). Cada paquete tiene su plantilla.

| Variable | Archivo | Valor local |
|---|---|---|
| `AWS_REGION` | backend, local | `us-east-1` |
| `AWS_ENDPOINT_URL` | backend, local | `https://127.0.0.1:9297` (confirmado en la Fase 0) |
| `AWS_ENDPOINT_URL_BEDROCK_RUNTIME` | backend | `http://127.0.0.1:8787` |
| `AWS_ENDPOINT_URL_BEDROCK_AGENT_RUNTIME` | backend | `http://127.0.0.1:8787` |
| `AWS_SHARED_CREDENTIALS_FILE`, `AWS_CONFIG_FILE`, `AWS_CA_BUNDLE`, `NODE_EXTRA_CA_CERTS` | inyectadas por `npm run dev` | rutas absolutas a `~/.aws/emulator/9297/` (no van en `.env`) |
| `ASSISTANT_MODE` | backend | `llm` o `rules` |
| `ASSISTANT_LLM_TIMEOUT_MS` | backend | `45000` |
| `BEDROCK_MODEL_ID` | backend | `local-chat` (en el lab: modelo real) |
| `KNOWLEDGE_BASE_ID` | backend | `local-kb` (en el lab: ID de la KB de SST) |
| `CONVERSATIONS_TABLE` | backend | `ConversationCheckpoints` |
| `OPENAI_API_KEY` | **solo `local/.env`** | **la pones tú**; nunca en el repo |
| `OPENAI_MODEL` | local | `gpt-6-luna` |
| `OPENAI_REASONING_EFFORT` | local | `high` |
| `OPENAI_VECTOR_STORE_NAME` | local | `ebc-compass-knowledge` |
| `OPENAI_VECTOR_STORE_TTL_DAYS` | local | `30` |
| `BRIDGE_PORT` | local | `8787` |
| `KNOWLEDGE_BUCKET` | local | `ebc-compass-knowledge-local` |
| `VITE_API_URL` | frontend | `http://localhost:3000` |

### 5.4 Dependencias nuevas

- **backend:** `@langchain/langgraph`, `@langchain/core`, `@langchain/langgraph-checkpoint`, `@langchain/aws` (`ChatBedrockConverse`), `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-bedrock-agent-runtime`. Sin `dotenv` (Node 22: `--env-file`) y sin `zod`.
- **local:** `tsx`, `openai` (SDK oficial, para vector stores y chat), `@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`.

- **raíz:** ninguna. **Sin Playwright.**

### 5.5 Tipos propios y proveedores provisionales

El asistente **no depende de otras actividades**: define sus tipos (`AssistantProfile`, `AssistantOpportunity`, `FactSheet`…) y tres puertos con implementaciones provisionales sobre lo que ya existe en `main`. Si otra rama cambia los datos, solo se ajusta el adaptador.

```ts
interface CatalogReader {            // hoy: backend/src/data/opportunities.ts (4 tipos)
  list(filter?: { type?: string; career?: string; semester?: number }): Promise<AssistantOpportunity[]>
  findByCode(code: string): Promise<AssistantOpportunity | undefined>   // p. ej. FIN-301
  findByTitle(text: string): Promise<AssistantOpportunity[]>            // coincidencia aproximada
}
interface RecommendationProvider {   // provisional: filtro por carrera/semestre
  recommend(profile: AssistantProfile, limit: number): Promise<AssistantOpportunity[]>
}
interface DatesProvider {            // provisional: deadlines del catálogo
  upcoming(profile: AssistantProfile, days: number): Promise<{ title: string; date: string }[]>
}
```

El perfil llega ya como resumen desde el frontend (sección 6), así que no hay acoplamiento con `profileRoutes` ni con los tipos de perfil del frontend.

---

## 6. Contrato de API (borrador para revisar con la skill `api-contract`)

Base: `http://localhost:3000`. Errores: `{ "code": string, "message": string }`, con `message` en español.

### `POST /api/assistant/messages`

```json
{
  "conversationId": "uuid (opcional; si falta, se crea)",
  "studentId": "uuid anónimo generado por el frontend",
  "message": "¿Qué becas hay para Finanzas?",
  "profile": { "name": "María", "career": "finance", "campus": "CMS", "currentSemester": 5,
               "completedCourses": ["FIN-301"], "interests": ["inversiones"] },
  "language": "es"
}
```

Validación: `message` 1–500 caracteres tras `trim`; `studentId` UUID; `profile` opcional (sin perfil, respuestas generales y sugerencia de completarlo); `completedCourses` ≤ 50; `interests` ≤ 10; campos desconocidos ignorados. El backend invoca el grafo con `configurable: { thread_id: "<studentId>#<conversationId>" }`.

Respuesta `200`:

```json
{
  "conversationId": "uuid",
  "message": {
    "id": "uuid", "role": "assistant", "content": "Encontré 2 becas…",
    "language": "es", "intent": "scholarship-info", "createdAt": "2026-11-16T18:00:00Z",
    "suggestions": ["¿Cuáles son los requisitos de la Beca Santander?", "¿Cómo solicito una beca?"],
    "sources": [{ "kind": "opportunity", "id": "scholarship-ebc", "title": "Beca Fundación EBC" },
                { "kind": "document", "id": "solicitud-beca.md", "title": "Cómo solicitar una beca" }]
  },
  "meta": { "mode": "llm", "latencyMs": 18400, "degraded": false }
}
```

`degraded: true` cuando el LLM o el retriever fallaron y se respondió con plantillas/palabras clave (sigue siendo `200`). Errores: `400 INVALID_INPUT`, `404 CONVERSATION_NOT_FOUND`, `500 INTERNAL`.

### Otras rutas

| Ruta | Descripción |
|---|---|
| `GET /api/assistant/conversations/:id?studentId=…` | Historial a partir de `graph.getState()` (`messages[]`, `language`, `status`, `updatedAt`); `404` si no existe |
| `DELETE /api/assistant/conversations/:id?studentId=…` | `deleteThread` en el checkpointer (NF-03.5); `204` |
| `GET /api/assistant/suggestions?language=es&career=finance` | Preguntas sugeridas del estado vacío (RF-05.13): `{ "suggestions": string[] }` |
| `GET /api/assistant/health` | `{ "store": "ok\|error", "llm": "ok\|error\|disabled", "retriever": "ok\|error", "mode": "llm\|rules" }` |

**CORS y plataforma:** el backend local usa `cors()` abierto. Para el lab, `platform/infra/api.ts` solo permite `GET` y define solo `GET /health`: habrá que agregar `POST`/`DELETE`, rutas y authorizer JWT (sección 15). Bedrock y la KB no se exponen al frontend.

---

## 7. Modelo de datos en DynamoDB

Tabla `ConversationCheckpoints`, **una sola tabla** al estilo del `DynamoDBSaver` de AWS (sección D6). Esquema implementado:

| Ítem | `PK` (partición) | `SK` (ordenación) | Atributos principales |
|---|---|---|---|
| Checkpoint | `CHECKPOINT_<studentId>#<conversationId>` | `<ns>#<checkpoint_id>` | `id`, `ns`, `checkpoint` (binario), `checkpoint_type`, `metadata` (binario), `metadata_type`, `parent_checkpoint_id`, `ttl` |
| Escritura pendiente | `WRITES_<studentId>#<conversationId>#<ns>#<checkpoint_id>` | `<task_id>#<idx>` | `task_id`, `task_path`, `channel`, `idx`, `value` (binario), `type`, `ttl` |

- **Sin GSI.** Operaciones: `Query` por `PK` (con `begins_with` y orden descendente para el último checkpoint), `PutItem` (condicional para escrituras), `BatchWriteItem` y `GetItem`.
- **El estado del asistente** (mensajes recortados a los últimos 20, `summary`, `lastIntent`, `conversationLanguage`) va **dentro del checkpoint** serializado; no son atributos de la tabla.
- Local: la crea `provision`. Lab: se agrega a SST (sección 15).

---

## 8. Diseño del asistente

### 8.1 Grafo de LangGraph

**Estado** (`Annotation`): `messages` (con reducer que recorta a los últimos 20), `profile`, `language`, `intent`, `entities`, `factSheet`, `passages`, `draft`, `response`, `sources`, `suggestions`, `degraded`, `summary`, `status`.

**Nodos** (cada uno es un envoltorio fino de una función pura de `domain/`):

| # | Nodo | Qué hace |
|---|---|---|
| 1 | `validate` | Valida entrada (longitud, tipos) |
| 2 | `detectLanguage` | `es`/`en` por tokens (no por `includes`: el pseudocódigo de `design.md` confunde "que" con "queue") |
| 3 | `analyze` | Normaliza (minúsculas, sin acentos), extrae entidades (códigos `[A-Z]{3}-\d{3}`, títulos aproximados, carrera) y clasifica el intent |
| 4 | `gatherFacts` | Construye la `FactSheet` de forma determinista con `CatalogReader`, `RecommendationProvider` y `DatesProvider` |
| 5 | `retrieve` | `Retrieve` (top 3, filtrado por `language` y `topic`); cae a `KeywordRetriever` si falla |
| 6 | `composeTemplate` | Respuesta por plantilla ES/EN (siempre se calcula) |
| 7 | `generate` | **Solo si `ASSISTANT_MODE=llm`**: el LLM reformula la plantilla con la hoja de hechos y los pasajes; tiempo límite 45 s |
| 8 | `guardrail` | Valida idioma y que no haya datos inventados; si falla, vuelve a la plantilla (`degraded=true`) |
| 9 | `finalize` | Añade `contexto` del perfil, `suggestions` y `sources`, y arma la respuesta |
| — | `fallback` | Para `unknown`: 3 preguntas alternativas y recursos EBC (RF-05.13/14) |

**Aristas condicionales:** `analyze` → `fallback` si el intent es `unknown`; `composeTemplate` → `finalize` si el modo es `rules`; `guardrail` → `composeTemplate` si falla.

**Persistencia:** el grafo se compila con el `DynamoDBSaver`; `thread_id = studentId#conversationId`. El historial para la UI sale de `graph.getState()`.

**Modo sin Docker:** el grafo puede compilarse con `MemorySaver` (en memoria) para depurar sin DynamoDB; no hay suite de pruebas automatizadas.

### 8.2 Intents del MVP

| Intent | Ejemplo ES / EN | Hechos que resuelve | Requisito |
|---|---|---|---|
| `scholarship-info` | "¿Qué becas hay?" / "What scholarships can I get?" | Becas, requisitos, montos, fechas límite, elegibilidad del perfil | RF-05.9 |
| `course-info` | "¿Prerrequisitos de FIN-301?" | Prerrequisitos, semestre, créditos; faltantes del perfil | RF-05.8 |
| `procedure-info` | "¿Cómo me reinscribo?" | Pasos, documentos, oficina, fecha límite | RF-05.10 |
| `event-info` | "Eventos de fintech" | Eventos próximos y lugar | RF-06 |
| `recommendation-request` | "¿Qué me recomiendas?" | `RecommendationProvider.recommend()` | RF-03 |
| `deadline-query` | "¿Qué fechas vienen?" | `DatesProvider.upcoming()` | RF-04 |
| `profile-help` | "¿Qué falta en mi perfil?" | Campos faltantes y completitud | RF-01.13 |
| `greeting` / `help` | "Hola", "¿qué puedes hacer?" | Presentación y ejemplos | — |
| `unknown` | cualquier otra | Sugerencias y recursos EBC | RF-05.13, 05.14 |

La clasificación usa léxico bilingüe ponderado con coincidencia aproximada (distancia de edición ≤ 1 por token, RF-05.4), umbral de confianza 0,5, y los seguimientos cortos heredan `lastIntent`.

### 8.3 Fallbacks

- **No entiende (`unknown`):** ofrece 3 preguntas alternativas en el idioma correcto (RF-05.13).
- **No tiene la información:** dirige al recurso EBC adecuado según el corpus (RF-05.14).
- **OpenAI no disponible, sin clave o lento:** plantillas con `degraded: true`. **Retriever caído:** `KeywordRetriever`.

### 8.4 Contexto del perfil

Carrera, semestre, cursos completados e intereses se inyectan en los hechos y en el prompt (RF-05.5 a 05.7). Sin perfil, el asistente responde en general y sugiere completarlo.

### 8.5 Prompt y guardrails del LLM

- **Prompt de sistema:** asesor de EBC Compass; responder solo en el idioma indicado; usar únicamente los datos de `FactSheet` y `passages`; decir "no tengo esa información" si faltan; máximo ~120 palabras; sin inventar fechas, montos ni códigos.
- **El texto del usuario y del perfil son datos, no instrucciones** (delimitados en el prompt); se ignoran intentos de cambiar el rol o pedir el prompt.
- **Validación de salida:** el idioma debe coincidir y todo código de curso, monto o fecha debe aparecer en la hoja de hechos o los pasajes; si no, se descarta y se usa la plantilla.
- **Presupuesto de tiempo:** el camino por reglas responde en < 2 s (RF-05.12, medido en modo `rules`). En modo `llm` con `gpt-6-luna` y esfuerzo `high` se espera bastante más; se mide y se documenta, con tiempo límite de 45 s y la UI en "escribiendo…".
- **Privacidad:** a OpenAI solo viajan datos mock (resumen mínimo del perfil y fragmentos del corpus simulado); los logs registran intent, idioma y latencia, **no el contenido** de los mensajes.

---

## 9. Corpus de conocimiento y carga al vector store

### 9.1 Archivos (`knowledge/`)

Contenido **inventado y marcado como simulado** (AGENTS.md: no hay información institucional real), coherente con `backend/src/data/opportunities.ts` (mismas becas, trámites y fechas). Entre 10 y 12 archivos Markdown de 300–800 palabras:

| Archivo | Tema (`topic`) | Idioma |
|---|---|---|
| `becas-programas.md` | scholarships | es |
| `solicitud-beca.md` | procedures | es |
| `reinscripcion.md` | procedures | es |
| `reglamento-prerrequisitos.md` | rules | es |
| `servicios-escolares.md` | services | es |
| `calendario-academico.md` | calendar | es |
| `desarrollo-profesional.md` | career | es |
| `eventos-vinculacion.md` | events | es |
| `bolsa-de-trabajo-practicas.md` | career | es |
| `preguntas-frecuentes.md` | faq | es |
| `faq-en.md` | faq | en |
| `scholarships-and-procedures-en.md` | scholarships | en |

### 9.2 Formato y manifiesto

Cada archivo empieza con front-matter:

```markdown
---
id: becas-programas
title: Programas de beca EBC (contenido simulado)
topic: scholarships
language: es
simulated: true
---
```

`knowledge/manifest.json` lista los archivos: `{ "version": 1, "files": [{ "path": "becas-programas.md", "id": "becas-programas" }, …] }`.

Reglas (las validan `kb:upload` y `kb:verify`; rechazan el archivo si no se cumplen):
- `simulated: true` obligatorio (evita subir documentos reales a un tercero).
- Metadatos **solo escalares** (texto, número, booleano): las listas dan problemas de ingesta en Bedrock KB con S3 Vectors.
- Tamaño del archivo ≤ 100 KB y `.metadata.json` generado ≤ 10 KB (límite de Bedrock KB).
- Un tema por archivo, encabezados claros y respuestas autocontenidas (mejor recuperación).

### 9.3 Scripts `kb:*` (en `local/kb/`)

- **`kb:upload`:** valida el corpus; calcula SHA-256 por archivo; busca o crea el Vector Store `OPENAI_VECTOR_STORE_NAME` con expiración `OPENAI_VECTOR_STORE_TTL_DAYS`; sube solo archivos nuevos o modificados con atributos (`id`, `title`, `topic`, `language`, `sha256`) y elimina los que ya no existen; espera a que el procesamiento termine y muestra una tabla; guarda ID y hashes en `local/.state/knowledge.json`. Idempotente.
- **`kb:status`:** archivos completados/fallidos, bytes y fecha de expiración.
- **`kb:query -- "pregunta" [--lang es] [--topic scholarships]`:** pasajes recuperados con puntaje y archivo.
- **`kb:verify`:** 10 preguntas (5 en español y 5 en inglés) doradas (ES/EN) con el documento esperado en el top-3; falla por debajo de un umbral (p. ej. 90 %).
- **`kb:export`:** copia los `.md` y genera un `<archivo>.md.metadata.json` por documento con `{"metadataAttributes": {...}}` (escalares) en `local/.state/knowledge-s3/`, listo para S3 y la sincronización del data source.
- **`kb:sync-s3`:** sube ese export al bucket del emulador para ensayar el flujo de prod.
- **`kb:reset`:** borra el Vector Store y los archivos de OpenAI (confirmación).

Los detalles de la API de OpenAI (creación con `expires_after`, carga por lotes con `file_batches`, atributos por archivo y búsqueda con filtros en `POST /v1/vector_stores/{id}/search`) se **confirman contra la documentación vigente en la Fase 3**. El *chunking* queda en el valor por defecto de OpenAI y se ajusta solo si `kb:verify` lo exige.

### 9.4 Del Vector Store de OpenAI a S3 Vectors

1. `kb:export` → archivos + `.metadata.json`.
2. Subir al bucket `KnowledgeDocuments` de SST (ya definido en `platform/infra/knowledge-base.ts`).
3. Ejecutar la sincronización (*ingestion job*) del data source de la Knowledge Base.
4. Quitar los overrides de endpoint del backend y apuntar `KNOWLEDGE_BASE_ID` a la KB.
5. Reejecutar `kb:verify` contra la KB real para comprobar que la calidad se mantiene.

---

## 10. Automatización del entorno

Todos los scripts son idempotentes y asumen macOS.

**`npm run env:create`** (raíz): para `backend`, `frontend` y `local`, copia `.env.example` → `.env` **solo si `.env` no existe**; imprime qué creó y qué omitió y la lista de variables vacías que debes llenar con su ruta exacta (hoy: `OPENAI_API_KEY` en `local/.env`). No lee ni imprime valores existentes.

**`npm run setup`:**
1. Verifica Node 22, Docker (daemon encendido; si no, indica abrir Docker Desktop) y AWS CLI.
2. Ejecuta `env:create`; **no pide la clave**: si `OPENAI_API_KEY` está vacía, lo avisa y deja el modo `rules` como camino posible.
3. `npm install` en `backend`, `frontend`, `local` y `platform`.
4. Construye y levanta el emulador; espera a que responda.
5. `provision`: tabla DynamoDB y bucket S3.
6. `kb:upload` y `kb:verify` (si hay clave).
7. Verificación rápida: `/api/assistant/health` y una pregunta de ejemplo.

**`npm run dev`:** arranca emulador → puente → backend (`node --env-file`) → frontend; espera cada `health`, imprime URLs (`http://localhost:5173`, `:3000`, puente `:8787`) y apaga todo con Ctrl+C. Si falta clave o internet, avisa y degrada a modo `rules`.

**`npm run doctor`:** revisa Docker, emulador, puente, que exista `OPENAI_API_KEY` (sin imprimirla), Vector Store (existe, archivos completados, no expiró), tabla, bucket, backend, frontend y conectividad con OpenAI, con la acción correctiva para cada ✖.

**Ignorados por git:** `.env` ya lo está; se agrega `local/.state/` al `.gitignore` (aprobado).

---

## 11. Plan por fases

Estimaciones para una persona. Un commit por cambio lógico (inglés, Conventional Commits) y un PR pequeño por fase hacia `main`, con evidencia de verificación (salida de `doctor`/`verify:*`).

### Fase 0: Spike del emulador (4–6 h) — ✅ COMPLETADA el 2026-11-16 (resultados en [docs/local-emulator-findings.md](../local-emulator-findings.md))

**0.1** Iniciar Docker, construir el emulador según su guía y confirmar el puerto y la forma de ejecución en Mac.
**0.2** Probar con `aws --endpoint-url … --region us-east-1` y registrar resultado y evidencia:

| Servicio | Prueba | Si falla |
|---|---|---|
| DynamoDB | tabla con TTL; `PutItem`; `Query` con `begins_with` y orden descendente; `BatchWriteItem`; escritura condicional (lo que necesita el checkpointer) | DynamoDB Local (imagen oficial) |
| S3 | bucket; subir/leer objeto | Poco probable que bloquee |
| Bedrock Runtime | `Converse`: ¿qué devuelve? ¿configurable? | Puente (D3) |
| Bedrock Agent Runtime | `Retrieve`: ¿qué devuelve? | Puente (D5) |
| Lambda | crear función Node 22 e invocarla | Express como API local (ya previsto) |
| API Gateway v2 | API HTTP hacia Lambda | Express local |
| Cognito | User Pool, alta, token, JWKS | Sin login local (D8) |
| S3 Vectors | índice, inserción y consulta | No requerido |
| CloudWatch Logs | grupo y eventos | Logs a consola |

**0.3** Ejecutar el `fidelity_tests_runner` del repositorio `aws/aws-emulator-evaluation-suite` para esos servicios, si es viable.
**0.4** Verificar que **el SDK de AWS respeta** `AWS_ENDPOINT_URL_BEDROCK_RUNTIME` y `AWS_ENDPOINT_URL_BEDROCK_AGENT_RUNTIME`, que `ChatBedrockConverse` los usa (o acepta `client`/`clientOptions`), y el contrato exacto de `Converse` y `Retrieve`.
**0.5** Grafo mínimo de LangGraph.js (dos nodos con `MemorySaver`) ejecutado a mano en Node 22 para fijar versiones compatibles.
**0.6** Escribir `docs/local-emulator-findings.md` con la matriz *funciona / parcial / no funciona* y las decisiones resultantes.

**Salida (lograda):** matriz con evidencia y D3/D5/D6 confirmadas. Hallazgos que condicionan las fases siguientes:
- El LLM del emulador no genera texto y `Retrieve` devuelve vacío → **el puente es necesario** para `Converse` y `Retrieve`.
- Los clientes de Bedrock Runtime y Agent Runtime usan **HTTP/2 por defecto** y fallan contra un puente HTTP plano: el backend crea ambos con `requestHandler: new NodeHttpHandler()` (HTTP/1.1) y pasa el cliente a `ChatBedrockConverse` (`client`).
- DynamoDB del emulador soporta todo lo que necesita el checkpointer; **no se necesita DynamoDB Local**.
- Versiones probadas juntas en Node 22.23: `@langchain/langgraph` 1.7.4, `@langchain/core` 1.4.1, `@langchain/aws` 1.5.2, `@langchain/langgraph-checkpoint` 1.2.2, `@aws-sdk/*` 3.1170.
- Dockerfile y script listos: `local/emulator/Dockerfile` y `local/scripts/spike-emulator.sh`.

### Fase 1: Orquestación y entorno local (8–10 h) — ✅ COMPLETADA el 2026-11-16

**1.1** `package.json` raíz (sin dependencias), `scripts/{env-create,setup,dev,doctor,sst-guard}.mjs`.
**1.2** `.env.example` de `local/`, `backend/` (ampliado) y `frontend/` (nuevo).
**1.3** Paquete `local/` (`package.json`, `tsconfig`, `docker-compose.yml`, `emulator/Dockerfile`) y `provision`.
**1.4** `bedrock-bridge`: `Converse` → OpenAI (`gpt-6-luna`, `reasoning_effort=high`, errores en formato Bedrock) y `Retrieve` → Vector Store (traducción de filtros, formato `retrievalResults`); pruebas con el **SDK real de AWS** apuntando al puente. Confirmar el nombre del modelo y el parámetro de razonamiento contra la API.
**1.5** Script nuevo `typecheck` en `backend/` y `frontend/`; delegaciones en la raíz.
**1.6** `local/README.md`, sección de comandos en el `README.md` raíz y `local/.state/` en `.gitignore`.

**Criterio:** `npm run env:create`, llenar la clave y `npm run setup && npm run dev` dejan todo arriba y `doctor` en verde.

**Resultado (2026-11-16):** todo lo de 1.1 a 1.6 hecho y verificado. Con la clave real: el modelo `gpt-6-luna` existe y responde por `Converse` con `reasoning_effort=high` (~2,3 s en una frase corta); el SDK de AWS recibe `Retrieve` del puente con la forma correcta (texto, `s3Location`, puntaje y metadatos) y los filtros `andAll`/`equals` de Bedrock se traducen a filtros de atributos del Vector Store de OpenAI. El Vector Store temporal de la prueba se eliminó. `npm run dev:rules`, `doctor`, `provision` (idempotente), `typecheck` y el guard de `sst:*` probados. Falta solo probar `npm run dev` (modo `llm`) de punta a punta cuando exista el asistente (Fase 2 a 4).

### Fase 2: Núcleo del asistente y grafo (12–14 h) — ✅ COMPLETADA el 2026-11-16

**2.1** Estructura `backend/src/assistant/{domain,graph,ports,adapters}` con tipos propios; instalar LangGraph en el backend.
**2.2** Funciones puras: `detectLanguage`, normalización, entidades y clasificador de intents con léxico ES/EN (tasks 8.1, 8.3); se revisan con `verify:rules`.
**2.3** Handlers por intent → `FactSheet` y plantillas ES/EN (modo `rules`) (task 8.5), más fallbacks (RF-05.13/14).
**2.4** Proveedores provisionales (`CatalogReader`, `RecommendationProvider`, `DatesProvider`) sobre `data/opportunities.ts`.
**2.5** Grafo de LangGraph (8.1): estado, nodos, aristas condicionales, recorte de mensajes; compilable con `MemorySaver` (task 8.6).

**Criterio:** `verify:rules` devuelve respuestas correctas a la lista de preguntas de ejemplo en modo `rules` y cada respuesta tarda < 2 s (RF-05.12).

**Resultado (2026-11-16):** `npm run verify:rules` → **27/27** preguntas (ES/EN, con seguimientos, erratas, códigos de curso y títulos) como se esperaba; la más lenta tarda 14 ms (límite RF-05.12: 2000 ms). Código en `backend/src/assistant/`: `types.ts`; `domain/` (`text`, `language`, `lexicon`, `intent`, `entities`, `facts`, `templates`); `adapters/catalog.ts` (catálogo, recomendaciones y fechas provisionales sobre `data/opportunities.ts`); `graph/assistantGraph.ts` (grafo de LangGraph compilado con `MemorySaver`; el nodo `retrieve` se activa solo si hay un `KnowledgeRetriever`). Script de verificación: `backend/scripts/verify-rules.ts` (`npm run verify:rules -- --verbose` muestra cada respuesta). El catálogo actual no tiene prerrequisitos ni requisitos de becas: el asistente lo dice y remite a Servicios Escolares; el corpus de la Fase 3 lo cubrirá.

### Fase 3: Conocimiento, LLM y mockups (10–12 h) — ✅ COMPLETADA el 2026-11-16

**3.1** Redactar el corpus `knowledge/` y `manifest.json`, coherente con el catálogo.
**3.2** Scripts `kb:upload`, `kb:status`, `kb:query`, `kb:verify` (10 preguntas (5 en español y 5 en inglés)), `kb:export`, `kb:sync-s3`, `kb:reset` y validaciones del corpus.
**3.3** Adaptador LLM con `ChatBedrockConverse`: tiempo límite, reintentos acotados, mapeo de errores.
**3.4** `BedrockKnowledgeBaseRetriever` (Retrieve) y `KeywordRetriever` de respaldo; evaluar `AmazonKnowledgeBaseRetriever` de `@langchain/aws`.
**3.5** Prompts y guardrails (8.5); nodos `generate` y `guardrail`; revisión manual de salidas (idioma, datos inventados).
**3.6** Verificación manual de los adaptadores contra el puente y el emulador (`doctor` y `kb:query`).

**Criterio:** `kb:verify` ≥ 90 %; en modo `llm` las respuestas citan fuentes del corpus; sin clave o sin internet, cae a `rules` con `degraded: true`.

**Regla de verificación (2026-11-16):** para limitar costo y tiempo, toda verificación usa **como máximo 5 preguntas en español y 5 en inglés** (`verify:rules` 5+5, `kb:verify` 5+5, `verify:llm` 2+2).

**Resultado (2026-11-16):**
- **Corpus:** 12 archivos Markdown simulados en `knowledge/` (10 ES, 2 EN) con `manifest.json` y `golden-questions.json`; coherentes con el catálogo (mismas becas, trámites, eventos y fechas).
- **Scripts `kb:*`** (`local/kb/cli.ts`): `upload` (idempotente: segunda corrida = 12 sin cambios), `status`, `query`, `verify` (**10/10**), `export` (12 archivos + 12 `.metadata.json`), `sync-s3` (24 objetos al bucket del emulador) y `reset`. Rechazan documentos sin `simulated: true`. El Vector Store expira a los 30 días sin uso.
- **LLM:** `BedrockLlmProvider` (`@langchain/aws`, cliente HTTP/1.1, `maxRetries` acotado). Con `gpt-6-luna` y razonamiento `high`, una respuesta tarda **3 a 5 s** y cita fuentes del corpus.
- **Conocimiento:** `BedrockKnowledgeBaseRetriever` (Retrieve) + `KeywordRetriever` de respaldo + `FallbackRetriever`.
- **Grafo:** nodos `generate` y `guardrail`; `prompt.ts` (prompt de sistema ES/EN, datos delimitados, lenguaje neutro) y `guardrail.ts` (rechaza texto vacío, filtraciones del prompt, idioma distinto y códigos, fechas, montos, porcentajes o cifras que no estén en los hechos/documentos). El LLM solo se usa en temas de consulta y en preguntas no entendidas con documentos que las respondan.
- **Degradación comprobada:** con el puente apagado el asistente responde por plantilla con `degraded: true` en ~1,6 s.
- **Verificación:** `npm run verify:llm` (2 ES + 2 EN) y `npm run verify:rules` (5 ES + 5 EN, 10/10).

### Fase 4: Persistencia con LangGraph y API (14–18 h) — ✅ COMPLETADA el 2026-11-16

**4.1** Estudiar el `DynamoDBSaver` de AWS (documentación y código de `langgraph-checkpoint-aws`) y fijar el esquema de ítems definitivo.
**4.2** Portar `DynamoDBSaver` a TypeScript (`getTuple`, `list`, `put`, `putWrites`, `deleteThread`, serialización, TTL) y registrar en `provision` la tabla `ConversationCheckpoints`.
**4.3** Verificación del checkpointer con un script manual: guardar, reanudar el último checkpoint, aislamiento por `thread_id`, borrado y TTL.
**4.4** Compilar el grafo con el `DynamoDBSaver`; evaluar el modo de durabilidad para reducir escrituras.
**4.5** `assistantRoutes.ts` y registro en `app.ts` (contrato de la sección 6); validación y errores.
**4.6** Verificación manual de rutas y de DynamoDB contra el emulador; revisión con las skills `api-contract` y `app-platform-impact`.

**Criterio:** una conversación sobrevive al reinicio del backend y `DELETE` la elimina.

**Resultado (2026-11-16):**
- **`DynamoDBSaver` en TypeScript** (`backend/src/assistant/adapters/dynamoSaver.ts`), portado del de AWS (`langgraph-checkpoint-aws`): tabla única `PK`/`SK`, checkpoints en `CHECKPOINT_<thread_id>` / `<ns>#<checkpoint_id>`, escrituras en `WRITES_<thread_id>#<ns>#<checkpoint_id>` / `<task_id>#<idx>`, TTL en `ttl` (7 días), consulta descendente para el último checkpoint, escrituras idempotentes y borrado completo por conversación. **Diferencias deliberadas con AWS:** el checkpoint y sus metadatos van en el mismo ítem (no en ítems de chunk) y no hay offload a S3 (el estado es pequeño; se lanza error cerca de 400 KB).
- **Verificación** (`npm run verify:checkpointer`): 12/12 contra el emulador — último checkpoint, padre, lista ordenada y con límite, escrituras sin duplicar, aislamiento por conversación, **un grafo nuevo (backend "reiniciado") retoma el seguimiento y conserva los 4 mensajes**, y `deleteThread` borra checkpoints y escrituras.
- **API** (`backend/src/routes/assistantRoutes.ts`, montada en `/api/assistant`): `POST /messages`, `GET` y `DELETE /conversations/:id`, `GET /suggestions`, `GET /health`. Validación manual con errores `{code, message}`. Comprobado con `npm run dev` (emulador + puente + LLM + DynamoDB): respuesta del LLM en 3,5 a 6,4 s, persistencia tras reiniciar el backend, `404` para otro estudiante, `204` al borrar, `400` por UUID inválido, mensaje vacío, JSON mal formado e idioma no soportado.
- **Cambios al contrato respecto a la sección 6:** (1) `POST /messages` con un `conversationId` desconocido **no** devuelve 404: crea la conversación (así el chat sigue funcionando si se reinició el emulador); el 404 queda solo para `GET`. (2) `GET /health` devuelve `llm: "configured" | "disabled"` y `retriever: "bedrock-kb" | "disabled"` (no se llama al modelo para no generar costo). (3) `meta.mode` es `llm` o `rules` según quién redactó la respuesta.
- **Configuración:** `ASSISTANT_STORE=memory` permite arrancar sin Docker (conversaciones en memoria); por defecto `dynamodb`.
- **Mejora en `dev`:** si el puerto del backend, el frontend o el puente ya está ocupado, falla con un mensaje claro (antes un backend viejo podía confundirse con el nuevo).
- **Conocimiento:** el filtro por metadatos `topic` ya se aplica por intent (consultas por tema, `equals` + `andAll` sin anidar), y las fuentes del LLM se reducen a las oportunidades que la respuesta nombra más los documentos recuperados.

### Fase 5: Frontend del chat (10–12 h) — ✅ COMPLETADA el 2026-11-16

**5.1** `assistantService.ts` y tipos; `studentId` anónimo y `conversationId` en `localStorage`.
**5.2** Componentes `ConversationHistory`, `QueryInput` (500 caracteres, Enter para enviar, estado de carga) y `SuggestedQuestions`.
**5.3** Página `/asistente` y enlace en la navegación (cambio mínimo en `Layout.tsx` y `AppRoutes.tsx`).
**5.4** Estilos del tema monocromático actual; responsive (320–428 px y 768+); accesibilidad (`aria-live`, foco visible, etiquetas); botón para limpiar la conversación.
**5.5** Mostrar fuentes citadas, idioma detectado y aviso cuando `degraded: true`.
**5.6** Revisión manual del chat en el navegador (flujo completo, errores, estados de carga). Sin pruebas automatizadas.

**Criterio:** conversación completa en móvil y escritorio, sin errores de consola.

**Resultado (2026-11-16):**
- **Código:** `frontend/src/pages/Assistant.tsx` (ruta `/asistente`, enlace "Asistente" en la navegación), `components/assistant/{ConversationHistory,QueryInput,SuggestedQuestions}.tsx` + `assistant.css`, `services/assistantService.ts` y `types/assistant.ts`.
- **Comportamiento:** `studentId` anónimo y `conversationId` en `localStorage`; el perfil guardado en el navegador se envía como resumen en cada mensaje; el historial se recarga desde el servidor (si el servidor ya no tiene la conversación, el chat empieza de nuevo); preguntas sugeridas en el estado vacío (se copian al campo y se enfoca) y seguimientos bajo la última respuesta; fuentes citadas (oportunidades con borde continuo y documentos con borde punteado); pie con el modo ("Redactada con IA" o "Respuesta por reglas") y la latencia; aviso cuando la respuesta viene degradada; "Escribiendo…"; error de red con botón **Reintentar**; **Borrar conversación** (con confirmación; borra también en el servidor); límite de 500 caracteres con contador; aviso para completar el perfil si falta.
- **Accesibilidad y responsive:** el historial es un `role="log"` con `aria-live`, el campo tiene etiqueta, foco visible de 3 px, objetivos táctiles ≥ 44 px, `prefers-reduced-motion` respetado; en móvil (375 px) sin scroll horizontal; una respuesta nueva se muestra desde su inicio y solo se desplaza el chat, no la página.
- **Verificación en navegador real** (Chrome headless controlado por CDP, sin instalar dependencias): sugerencia → respuesta del LLM con fuentes y pie (7,4 s), seguimiento, recarga con 4 mensajes recuperados, móvil sin scroll horizontal, envío vacío con mensaje de ayuda, error de red con reintento exitoso, borrado con estado vacío e id olvidado, **0 errores de consola**. `tsc`, `eslint` y `vite build` pasan. Sin pruebas automatizadas, como se acordó.
- **No incluido (queda para la Fase 6):** enlaces desde Home/Catálogo con contexto y el botón "solicitud de corrección" de Perfil que aún dice que "estará disponible en el asistente".

### Fase 6: Integración y flujo completo (8–10 h) — ✅ COMPLETADA el 2026-11-16

**6.1** Integrar lo que haya llegado a `main` de otras actividades (catálogo ampliado, motor de recomendaciones, fechas/alertas) reemplazando los proveedores provisionales sin tocar el dominio.
**6.2** Enlaces desde Home y Catálogo al asistente con contexto (p. ej. "Preguntar sobre esta beca").
**6.3** `verify:flow` (script de API): crear perfil → Home → catálogo → preguntar al asistente en ES y EN → ver recomendaciones → borrar conversación.
**6.4** Medición de rendimiento (RF-05.12) y verificación de RF-05.1 a 05.14 (task 11.5) con tabla de evidencia.
**6.5** `docs/demo-script.md`: guion de 5–7 minutos, datos de prueba, **plan B** (`npm run dev:rules`) y checklist previo (`doctor`, `kb:status`, vector store vigente).

**Criterio:** el flujo corre de punta a punta con `npm run dev` y la matriz RF-05 queda verificada.

**Resultado (2026-11-16):**
- **Integración con `main` (6.1):** `origin/main` había avanzado 20+ commits (navegación responsive con "Conversar" y ruta `/asistente`, catálogo ampliado a **6 tipos y 20 oportunidades**, endpoints `/api/recommendations` y `/api/alerts`, inicio de sesión con Cognito y token en las peticiones, calendario, pruebas propias del equipo). La rama no tenía commits propios, así que se actualizó por *fast-forward* y se reaplicó el trabajo guardado con `git stash` (5 conflictos resueltos: `Layout.tsx` y `AppRoutes.tsx` se quedaron con la versión de `main`; `app.ts` y los dos `package.json` combinan ambos lados). El `Assistant.tsx` de relleno del equipo fue reemplazado por el chat real. Se respaldó todo antes en un `.tar` fuera del repo.
- **Adaptación del asistente:** el modelo de datos pasó a 6 tipos y hay un nuevo intent `career-info` (certificaciones, prácticas y vacantes). La regla de recomendación del equipo se extrajo a `backend/src/data/recommendations.ts` (la ruta devuelve lo mismo; sus pruebas siguen verdes) y el asistente la reutiliza, excluyendo cursos completados y oportunidades vencidas. Las peticiones del asistente envían `Authorization: Bearer` si hay sesión de Cognito (listo para el authorizer JWT del lab).
- **Corpus ampliado** con las oportunidades nuevas (beca al mérito, certificaciones, vacantes, feria de empleabilidad, taller, constancia y corrección de datos académicos); `kb:verify` sigue en 10/10. El filtro por tema incluye ahora `services`; las fuentes del LLM solo muestran las oportunidades que la respuesta nombra.
- **Enlaces con contexto (6.2):** "Preguntar al asistente" en las tarjetas de recomendaciones de Inicio y en el detalle de cada oportunidad del Catálogo, y el botón "¿Hay un dato académico incorrecto?" de Perfil. La pregunta llega precargada (`/asistente?q=…`) para revisarla y enviarla.
- **`npm run verify:flow` (6.3):** 12/12 con LLM y 12/12 en modo reglas.
- **RF-05 (6.4):** [docs/rf05-verification.md](../rf05-verification.md): 12 de 14 criterios cumplidos sin matices; el 11 (solo reglas) y el 12 (< 2 s) se cumplen en modo `rules` y quedan como diferencia asumida (V1) con el LLM.
- **Guion de la demo (6.5):** [docs/demo-script.md](../demo-script.md), con checklist previo, recorrido de 11 pasos, plan B y qué decir de la arquitectura.
- **Navegador real:** enlaces y precarga desde Inicio, Oportunidades y Perfil; en móvil la navegación inferior del equipo ya no tapa el campo de texto; 0 errores de consola.

### Fase 7: Paso al lab de AWS (después de la demo; 4–6 h) — ✅ PREPARADA el 2026-11-16 (sin desplegar: aún no hay lab)

Ver sección 15. No se ejecuta sin autorización de infraestructura.

**Resultado (2026-11-16): todo listo para desplegar; guía en [docs/deploy-lab.md](../deploy-lab.md).** Con credenciales del lab bastan `npm run lab:check` y `npm run lab:deploy -- --confirm`.
- **Backend como Lambda:** `backend/src/lambda.ts` (`serverless-http`) atiende `ANY /api/{proxy+}` con las mismas rutas que en local, así el frontend no cambia. La identidad del estudiante sale del `sub` del token de Cognito (verificado por API Gateway) y se ignora el `studentId` del cliente.
- **Infraestructura SST nueva** (`platform/infra/`): tabla DynamoDB `ConversationCheckpoints`, función del backend (Bedrock `InvokeModel` + `Retrieve`, documentos empaquetados para el respaldo, tiempo de 29 s por el límite de API Gateway), ruta del API con authorizer JWT, CORS con `POST`/`DELETE`, sitio en S3 + CloudFront compilado con la URL del API y Cognito, y cliente de Cognito con `ADMIN_USER_PASSWORD_AUTH` para la prueba de humo.
- **Automatización (`lab/` y `npm run lab:*`):** `check`, `deploy` (cuenta → detección del modelo de Bedrock → `sst deploy` → carga y sincronización de la Knowledge Base con verificación → prueba de humo), `knowledge`, `smoke`, `user`, `status`, `destroy`. Los comandos que cambian la nube exigen `--confirm`.
- **Verificado sin lab:** handler con eventos de API Gateway v2 (`npm run verify:lambda`), paquete con esbuild como SST (5,6 MB), `tsc` de `platform/`, ensayo de `lab:user`, de la subida a S3 y de `lab:smoke` (contra el backend local y Cognito del emulador). **Solo comprobable en el lab:** `sst deploy`, la ingesta y recuperación de la Knowledge Base, la detección del modelo, CloudFront, el authorizer y los permisos de IAM.

### Esfuerzo

| Fase | Horas |
|---|---|
| 0 Spike | 4–6 |
| 1 Orquestación y entorno | 8–10 |
| 2 Núcleo y grafo | 12–14 |
| 3 Conocimiento, LLM y mockups | 10–12 |
| 4 Persistencia (LangGraph) y API | 14–18 |
| 5 Frontend | 10–12 |
| 6 Integración y e2e | 8–10 |
| **Total (sin fase 7)** | **~66–82 h** |

Camino crítico: 0 → 1 → 3 → 4 → 6. Las Fases 2 y 5 pueden avanzar en paralelo a 0–1 si somos dos personas.

---

## 12. Estrategia de verificación (sin pruebas automatizadas)

Decisión del equipo: **no se escriben pruebas unitarias ni de componentes, ni en frontend ni en backend**. La calidad se comprueba con:

| Qué | Cómo | Requiere |
|---|---|---|
| Entorno sano | `npm run doctor` | Entorno arriba |
| Calidad del corpus y del puente | `npm run kb:verify` (10 preguntas (5 en español y 5 en inglés) con el documento esperado en el top-3) y `kb:query` | Vector Store cargado |
| Respuestas del asistente en modo `rules` | `npm run verify:rules` (lista de preguntas ES/EN; se revisa la salida) | Nada (sin red) |
| Flujo completo de la demo | `npm run verify:flow` (script de API) | `npm run dev` |
| Rendimiento | Latencia impresa por `verify:flow` (< 2 s en `rules`; se documenta en `llm`) | Entorno arriba |
| Chat en el navegador | Revisión manual con la checklist de `docs/demo-script.md` (móvil y escritorio) | Entorno arriba |
| Estática | `tsc` (`typecheck`), `eslint` y `git diff --check` | Nada |

Los pasos que consumen la API de OpenAI son explícitos para no generar costo sin querer.

---

## 13. Seguridad y privacidad

- Ninguna clave en el repo; `.env` ignorado; `OPENAI_API_KEY` solo en `local/.env` (la pones tú), leída solo por el puente; el backend y el frontend nunca la ven. `setup`, `doctor` y `env:create` no la imprimen ni la leen.
- Datos mock únicamente. **El corpus solo se sube si está marcado `simulated: true`**; al terminar se puede borrar (`kb:reset`) y el Vector Store expira solo (TTL).
- El perfil que recibe el asistente es un resumen mínimo sin datos sensibles; a OpenAI llegan ese resumen y fragmentos del corpus simulado.
- Validación estricta de entrada y límites de tamaño; el frontend renderiza con React (sin `dangerouslySetInnerHTML`).
- Los logs no incluyen el contenido de los mensajes, solo intent, idioma y latencia.
- Inyección de prompts mitigada (8.5); el LLM no tiene herramientas ni acceso a datos más allá de la hoja de hechos.
- TTL de 7 días en las conversaciones y endpoint de borrado (NF-03.5).
- El puente y el emulador escuchan solo en `127.0.0.1`.

---

## 14. Riesgos y mitigaciones

| Riesgo | Prob. | Mitigación |
|---|---|---|
| El emulador no soporta Bedrock/Lambda/Cognito con fidelidad suficiente | Alta | Fase 0 al inicio; puente para Bedrock y Retrieve; Express como API; DynamoDB Local como plan B |
| **El port del `DynamoDBSaver` no funciona contra el emulador** (`Query`, `BatchWrite`, TTL, condicionales) | Media | Se prueba en la Fase 0; plan B: DynamoDB Local; script de verificación del checkpointer |
| **Esfuerzo del port del checkpointer mayor al estimado** | Media | Fase 4 de 14–18 h con el estudio del código de AWS al inicio; alcance MVP sin offload a S3 |
| Versiones de LangGraph.js, `@langchain/aws` y `@langchain/langgraph-checkpoint` incompatibles entre sí | Media | Fijar versiones en la Fase 0.5; lockfile |
| **La demo depende de internet y de OpenAI** (red, límites, cuota) | Media | Modo `rules` (`dev:rules`) y `KeywordRetriever` como plan B; `doctor` en el checklist previo |
| **Latencia de `gpt-6-luna` con esfuerzo `high`** (decenas de segundos) | Alta | Tiempo límite de 45 s, UI "escribiendo…", `OPENAI_REASONING_EFFORT` configurable, modo `rules` como base verificable |
| **El nombre `gpt-6-luna` y el parámetro de razonamiento no están verificados** (salen de `.codex/config.toml`) | Media | Confirmar contra la API en la Fase 1; el puente aísla el cambio |
| Cambios en la API de vector stores de OpenAI | Media | Confirmar contra la doc vigente en la Fase 3; aislar todo en el puente y `kb/` |
| El contrato de `Converse`/`Retrieve` del puente no coincide con lo que espera el SDK | Media | Probar con el SDK real (0.4 y 1.4); verificación manual del contrato |
| Respuestas con datos inventados | Media | Hoja de hechos, guardrail de salida y fallback a plantilla |
| Vector Store expira antes de la demo | Media | TTL configurable; `doctor` y `kb:status` avisan; `kb:upload` es idempotente |
| Calidad distinta entre OpenAI y S3 Vectors en prod | Media | Misma batería `kb:verify` en ambos; metadatos escalares |
| Docker apagado o sin recursos | Media | `doctor`/`setup`; modo sin Docker documentado (reglas + `MemorySaver`) |
| Conflictos con otras ramas (Layout, rutas, `.env.example`) | Media | Cambios mínimos y aditivos fuera del módulo del asistente; rebase frecuente sobre `main` |
| Tipos del código distintos a los de `design.md` | Alta | Tipos propios del asistente y adaptadores; sin dependencia de otras ramas |
| El emulador salió esta semana y puede cambiar | Media | Fijar versión en el `Dockerfile` y registrarla en los hallazgos |

---

## 15. Traspaso al lab de AWS (Fase 7)

1. **Bedrock:** habilitar el modelo en la cuenta del lab; fijar `BEDROCK_MODEL_ID`; quitar todos los `AWS_ENDPOINT_URL*`.
2. **Conocimiento:** `kb:export` → subir al bucket `KnowledgeDocuments` de SST → *ingestion job* del data source → `KNOWLEDGE_BASE_ID` de las salidas de SST → `kb:verify` contra la KB real. El código del backend no cambia (ya usa `Retrieve`).
3. **DynamoDB:** agregar `ConversationCheckpoints` (`PK`/`SK`, TTL en `ttl`) en `platform/infra/`.
4. **API:** exponer las rutas del asistente en `platform/infra/api.ts` (hoy solo `GET /health`), empaquetar el backend como Lambda (`backend/src/lambda.ts` con un adaptador sobre los mismos servicios y el grafo) y permitir `POST`/`DELETE` en CORS.
5. **Autenticación:** authorizer JWT con Cognito; el frontend envía el token y `studentId` pasa a ser el `sub`.
6. **IAM mínimo** para Lambda: `bedrock:InvokeModel`/`Converse`, `bedrock:Retrieve`, y acceso a la tabla (`GetItem`, `PutItem`, `Query`, `BatchWriteItem`, `DeleteItem`).
7. **Observabilidad:** CloudWatch Logs (previsto por SST).
8. **Frontend:** CloudFront + S3 con `VITE_API_URL` y `VITE_COGNITO_*`.
9. **Limpieza:** `kb:reset` para borrar el Vector Store de OpenAI.

Nada se despliega sin autorización explícita de infraestructura; los scripts `sst:*` de la raíz seguirán exigiendo `--confirm`.

---

## 16. Decisiones

### Resueltas

| # | Decisión |
|---|---|
| R1 | LLM: **API de OpenAI**, modelo **`gpt-6-luna`** con `reasoning_effort=high` (configurable) |
| R2 | Conocimiento: **Vector Store de OpenAI** hoy; **S3 Vectors** en prod |
| R3 | Mockups del corpus listos para cargar, con scripts `kb:*` |
| R4 | Comandos centralizados en `package.json` raíz; cada paquete con los suyos (front, back, SST, local) |
| R5 | Rama `feature/agents-core`; región `us-east-1`; emulador separado de SST |
| R6 | **LangGraph.js** para orquestar y persistir el asistente |
| R7 | Checkpointer: **portar el `DynamoDBSaver` de AWS a TypeScript** (no el paquete comunitario) |
| R8 | La clave de OpenAI la pone el usuario en `local/.env`; el repo solo trae `.env.example` y `npm run env:create` |
| R9 | **Sin pruebas automatizadas** (ni unitarias ni de componentes; sin Vitest ni Playwright). Verificación con scripts y manual |
| R10 | Aprobado tocar `.gitignore` (`local/.state/`), crear el `package.json` raíz y documentar comandos en el `README.md` |
| R11 | Solo macOS |
| R12 | Sin coordinación con otras ramas: tipos propios del asistente |
| V1 | Asistente híbrido (reglas deciden, LLM redacta, orquestado por un grafo determinista) pese a RF-05.11 y RF-05.12; el modo `rules` es la base verificable |
| V6 | Corpus inventado y marcado `simulated: true` |
| V7 | Demo sin login (`studentId` anónimo); Cognito en el lab |
| V9 | Mantener Express; no migrar a NestJS |

### Abiertas (se resuelven con el spike, no necesitan decisión ahora)

| # | Pregunta | Cómo se resuelve |
|---|---|---|
| ~~A1~~ | ~~Puerto, forma de ejecución y servicios del emulador~~ | **Resuelta:** HTTPS en `9297`, contenedor Docker, matriz de servicios en `docs/local-emulator-findings.md` |
| ~~A2~~ | ~~¿El emulador soporta lo que necesita el checkpointer?~~ | **Resuelta:** sí (`Query` descendente, `BatchWriteItem`, TTL, condicionales); no hace falta DynamoDB Local |
| A3 | Nombre exacto del modelo `luna` y parámetro de razonamiento | Fase 1.4 contra la API |
| A4 | ¿Existe `AmazonKnowledgeBaseRetriever` en `@langchain/aws` y acepta endpoint? | Fase 3.4 |
