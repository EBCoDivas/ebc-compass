# Despliegue de EBC Compass al lab de AWS

> **Estado:** listo para desplegar, **todavía no desplegado** (aún no hay lab). Todo lo de abajo está preparado y verificado hasta donde se puede sin una cuenta de AWS; la sección [Qué está verificado y qué no](#qué-está-verificado-y-qué-no) dice exactamente cuál es cada caso.

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

# 4. Crear un usuario para entrar al sitio
npm run lab:user -- --confirm
```

Al terminar `lab:deploy` imprime la URL del sitio. Eso es todo: no hay que copiar IDs, editar archivos de configuración ni subir nada a mano.

## Qué hace `npm run lab:deploy -- --confirm`

| # | Paso | Detalle |
|---|---|---|
| 1 | **Cuenta** | Muestra la cuenta, el usuario y la región (`us-east-1`) para que confirmes que es la del lab. Si no hay credenciales, se detiene con instrucciones |
| 2 | **Modelo de Bedrock** | Detecta solo un modelo de texto disponible en la cuenta (prefiere Claude Haiku, luego Amazon Nova Lite/Micro, Claude Sonnet, Nova Pro) probando cada uno con una llamada mínima. Así no hay que saber qué modelo está habilitado. Se puede fijar con `LAB_BEDROCK_MODEL_ID` en `lab/.env` |
| 3 | **SST deploy** | Crea toda la infraestructura (tabla abajo), compila el frontend con la URL del API y la configuración de Cognito, y empaqueta el backend como Lambda |
| 4 | **Conocimiento** | Exporta el corpus (`knowledge/`), lo sube al bucket de documentos, **sincroniza la Knowledge Base** (ingesta con Titan Embeddings V2 → S3 Vectors), espera a que termine y **comprueba que recupera** los documentos esperados con las mismas 10 preguntas de `kb:verify` (umbral 90 %) |
| 5 | **Prueba de humo** | Crea un usuario temporal en Cognito, obtiene un token, prueba el API (sin token debe dar 401; con token: catálogo, asistente en español e inglés con Bedrock, seguimiento, historial, borrado) y el sitio, y borra el usuario |

La segunda vez que lo ejecutes solo actualiza lo que cambió. Opciones: `--skip-knowledge` y `--skip-smoke` (por ejemplo, para redesplegar solo código).

## Qué se despliega

| Recurso | Definición | Para qué |
|---|---|---|
| Amazon Cognito (User Pool + cliente web) | `platform/infra/auth.ts` | Inicio de sesión. El cliente habilita SRP (frontend) y `ADMIN_USER_PASSWORD_AUTH` (solo para `lab:smoke`, que usa credenciales de administrador) |
| API Gateway HTTP API + authorizer JWT | `platform/infra/api.ts` | `ANY /api/{proxy+}` → Lambda del backend (todas las rutas `/api/*`, igual que en local); `GET /health` y `GET /opportunities` siguen como estaban |
| **Lambda del backend** | `platform/infra/backend.ts` + `backend/src/lambda.ts` | El backend Express completo (catálogo, recomendaciones, alertas y asistente con LangGraph). Node 22, 1 GB, 29 s |
| **DynamoDB `ConversationCheckpoints`** | `platform/infra/data.ts` | Conversaciones del asistente (mismo esquema `PK`/`SK` + TTL de 7 días que crea `npm run provision` en local) |
| Knowledge Base de Bedrock + S3 Vectors + bucket de documentos | `platform/infra/knowledge-base.ts` | Conocimiento del asistente (ya existía) |
| **Frontend en S3 + CloudFront** | `platform/infra/site.ts` | El sitio. SST lo compila con `VITE_API_URL`, `VITE_COGNITO_USER_POOL_ID` y `VITE_COGNITO_CLIENT_ID` ya puestos |
| CloudWatch Logs | Funciones y API (1 semana) | Depuración |

## Del entorno local al lab

El código del backend **no cambia**: en local las llamadas de AWS se desvían a un emulador y a un puente; en el lab simplemente no hay desvíos.

| Pieza | Local (`npm run dev`) | Lab (`lab:deploy`) |
|---|---|---|
| LLM del asistente | Puente → OpenAI (`gpt-6-luna`) | **Bedrock Converse** (modelo detectado) |
| Conocimiento | Puente → Vector Store de OpenAI | **Bedrock Knowledge Base** sobre **S3 Vectors** (`Retrieve`) |
| Conversaciones | DynamoDB del AWS Emulator | **DynamoDB** real |
| Backend | Express en `localhost:3000` | La misma app en **Lambda** (`serverless-http`) |
| Identidad del estudiante | `studentId` anónimo del navegador | El **`sub` del token de Cognito** (verificado por API Gateway); el `studentId` que envíe el cliente se ignora, así nadie lee conversaciones ajenas |
| Autenticación | Sin login | **JWT de Cognito** obligatorio en `/api/*` |
| Frontend | Vite en `localhost:5173` | S3 + CloudFront |
| Variables de AWS locales (`AWS_ENDPOINT_URL*`) | Sí | **No existen** en la Lambda |

## Qué se automatiza y qué queda manual

| Antes manual | Ahora |
|---|---|
| Elegir y habilitar un modelo de Bedrock | `lab:check` / `lab:deploy` prueban candidatos y eligen uno que responda |
| Copiar `KNOWLEDGE_BASE_ID`, nombres de tabla y bucket, URLs, IDs de Cognito | SST los conecta entre sí; el frontend se compila con ellos |
| Subir documentos y sincronizar la Knowledge Base | `lab:knowledge` (incluido en `lab:deploy`) con verificación automática |
| Crear un usuario y obtener un token para probar | `lab:user` y `lab:smoke` |
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
| `npm run lab:user -- --confirm [correo]` | Crea o reinicia el usuario de demostración y muestra su contraseña (solo una vez) | Sí |
| `npm run lab:status` | URLs y recursos del despliegue | No |
| `npm run lab:destroy -- --confirm` | Elimina todo (`sst remove`) | Sí |

Configuración opcional en `lab/.env` (se crea con `npm run env:create`): `LAB_STAGE` (por defecto `dev`), `LAB_BEDROCK_MODEL_ID` y `LAB_DEMO_EMAIL`. Las credenciales de AWS **nunca** van en ese archivo.

## Si algo falla

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `No hay credenciales de AWS válidas` | Sesión vencida o sin iniciar | `aws sso login --profile <perfil>` y `export AWS_PROFILE=<perfil>` |
| `Ningún modelo de Bedrock respondió` | Modelos sin acceso en la cuenta | Habilita uno en Bedrock → *Model access* o fija `LAB_BEDROCK_MODEL_ID` |
| `Titan Text Embeddings V2 no responde` | Sin acceso al modelo de embeddings | Habilítalo en Bedrock → *Model access* y ejecuta `npm run lab:knowledge -- --confirm` |
| La recuperación quedó por debajo del 90 % | La sincronización aún no terminó o falló un documento | Revisa el resumen de la ingesta y vuelve a ejecutar `lab:knowledge` |
| El asistente responde "por reglas" con aviso amarillo | Bedrock tardó más de 22 s o falló | Revisa los logs de la función (`BackendFunction` en CloudWatch); prueba otro modelo con `LAB_BEDROCK_MODEL_ID` |
| `AccessDeniedException` de Bedrock en los logs | El modelo no está habilitado o es de otra región | `npm run lab:check` y vuelve a desplegar |
| 401 en el sitio | No iniciaste sesión | `npm run lab:user -- --confirm` y entra con ese correo y contraseña |
| El despliegue falla al crear el sitio | `npm install` del frontend sin red | Reintenta `npm run lab:deploy -- --confirm --skip-knowledge --skip-smoke` |
| Al destruir falla por el bucket | Quedaron objetos | `lab:destroy` ya lo vacía; reintenta |

## Decisiones y límites a tener presentes

- **Tiempo máximo de 30 s.** API Gateway HTTP API corta a los 30 s. La Lambda dura 29 s y el modelo tiene un límite de 22 s (`ASSISTANT_LLM_TIMEOUT_MS`); si lo supera, el asistente responde por reglas con `degraded: true` en vez de fallar. Con un modelo más lento, reduce el razonamiento o elige otro.
- **CORS abierto (`*`).** El origen de CloudFront no se conoce antes de crear el API. No hay cookies y las rutas exigen JWT en el encabezado `Authorization`. Para producción real se acotaría al dominio del sitio.
- **`bedrock:InvokeModel` sobre `*`.** Con perfiles de inferencia entre regiones el ARN depende del modelo elegido. `bedrock:Retrieve` sí está acotado a la Knowledge Base. Para producción conviene limitarlo al modelo elegido.
- **Perfiles en memoria.** `/api/profiles` del backend guarda en memoria de la Lambda (como en local): no persiste entre invocaciones. El perfil del frontend vive en el navegador. No afecta al asistente.
- **Un solo stage (`dev`)** y sin dominio propio (URL de CloudFront).
- **Costos:** bajos (Lambda, DynamoDB bajo demanda, CloudFront, Bedrock por uso, Knowledge Base + S3 Vectors). Elimina todo al terminar con `lab:destroy`.
- **Datos simulados.** El corpus y el catálogo son de demostración; no subas información institucional real.

## Qué está verificado y qué no

| Pieza | Cómo se verificó | Estado |
|---|---|---|
| Handler de Lambda con eventos de API Gateway v2 | `npm run verify:lambda` (cuerpo JSON, identidad por `sub`, aislamiento entre usuarios, borrado, errores 400) | ✅ |
| Paquete de la Lambda | Compilado con esbuild como lo hace SST (ESM + `require` dinámico, 5,6 MB) y ejecutado | ✅ |
| Código de infraestructura (SST) | `npm run platform:typecheck` y pruebas de `platform/` | ✅ Compila; **no se ha ejecutado `sst deploy`** |
| `lab:check` y `lab:deploy` sin credenciales / sin `--confirm` | Con entorno aislado (sin tocar ninguna cuenta) | ✅ Mensajes claros y alto inmediato |
| `lab:user` y llamadas de Cognito | Ensayo contra el AWS Emulator | ✅ |
| `lab:knowledge`: exportar y subir a S3 | Ensayo contra el emulador (24 objetos) | ✅ |
| `lab:knowledge`: ingesta de la Knowledge Base y recuperación | El emulador no implementa bien la respuesta de la ingesta | ⏳ **Solo se puede probar en el lab** |
| `lab:smoke` (login, API, asistente, historial, borrado, sitio) | Ensayo contra el backend local con el LLM y Cognito del emulador | ✅ salvo el 401 sin token, que solo existe con el authorizer del lab |
| Selección automática del modelo de Bedrock | Lógica escrita contra la API de Bedrock | ⏳ **Solo se puede probar en el lab** |
| `sst deploy`, CloudFront, authorizer JWT, permisos de IAM | — | ⏳ **Solo se puede probar en el lab** |

Si algo del último grupo falla en el primer despliegue, es lo esperado de estrenar infraestructura: los mensajes de `lab:*` indican el paso, y la sección "Si algo falla" cubre lo más probable.

## Después del primer despliegue

1. `npm run lab:status` → anota la URL del sitio.
2. `npm run lab:user -- --confirm` → entra con ese usuario y prueba el guion de [docs/demo-script.md](demo-script.md) (el **Perfil** se llena en el sitio; el asistente usa tu sesión).
3. Anota los hallazgos en `docs/plans/plan-asistente-integracion.md` (Fase 7) y ajusta lo que haga falta.
