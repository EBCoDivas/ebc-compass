# Despliegue de EBC Compass al lab de AWS

> **Estado:** desplegado y verificado en un lab real (us-west-2): `lab:deploy`, `lab:personas`, `lab:mcp` y `lab:smoke` pasan. Ver [Lecciones del primer despliegue](#lecciones-del-primer-despliegue).

## En resumen

Cuando tengas acceso a la cuenta del lab:

```sh
# 1. Credenciales de la cuenta del lab (lo único que no se puede automatizar)
aws sso login --profile <perfil-del-lab>        # o exporta AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN
export AWS_PROFILE=<perfil-del-lab>

# 2. Preparar el repo (una vez)
npm run env:create && npm run setup             # instala dependencias de todos los paquetes

# 3. Revisar (solo lectura) y desplegar TODO con un comando
npm run lab:check
npm run lab:deploy -- --confirm

# 4. Registrar las cuentas demo en Cognito
npm run lab:personas -- --confirm
```

Al terminar `lab:deploy` imprime la URL del sitio. Eso es todo: no hay que copiar IDs, editar archivos de configuración ni subir nada a mano.

## Qué hace `npm run lab:deploy -- --confirm`

| # | Paso | Detalle |
|---|---|---|
| 1 | **Cuenta** | Muestra la cuenta, el usuario y la región (`us-east-1`) para que confirmes que es la del lab. Si no hay credenciales, se detiene con instrucciones |
| 2 | **Modelo de Bedrock** | Detecta solo un modelo de texto disponible en la cuenta (prefiere Amazon Nova Lite/Micro, luego Claude Haiku, Claude Sonnet y Nova Pro) probando cada uno con una llamada mínima. Así no hay que saber qué modelo está habilitado. Se puede fijar con `LAB_BEDROCK_MODEL_ID` en `scripts/lab/.env` |
| 3 | **SST deploy** | Crea REST regional y las funciones buffered/streaming, además del resto de la infraestructura (tabla abajo), compila el frontend con la URL del API y la configuración de Cognito, y empaqueta el backend como Lambda. SST declara también STREAM, el URI de invocación streaming y los preflight con authorization/content-type; su deployment incluye todos esos recursos |
| 4 | **Conocimiento** | Exporta el corpus (`knowledge/`), lo sube al bucket de documentos, **sincroniza la Knowledge Base** (ingesta con Titan Embeddings V2 → S3 Vectors), espera a que termine y **comprueba que recupera** los documentos esperados con las mismas 10 preguntas de `kb:verify` (umbral 90 %) |
| 5 | **Prueba de humo** | Crea un usuario temporal en Cognito, obtiene un token, prueba el API (sin token debe dar 401; con token: catálogo, asistente en español e inglés con Bedrock, seguimiento, historial, borrado) y el sitio, y borra el usuario |

La segunda vez que lo ejecutes solo actualiza lo que cambió. Opciones: `--skip-knowledge` y `--skip-smoke` (por ejemplo, para redesplegar solo código).

Con `npm run lab:deploy -- --confirm --skip-smoke --verify-mcp`, el despliegue también registra las cuentas de la historia y prueba sus herramientas en AgentCore Gateway. Para repetir esta verificación sobre un stage desplegado, usa `npm run lab:mcp`. Los permisos y el ensayo local están en la [guía del MCP](student-mcp.md).

## Qué se despliega

| Recurso | Definición | Para qué |
|---|---|---|
| Amazon Cognito (User Pool + cliente web) | `platform/infra/auth.ts` | Inicio de sesión. El cliente habilita SRP (frontend) y `ADMIN_USER_PASSWORD_AUTH` (solo para `lab:smoke`, que usa credenciales de administrador) |
| API Gateway REST regional + authorizer Cognito | `platform/infra/api.ts` | `ANY /api/{proxy+}` → Lambda del backend (todas las rutas `/api/*`, igual que en local); `GET /health` y `GET /opportunities` siguen como estaban |
| **Lambda del backend (buffered)** | `platform/infra/backend.ts` + `backend/src/lambda.ts` | El backend Express completo (catálogo, recomendaciones, alertas y asistente con LangGraph). Node 22, 1 GB, 29 s |
| **DynamoDB `StudentProfiles`** | `platform/infra/data.ts` | Un perfil por sub de Cognito, sin TTL; el backend solo dispone de GetItem/PutItem sobre esta tabla |
| **DynamoDB `ConversationCheckpoints`** | `platform/infra/data.ts` | Conversaciones del asistente (mismo esquema `PK`/`SK` + TTL de 7 días que crea `npm run provision` en local) |
| Knowledge Base de Bedrock + S3 Vectors + bucket de documentos | `platform/infra/knowledge-base.ts` | Conocimiento del asistente (ya existía) |
| **Lambda de streaming** | `backend/src/lambda-stream.ts` + `platform/infra/backend.ts` | Solo POST /api/assistant/messages/stream, runtime Node 22 con streamifyResponse, 90 s |
| **Frontend en S3 + CloudFront** | `platform/infra/site.ts` | El sitio. SST lo compila con `VITE_API_URL`, `VITE_COGNITO_USER_POOL_ID` y `VITE_COGNITO_CLIENT_ID` ya puestos |
| CloudWatch Logs | Funciones y API (1 semana) | Depuración |

## Del entorno local al lab

El código del backend **no cambia**: en local las llamadas de AWS se desvían a un emulador y a un puente; en el lab simplemente no hay desvíos.

| Pieza | Local (`npm run dev`) | Lab (`lab:deploy`) |
|---|---|---|
| LLM del asistente | Puente → OpenAI (`gpt-6-luna`) | **Bedrock Converse** (modelo detectado) |
| Conocimiento | Puente → S3 Vectors del emulador (embeddings de OpenAI con el contrato de Titan v2) | **Bedrock Knowledge Base** sobre **S3 Vectors** (`Retrieve`) |
| Conversaciones | DynamoDB del AWS Emulator | **DynamoDB** real |
| Backend | Express en `localhost:3000` | La misma app en **Lambda** (`serverless-http`) |
| Identidad del estudiante | `sub` del JWT de Cognito del emulador, verificado por el backend | El **`sub` del token de Cognito** (verificado por API Gateway); el `studentId` que envíe el cliente se ignora, así nadie lee conversaciones ajenas |
| Autenticación | Login con correo/contraseña; JWT obligatorio en rutas de negocio | **JWT de Cognito** obligatorio en `/api/*` |
| Frontend | Vite en `localhost:5173` | S3 + CloudFront |
| Variables de AWS locales (`AWS_ENDPOINT_URL*`) | Sí | **No existen** en la Lambda |

## Login y cuentas demo en el lab (F3b)

1. Inicia sesión en AWS con el perfil autorizado y ejecuta `npm run lab:check`.
2. Ejecuta `npm run lab:deploy -- --confirm` para desplegar o actualizar el pool, su cliente y los atributos académicos declarados en `platform/infra/auth.ts`. Si solo actualizas código/configuración y ya tienes la Knowledge Base cargada, puedes usar `--skip-knowledge`; no omitas el despliegue del esquema antes de registrar las personas.
3. Ejecuta `npm run lab:personas -- --confirm`. Registra las personas de `shared/personas.json` y retira las cuentas de Compass obsoletas del pool del stage seleccionado.
4. Si configuraste el [acceso del jurado](guia-jurado.md), usa el panel de inicio de sesión. Con el panel apagado, consulta el registro privado `scripts/lab/.state/personas.json` en la computadora donde ejecutaste el comando.
5. Ejecuta `npm run lab:status`, abre la URL del sitio y entra por `/acceso` con una de esas cuentas. Para cambiar de persona, usa **Cerrar sesión** y entra con otra cuenta.

El login del sitio usa SRP contra Cognito de AWS. API Gateway valida el JWT y el backend toma la identidad del `sub` verificado; `POST /api/dev/session` es exclusivo del servidor local y no existe en Lambda. SST proporciona al frontend la URL del API y los IDs públicos de Cognito. No hay que copiar el archivo local `cognito.json`, ni habilitar el login del emulador en el lab.

**Persistencia.** Las cuentas viven en Cognito de AWS y sobreviven a reinicios del navegador o del backend. Si se configura `JURY_DEMO_PASSWORD`, el comando la aplica a las cuentas ficticias aunque ya existan. Para retirar el acceso compartido, apaga el panel, quita la variable, vuelve a ejecutar `lab:personas` para rotar las contraseñas y recompila el sitio. Sin contraseña compartida ni registro privado, el comando restablece las contraseñas individuales: coordínalo con el equipo. Eliminar el pool elimina las cuentas. Los tokens en el navegador son temporales y el historial sigue sujeto al TTL de sus checkpoints.

**Separación de entornos.** `local/.state/cognito.json` corresponde al emulador; `scripts/lab/.state/personas.json` corresponde al lab. Son registros distintos. En el lab, el asistente usa Bedrock y su Knowledge Base, por lo que no necesita la API key ni el vector store de OpenAI de tu entorno local.

**Estado de validación.** El login y el aislamiento se probaron con JWT firmados del emulador. El comando de cuentas y el esquema SST compilan; aún falta ejecutarlos y validar SRP/atributos en el lab. Estos pasos describen el flujo preparado, no un despliegue ya realizado.

## Perfiles persistentes por cuenta

En el primer acceso, las cuentas sin onboardingCompletedAt entran primero a Perfil. El botón «Guardar y comenzar» confirma la configuración y registra esa fecha en DynamoDB; los siguientes accesos entran a Inicio. Los perfiles anteriores sin marca conservan sus ajustes y solicitan confirmación una vez. Intereses, preferencias y metas siguen siendo opcionales.

Los endpoints existentes GET/POST /api/profiles usan exclusivamente el sub verificado del JWT. GET conserva el contrato de arreglo (vacío o con el perfil de la sesión); POST crea o actualiza el mismo registro y devuelve 201 con el perfil guardado. Se conserva también preferences y updatedAt. No se acepta un ID del navegador para leer/escribir otra cuenta. Una sesión ausente devuelve 401; un fallo de DynamoDB devuelve 503 sin confirmar el guardado.

Al entrar desde otro navegador se recupera la personalización de DynamoDB. Si aún no existe un registro remoto y este navegador conserva ajustes de la misma cuenta, se migran automáticamente al servidor al cargar la sesión. Los datos académicos emitidos por Cognito mantienen prioridad; las guardadas del catálogo continúan siendo locales al navegador.

Validación local: npm --prefix backend run verify:profiles comprueba persistencia con otra instancia del servidor y aislamiento entre identidades, usando registros temporales en el emulador. La tabla del lab está declarada en SST; no se ha desplegado ni probado en AWS real.

## Streaming y migración a REST (F5)

El lab pasa a un único REST API regional. Esto cambia la URL del API e incluye las rutas del equipo /health y /opportunities; coordina el despliegue con el equipo y usa el frontend recompilado con la nueva URL. Las rutas normales van al handler buffered y POST /api/assistant/messages/stream a una segunda Lambda con streamifyResponse. Cognito User Pools valida los ID tokens; el backend admite authorizer.claims de REST y el formato JWT anterior.

La plataforma fija SST 4.17.2 y el proveedor AWS de Pulumi 7.55.0. La ruta usa la opción nativa `streaming: true` de SST, que declara `responseTransferMode: STREAM` y el URI `/response-streaming-invocations`. Un transform de las respuestas CORS del API permite `authorization,content-type` explícitamente. SST incluye la integración y los preflight en las dependencias y los triggers de su deployment: tanto `sst deploy` como `lab:deploy` configuran la infraestructura completa, sin parches por SDK después del despliegue. `lab:deploy` instala los proveedores fijados antes de desplegar. La prueba de humo exige SSE con fragmentos, done y ausencia de eventos error.

La cancelación inmediata del proveedor y el guardado parcial están probados con HTTP local. API Gateway puede mantener Lambda en ejecución tras desconectarse el navegador; ese comportamiento debe verificarse en el lab y no se afirma cancelación remota garantizada. El turno parcial se guarda con interrupted en el checkpoint operativo y en el registro completo sin TTL de F5c.

Referencias: [streaming en REST](https://docs.aws.amazon.com/apigateway/latest/developerguide/response-transfer-mode.html) y [configuración de la integración Lambda](https://docs.aws.amazon.com/apigateway/latest/developerguide/response-streaming-lambda-configure.html). La configuración SST compila, pero no se ha desplegado ni probado contra AWS real.

### Stages existentes: migración de SST 3 a SST 4

Un stage nuevo no requiere migración. Si el lab ya fue desplegado con SST 3, antes de actualizarlo sigue la [guía oficial de SST](https://sst.dev/docs/migrate-from-v3/). Revisa primero el diff y después refresca el estado completo de cada stage, sin `--target`:

```sh
cd platform
npm ci
npm run install:providers
# Usa el mismo modelo del despliegue anterior.
export BEDROCK_MODEL_ID=<modelo-del-stage>
npx sst diff --stage <stage-del-lab>
npx sst refresh --stage <stage-del-lab>
```

Después ejecuta `lab:deploy` con `LAB_STAGE` apuntando al mismo stage. `sst refresh` actualiza el estado del despliegue; no se ejecuta automáticamente desde `lab:deploy`. Los nombres de la aplicación y de los recursos existentes se conservan. La sustitución del HTTP API por REST se revisa en el diff. La migración no se ha ejecutado desde este entorno.

## Qué se automatiza y qué queda manual

| Antes manual | Ahora |
|---|---|
| Elegir y habilitar un modelo de Bedrock | `lab:check` / `lab:deploy` prueban candidatos y eligen uno que responda |
| Copiar `KNOWLEDGE_BASE_ID`, nombres de tabla y bucket, URLs, IDs de Cognito | SST los conecta entre sí; el frontend se compila con ellos |
| Subir documentos y sincronizar la Knowledge Base | `lab:knowledge` (incluido en `lab:deploy`) con verificación automática |
| Registrar cuentas demo y obtener un token para probar | `lab:personas` (las personas demo), `lab:user` (una cuenta independiente) y `lab:smoke` (temporal) |
| Comprobar que todo funciona | `lab:smoke` |
| Borrar todo al terminar | `lab:destroy` (vacía el bucket primero) |

**Lo único que sigue siendo manual:**

1. **Tener credenciales de AWS de la cuenta del lab.** No se pueden generar desde aquí.
2. **Solo si ningún modelo responde:** habilitar el acceso a uno en la consola de Amazon Bedrock (*Model access*). Con modelos de Anthropic, AWS puede pedir por única vez un formulario de caso de uso. `lab:deploy` prueba Amazon Nova como alternativa, que no lo necesita.
3. **Permisos amplios del que despliega.** SST crea roles de IAM, CloudFront, Lambda, DynamoDB, Cognito y Bedrock, así que se recomienda `AdministratorAccess` en la cuenta del lab.

## Comandos

| Comando | Qué hace | ¿Cambia la nube? |
|---|---|---|
| `npm run lab:check` | Revisa credenciales, Node, modelo de Bedrock y Titan Embeddings | No |
| `npm run lab:deploy -- --confirm` | Todo el flujo de arriba | Sí |
| `npm run lab:knowledge -- --confirm` | Solo actualiza documentos, sincroniza y verifica la Knowledge Base | Sí |
| `npm run lab:smoke -- --confirm` | Prueba de humo (usuario temporal) | Crea y borra un usuario |
| `npm run lab:personas -- --confirm` | Registra las personas demo y guarda credenciales privadas en `scripts/lab/.state/personas.json` | Sí |
| `npm run lab:user -- --confirm [correo]` | Crea o reinicia el usuario de demostración y muestra su contraseña (solo una vez) | Sí |
| `npm run lab:status` | URLs y recursos del despliegue | No |
| `npm run lab:destroy -- --confirm` | Elimina todo (`sst remove`) | Sí |

Configuración opcional en `scripts/lab/.env` (se crea con `npm run env:create`): `LAB_STAGE` (por defecto `dev`), `LAB_BEDROCK_MODEL_ID` y `LAB_DEMO_EMAIL`. Las credenciales de AWS **nunca** van en ese archivo.

## Si algo falla

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `No hay credenciales de AWS válidas` | Sesión vencida o sin iniciar | `aws sso login --profile <perfil>` y `export AWS_PROFILE=<perfil>` |
| `Ningún modelo de Bedrock respondió` | Modelos sin acceso en la cuenta | Habilita uno en Bedrock → *Model access* o fija `LAB_BEDROCK_MODEL_ID` |
| `Titan Text Embeddings V2 no responde` | Sin acceso al modelo de embeddings | Habilítalo en Bedrock → *Model access* y ejecuta `npm run lab:knowledge -- --confirm` |
| La recuperación quedó por debajo del 90 % | La sincronización aún no terminó o falló un documento | Revisa el resumen de la ingesta y vuelve a ejecutar `lab:knowledge` |
| El asistente muestra «No pudimos generar la respuesta» | Bedrock falló o superó el tiempo del proveedor | Revisa los logs de la función (`BackendFunction` en CloudWatch); prueba otro modelo con `LAB_BEDROCK_MODEL_ID` |
| `AccessDeniedException` de Bedrock en los logs | El modelo no está habilitado o es de otra región | `npm run lab:check` y vuelve a desplegar |
| 401 en el sitio | No iniciaste sesión o el token expiró | Entra en `/acceso` con las credenciales de `scripts/lab/.state/personas.json`; si faltan cuentas, ejecuta `lab:personas -- --confirm` |
| Error de atributo personalizado al registrar personas | El pool todavía no tiene el esquema de F3b | Despliega primero la infraestructura actual y después ejecuta `lab:personas` |
| El despliegue falla al crear el sitio | `npm install` del frontend sin red | Reintenta `npm run lab:deploy -- --confirm --skip-knowledge --skip-smoke` |
| Al destruir falla por el bucket | Quedaron objetos | `lab:destroy` ya lo vacía; reintenta |

## Decisiones y límites a tener presentes

- **Tiempos distintos por ruta.** La función buffered conserva 29 s y un límite de modelo de 22 s. La función streaming usa 90 s y un límite de modelo de 60 s. La respuesta SSE inicia con metadatos antes de la generación. Si el proveedor falla, el chat informa el fallo y ofrece Reintentar. Si el guardrail rechaza la generación, muestra un aviso de respuesta no verificable. Las oportunidades del catálogo se ofrecen aparte bajo una acción explícita, identificadas como resultados por filtros. Los turnos llevan failure y modo error, también en el historial.
- **CORS abierto (`*`).** El origen de CloudFront no se conoce antes de crear el API. No hay cookies y las rutas exigen JWT en el encabezado `Authorization`. Para producción real se acotaría al dominio del sitio.
- **`bedrock:InvokeModel` sobre `*`.** Con perfiles de inferencia entre regiones el ARN depende del modelo elegido. `bedrock:Retrieve` sí está acotado a la Knowledge Base. Para producción conviene limitarlo al modelo elegido.
- **Perfiles persistentes.** La tabla `StudentProfiles` guarda nombre preferido, intereses, preferencias, materias y metas por `sub` autenticado, sin TTL. El navegador carga el perfil antes de mostrar las pantallas y mantiene una caché por cuenta. El formulario confirma el guardado antes de navegar. En el lab sobrevive a reinicios de Lambda y se recupera desde otro navegador; requiere desplegar la nueva tabla y permisos. La persistencia completa del historial del asistente sigue siendo una tarea distinta.
- **Un solo stage (`dev`)** y sin dominio propio (URL de CloudFront).
- **Costos:** bajos (Lambda, DynamoDB bajo demanda, CloudFront, Bedrock por uso, Knowledge Base + S3 Vectors). Elimina todo al terminar con `lab:destroy`.
- **Datos simulados.** El corpus y el catálogo son de demostración; no subas información institucional real.

## Qué está verificado y qué no

| Pieza | Cómo se verificó | Estado |
|---|---|---|
| Handler buffered con eventos API Gateway v1/v2 | `npm run verify:lambda` (cuerpo JSON, identidad por `sub`, aislamiento entre usuarios, borrado, errores 400) | ✅ |
| Handler streaming y lector SSE | Pruebas de runtime Lambda simulado, frames partidos/UTF-8, guardrail y cancelación por HTTP; prueba local real con SDK Bedrock y DynamoDB | ✅ Local; pendiente API Gateway real |
| Paquete de la Lambda | Compilado con esbuild como lo hace SST (ESM + `require` dinámico, 5,6 MB) y ejecutado | ✅ |
| Código de infraestructura (SST) | `npm run platform:typecheck` y pruebas de `platform/` | ✅ Compila; **no se ha ejecutado `sst deploy`** |
| `lab:check` y `lab:deploy` sin credenciales / sin `--confirm` | Con entorno aislado (sin tocar ninguna cuenta) | ✅ Mensajes claros y alto inmediato |
| `lab:personas` y esquema de atributos de F3b | Comprobación de tipos; creación de las cuentas demo ensayada en el emulador | ⏳ Registro de cuentas y login SRP pendientes de probar en el lab |
| `lab:user` y llamadas de Cognito | Ensayo contra el AWS Emulator | ✅ |
| `lab:knowledge`: exportar y subir a S3 | Ensayo contra el emulador (24 objetos) | ✅ |
| `lab:knowledge`: ingesta de la Knowledge Base y recuperación | El emulador no implementa bien la respuesta de la ingesta | ⏳ **Solo se puede probar en el lab** |
| `lab:smoke` (login, API, asistente, historial, borrado, sitio) | Ensayo contra el backend local con el LLM y Cognito del emulador | ✅ incluido el rechazo sin token en el servidor local de F3b; las configuraciones reales del authorizer y CORS del REST siguen pendientes del lab |
| Selección automática del modelo de Bedrock | Lógica escrita contra la API de Bedrock | ⏳ **Solo se puede probar en el lab** |
| `sst deploy`, CloudFront, authorizer JWT, permisos de IAM | — | ⏳ **Solo se puede probar en el lab** |

Si algo del último grupo falla en el primer despliegue, es lo esperado de estrenar infraestructura: los mensajes de `lab:*` indican el paso, y la sección "Si algo falla" cubre lo más probable.

## Después del primer despliegue

1. `npm run lab:status` → anota la URL del sitio.
2. `npm run lab:personas -- --confirm` → consulta sus credenciales privadas, entra con una persona y prueba el guion de [docs/demo-script.md](demo-script.md) (el **Perfil** se llena en el sitio; el asistente usa tu sesión).
3. Anota los hallazgos en `docs/plans/plan-asistente-integracion.md` (Fase 7) y ajusta lo que haga falta.

## Métricas y caché de prompts (F5b)

SST inyecta ASSISTANT_PROMPT_CACHE en ambas funciones: system (predeterminado),
system-history u off. Usa el mismo valor al desplegar directamente con SST o mediante
lab:deploy. No requiere nuevos recursos ni permisos. Solo se envían checkpoints
a modelos de la lista conservadora del adaptador; el resto funciona sin ellos.

Al cambiar de modelo, comprobar su mínimo de prefijo y las métricas reales
en CloudWatch (evento assistant.llm.usage) y meta.usage de la respuesta. El tamaño
total de la petición no basta para probar que el sistema sea cacheable. La caché está habilitada por defecto en código; no se han desplegado cambios
en AWS desde esta fase. La muestra histórica de prompt corto no aplica al nuevo
prompt Markdown. Las lecturas reales siguen sujetas al modelo, mínimo y TTL. Ver [informe y reproducción](benchmarks/prompt-cache.md).

### Prompt de sistema único en español

backend/prompts/assistant.md contienen las instrucciones
estables basadas en los specs y en el alcance actual. Se carga una sola vez al
construir el grafo; el idioma detectado o solicitado explícitamente se envía
como una instrucción posterior al checkpoint, sin cambiar el prefijo estable. Hay que reiniciar el backend o redesplegar para recargarlos.

SST copia la carpeta a prompts/ dentro de ambas Lambdas y fija
ASSISTANT_PROMPTS_DIR=/var/task/prompts. El perfil y los pasajes no se insertan en
el archivo estático. El checkpoint predeterminado queda después del sistema.
El selector automático de modelos prefiere Nova Lite/Micro, compatibles con
checkpoints de prefijo de 1024 tokens; un modelo fijado con LAB_BEDROCK_MODEL_ID
conserva prioridad. Los modelos no compatibles no reciben parámetros que rechacen.
No se promete ahorro en todos los turnos ni se ha medido un acierto en AWS real.

## Registro completo y memoria (F5c)

SST crea Conversations sin TTL y pasa CONVERSATION_HISTORY_TABLE a ambas Lambdas.
ConversationCheckpoints conserva el TTL de siete días. La tabla nueva tiene
permisos GetItem, PutItem, Query y BatchWriteItem acotados a su ARN; las escrituras
transaccionales se autorizan con los permisos de los ítems, sin inventar una
acción IAM TransactWriteItems. No se ejecutó este despliegue en AWS real.

GET/POST/PATCH/DELETE de conversaciones y GET/PUT/DELETE de memoria quedan bajo el
mismo authorizer Cognito. Las rutas REST se declaran explícitamente para que los
recursos hijos no oculten los métodos del padre. El mantenimiento se espera tras
cerrar la respuesta, también en el handler Lambda de streaming. No agrega
llamadas al modelo. Ver [contrato y validación local](assistant-conversations.md).

## Lecciones del primer despliegue

- **Región:** se toma de `LAB_REGION`, si no del perfil/`AWS_REGION` y, en último caso, `us-east-1`. Una región inválida en el perfil (por ejemplo `us-west-2"` con comilla) ahora detiene el despliegue con un error claro. Los labs de Workshop Studio solo permiten ciertas regiones: usa la que muestra el lab.
- **Permisos del lab:** si `sst deploy` falla con `ssm:GetParameter /sst/bootstrap` AccessDenied, la cuenta aún no tiene permisos. Comprueba con `aws dynamodb list-tables` antes de desplegar; si falla, espera o abre otro lab.
- **Credenciales:** usa un perfil (`AWS_PROFILE=lab`) en lugar de variables exportadas, para no chocar con tu sesión SSO.
- **Bundles ESM:** SST ya inyecta `require`; no declares un banner propio con `createRequire` (rompe el arranque de la Lambda con `Identifier 'require' has already been declared`).
- **S3 Vectors:** el nombre del bucket debe ir en minúsculas (3–63) y la Knowledge Base recibe solo `indexArn`.
- **Smoke:** `npm run lab:smoke -- --confirm`.
- **Cuentas del jurado:** `JURY_DEMO_ENABLED=true` y `JURY_DEMO_PASSWORD` en `scripts/lab/.env` (no versionado) habilitan el panel de cuentas en `/acceso`.

## Cambiar los modelos del chat (Lunna y Terra)

Por omisión `lab:deploy` elige un solo modelo (Nova Lite/Micro, Claude Haiku/Sonnet, Nova Pro; el primero que responda) y se lo da a Lunna y a Terra. El selector del chat y la traza de admin muestran el nombre del modelo configurado; si ambos son iguales, se muestra uno solo y sin selector.

Si un lab nuevo abre más modelos:

1. `npm run lab:models` prueba qué modelos responden en la cuenta (solo lectura). `-- openai` filtra por texto y `-- --all` muestra los bloqueados con el motivo.
2. Pega en `scripts/lab/.env` los ids que quieras:
   ```
   BEDROCK_LUNNA_MODEL_ID=<id rápido>
   BEDROCK_TERRA_MODEL_ID=<id con más detalle>
   ```
3. Redespliega con `npm run lab:deploy -- --confirm --skip-knowledge --skip-smoke`.

Los modelos de OpenAI propietarios (gpt-5.x, gpt-6.x) requieren una suscripción de AWS Marketplace: si el lab niega `aws-marketplace:Subscribe`, `lab:models` los marca como bloqueados (algunos responden una vez y luego se bloquean; la prueba lo confirma con una segunda llamada). Los modelos abiertos (`openai.gpt-oss-*`, Qwen, Mistral…) no lo necesitan.
