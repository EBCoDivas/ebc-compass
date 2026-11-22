# Entorno local de EBC Compass

Demo local del asistente: **AWS Emulator** (DynamoDB, S3, S3 Vectors…) + un **puente** que responde las llamadas de Bedrock con la API de OpenAI. Es independiente de `platform/` (SST); los nombres de recursos y variables son los mismos que en el lab de AWS, así que el backend no cambia entre local y lab.

> Los comandos se ejecutan desde la **raíz del repo**. Plan completo: [docs/plans/plan-asistente-integracion.md](../docs/plans/plan-asistente-integracion.md). Hallazgos del emulador: [docs/local-emulator-findings.md](../docs/local-emulator-findings.md).

## Requisitos

- Node 22 y npm. **El setup no instala ni cambia Node**: si tu versión es otra, solo muestra una alerta y tú lo configuras a tu manera (nvm, fnm, volta o el instalador oficial).
- **Docker Desktop encendido** (macOS, Windows o Linux). Si falta, `npm run setup` lo detecta y te ofrece instalarlo con Homebrew (macOS) o winget (Windows), **siempre pidiendo confirmación**. En Linux solo muestra las instrucciones.
- AWS CLI (opcional, solo para depurar). El setup también ofrece instalarlo.
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
| `npm run setup` | Verifica prerrequisitos (ofrece instalar Docker y el AWS CLI si faltan; Node solo alerta), instala dependencias (`--skip-platform` omite SST), levanta el emulador y aprovisiona |
| `npm run dev` / `dev:rules` | Levanta todo, con o sin LLM. Con LLM también carga la base de conocimiento en S3 Vectors. Ctrl+C detiene backend, frontend y puente |
| `npm run stop` | Detiene el emulador (**borra sus datos: viven en memoria**) |
| `npm run doctor` | Diagnóstico ✔/✖ con la acción correctiva |
| `npm run provision` | Crea las tablas, el bucket, el índice de S3 Vectors y las cuentas de Cognito en el emulador (idempotente) |
| `npm run emulator:up` / `emulator:down` | Controla solo el emulador |
| `npm run bridge` | Levanta solo el puente |
| `npm run kb:index` | Carga el corpus de `knowledge/` en S3 Vectors del emulador (requiere el puente en marcha). `npm run dev` lo ejecuta solo |
| `npm run kb:verify` | Comprueba la recuperación con las preguntas de oro, a través del `Retrieve` del puente |
| `npm run kb:query -- "texto" [--lang es]` | Consulta de prueba: pasajes recuperados con puntaje |
| `npm run kb:upload` / `kb:status` | Vector Store de OpenAI (camino anterior, solo con `KNOWLEDGE_STORE=openai`) |
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
        ─ AWS_ENDPOINT_URL_BEDROCK_RUNTIME ──┐                                     ▲ S3 Vectors
        ─ AWS_ENDPOINT_URL_BEDROCK_AGENT_RUNTIME ─► bedrock-bridge (http://127.0.0.1:8787) ─► API de OpenAI
```

- El emulador genera **credenciales y certificado nuevos en cada arranque** en `~/.aws/emulator/9297/`. `npm run dev` y `npm run provision` los inyectan; los `.env` no llevan credenciales.
- **Todo vive en memoria** y se borra al detener el emulador. `dev` y `setup` re-aprovisionan en cada arranque.
- El puente implementa `Converse` (modelo de chat), `InvokeModel` de Titan Text Embeddings v2 (responde con embeddings de OpenAI) y `Retrieve` (base de conocimiento) con la forma de la API de Bedrock. No registra el contenido de los mensajes ni la clave.
- Solo escuchan en `127.0.0.1`.

## Problemas frecuentes

| Síntoma | Solución |
|---|---|
| `Docker no está instalado` | `npm run setup` ofrece instalarlo; o instala Docker Desktop a mano |
| `Docker está instalado pero no responde` | Abre Docker Desktop y espera a que arranque (en macOS el setup puede abrirlo por ti) |
| `OPENAI_API_KEY vacía` | Edita `local/.env`, o usa `npm run dev:rules` |
| `El emulador no está en marcha` | `npm run emulator:up` |
| Perdí las conversaciones | Se reinició el emulador (datos en memoria); es esperado |
| Puerto 3000/5173 ocupado | Cierra el proceso que lo usa (`lsof -i :3000`) y vuelve a ejecutar |


## Base de conocimiento en S3 Vectors

Local reproduce la Knowledge Base del lab: documentos en S3, un índice de S3 Vectors (`float32`, 1,024 dimensiones,
coseno) y embeddings de Titan Text Embeddings v2. Como el emulador no ejecuta modelos, el puente responde Titan con
`OPENAI_EMBEDDING_MODEL` (por omisión `text-embedding-3-small` a 1,024 dimensiones).

- `npm run dev` ejecuta `kb:index` en cada arranque: el emulador pierde los vectores al reiniciarse.
- `kb:index` sube los documentos al bucket, los divide por secciones, pide los embeddings **a través del puente con
  el contrato de Bedrock** y escribe los vectores. Guarda los embeddings en `local/.state/embeddings.json`, así que
  solo se paga la primera vez o cuando cambia un documento.
- El `Retrieve` del puente genera el embedding de la pregunta y consulta S3 Vectors con los mismos filtros de
  metadatos (`language`, `topic`) que usa el backend. El backend no cambia entre local y lab.
- Los vectores locales no se llevan al lab: allá la Knowledge Base hace su propia ingesta con Titan.
- Para volver al Vector Store de OpenAI, define `KNOWLEDGE_STORE=openai` en `local/.env` (sección siguiente).

## Vector store compartido (anterior)

Solo aplica con `KNOWLEDGE_STORE=openai`. Cada integrante debe copiar el mismo `OPENAI_VECTOR_STORE_ID` en `local/.env`
y usar una clave con acceso al proyecto de OpenAI correspondiente.
No se necesita cargar el corpus para consultar un store ya preparado.

- `npm run kb:upload`: sincroniza el corpus con el ID configurado; nunca crea otro automáticamente.
- `npm run kb:upload -- --id vs_…`: valida, guarda el ID y sincroniza.
- `npm run kb:upload -- --create`: crea explícitamente un store sin expiración, guarda su ID y carga el corpus.
- `npm run kb:reset -- --id vs_…`: exige confirmar el ID escribiéndolo; afecta a todo el equipo. Conserva los archivos globales de OpenAI.

La sincronización consulta todos los archivos remotos y sus huellas; no depende del estado local.
Ejecutar las sincronizaciones de forma secuencial por un responsable.
Al cambiar el ID hay que reiniciar el puente.
Para migrar, copia el ID del antiguo `local/.state/knowledge.json` al `.env`,
verifica con `kb:status` y ejecuta `kb:upload`: se quitará la expiración existente.
Los errores de acceso o expiración requieren corregir el ID explícitamente.

## Acceso con Cognito local

`npm run dev` y `npm run dev:rules` aprovisionan las nueve cuentas ficticias
y habilitan el login en `/acceso`. Ya no se cambia de identidad con un selector.
Consulta los correos y contraseñas en `local/.state/cognito.json`: es un archivo
privado ignorado por Git, con permisos 600. No lo compartas ni lo agregues a commits.

Para un arranque separado de Vite usa `VITE_LOCAL_AUTH=true`; en el lab se usan
`VITE_COGNITO_USER_POOL_ID` y `VITE_COGNITO_CLIENT_ID` y el login SRP de Cognito.
El backend local debe arrancarse desde los comandos de la raíz para recibir
el certificado y las credenciales del emulador. Las rutas de negocio requieren JWT;
`/api/health` y el login local son públicos. El backend usa el sub verificado,
sin confiar en studentId enviado desde el navegador.

El emulador guarda recursos en memoria. Al reiniciarlo, provision recrea las
cuentas con las mismas contraseñas del registro local, pero sus IDs internos pueden
cambiar y las sesiones anteriores dejan de servir. Los checkpoints del chat siguen
perdiéndose al detener el emulador. Esto es restauración de cuentas demo, no
persistencia nativa del proveedor. Cerrar sesión elimina los tokens del navegador;
los ID tokens emitidos expiran normalmente y no se revocan inmediatamente.

Verificación: `npm --prefix backend run verify:auth` (solo emulador, sin LLM).
Para el lab, después de desplegar el esquema de atributos de Cognito,
`npm run lab:personas -- --confirm` registra las nueve cuentas y guarda credenciales
en `scripts/lab/.state/personas.json`. Ese comando modifica AWS real; no se ejecuta
en el arranque local ni como parte de las verificaciones.


## Perfiles en DynamoDB

El aprovisionamiento crea la tabla StudentProfiles, con clave studentId y sin TTL.
PROFILES_TABLE en backend/.env permite ajustar su nombre; el aprovisionamiento
local usa ese mismo valor. El identificador siempre es el sub autenticado.

Al guardar un perfil, el frontend espera la confirmación del backend. Al iniciar
sesión carga la personalización durable y mantiene una caché por cuenta. Si no hay
perfil remoto, migra los ajustes previos de ese navegador y de esa misma cuenta.
Se conservan nombre preferido, intereses, preferencias, materias, metas, promedio
y disponibilidad cuando existan, con una fecha de actualización del servidor.
Las oportunidades guardadas siguen siendo locales y no forman parte de esta tabla.

La tabla sobrevive a reinicios del backend; al destruir el emulador se pierde,
igual que sus otros datos en memoria. En el lab se declara una tabla real sin TTL
y permisos GetItem/PutItem limitados a esa tabla. Hace falta desplegar SST para usarla.

Comprobación local: npm --prefix backend run verify:profiles.


En el primer acceso se solicita confirmar el perfil antes de entrar a Inicio.
«Guardar y comenzar» registra onboardingCompletedAt en DynamoDB; los datos
académicos precargados no completan este paso por sí solos. Si ya tenías un perfil
sin esa marca, se conservan tus ajustes y se pide confirmarlos una vez.
Los accesos siguientes recuperan la marca y permiten entrar directamente.


## Streaming del asistente

El chat usa POST /api/assistant/messages/stream con SSE autenticado. El puente
implementa ConverseStream con frames binarios Bedrock y OpenAI en streaming.
Reinicia npm run dev después de actualizar el puente (no se ejecuta con watch).

«Pensando…» aparece antes del primer fragmento. El icono de envío cambia a
«Detener respuesta». Detener cancela el proveedor y conserva el turno parcial
marcado como interrumpido en el checkpoint. Si una respuesta no pasa el guardrail,
se reemplaza por un aviso de respuesta no verificable. Si falla el modelo, se informa
el fallo de generación. Ambos ofrecen Reintentar; cuando hay resultados por filtros,
«Ver oportunidades del catálogo» los abre por separado con una etiqueta que aclara
que no fueron generados por IA. Los errores de transporte conservan lo recibido
y ofrecen Reintentar. El usuario puede desplazarse hacia arriba sin que los
fragmentos nuevos lo lleven al final.

Verificación real (una consulta OpenAI, corpus ya cargado):
npm --prefix backend run verify:stream. El script usa un turno temporal y lo elimina
después de comprobar el historial en DynamoDB del emulador.
POST /api/assistant/messages sigue disponible como respaldo; el frontend lo usa
solo si la ruta de streaming devuelve 404/405 antes de iniciar el turno.

### Métricas y caché de prompts (F5b)

El chat devuelve los contadores reales del proveedor en meta.usage; no los muestra
en la conversación. El puente traduce cached_tokens de OpenAI a cacheReadInputTokens
sin duplicar la entrada; las escrituras se incluyen si el proveedor las informa.
Los logs assistant.llm.usage contienen solo métricas agregadas.

ASSISTANT_PROMPT_CACHE admite system (predeterminado y activo), system-history
y off. Los prompts están en backend/prompts/assistant.md:
el grafo lo carga al construirse; el idioma se indica por turno después del punto de caché.
El puente traduce cachePoint a un límite explícito de OpenAI en GPT-5.6/GPT-6
compatibles; los demás modelos siguen sin parámetros no soportados. Reinicia
npm run dev tras editar un prompt o actualizar el puente.

Para medir: npm run verify:prompt-cache (cinco inferencias locales; sin crear
vector stores ni conversaciones demo). Guarda solo métricas en el archivo ignorado
local/.state/prompt-cache-report.json. Ver [informe F5b](../docs/benchmarks/prompt-cache.md).

Los prompts de sistema contienen solo instrucciones estables; perfil, documentos
y pregunta quedan después del punto de caché. Cambiar de idioma conserva el mismo prefijo estable.
Que esté activado no garantiza un acierto: las métricas del proveedor indican
lecturas/escrituras reales. Esta actualización se verificó sin llamadas a OpenAI.

### Historial completo y memoria (F5c)

Ejecuta npm run provision para crear Conversations sin TTL. El backend usa
CONVERSATION_HISTORY_TABLE (predeterminado Conversations); ConversationCheckpoints
conserva su TTL operativo de siete días. La expiración del checkpoint no borra el
registro completo. Las preferencias se extraen con reglas controladas, sin llamar
al modelo, y se administran mediante las rutas de memoria de la propia cuenta.

Verificación sin OpenAI: npm run verify:conversations. Usa datos temporales en el
emulador y los limpia. Ver [contrato y límites](../docs/assistant-conversations.md).
Los paneles de lista de conversaciones y memoria corresponden a F6.
