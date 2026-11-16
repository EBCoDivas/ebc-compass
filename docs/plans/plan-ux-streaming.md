# Plan: streaming, identidad visual y UX del chat, personas demo y datos más cercanos a EBC

- **Rama:** `feature/assistant-ux-refresh` (desde `main` en `86b7d14`)
- **Estado:** borrador para aprobar · **Fecha:** 2026-11-16
- **Insumos:** auditoría visual de la app (capturas de Inicio, Oportunidades y Asistente en 1280 px y móvil), lectura de las páginas públicas de EBC (becas, trámites, vinculación, campus, programas) y [propuesta visual](../ux/propuesta-visual.html) con logo, favicon y paleta (v2 «Aurora»; carpeta [docs/ux/brand](../ux/brand/)).

## 1. Qué se pidió y esfuerzo estimado

| # | Pedido | Fase | Esfuerzo |
|---|---|---|---|
| 1 | Sistema visual nuevo (paleta fuera del negro institucional, pero reconocible como EBC), logo y favicon propios | F1 | 8–10 h |
| 2 | Chat más grande + respuestas con **Markdown renderizado** | F2 | 8–10 h |
| 3 | **Personas demo** (≈8 usuarios de distintas carreras) y forma de cambiarlas | F3 | 6–8 h |
| 4 | Datos mock más cercanos a la realidad de EBC (catálogo y corpus) | F4 | 10–14 h |
| 5 | **Streaming** de las respuestas del chat (incluye pasar el lab a **API Gateway REST**) | F5 | 22–28 h |
| 5b | **Caché de prompts** del modelo para ahorrar tokens | F5b | 4–6 h |
| 5c | **Seguridad con Cognito simulada en local** (tokens JWT reales firmados) | F3b | 8–10 h |
| 5d | **Persistencia de conversaciones** (historial completo, varias conversaciones por persona, resumen compactado) y **memoria a largo plazo** del alumno | F5c | 14–20 h |
| 6 | Ajustes de UX/UI en Inicio, Oportunidades, Perfil, Calendario y chat | F6 | 12–16 h |
| 7 | Verificación, documentación y PR | F7 | 5–7 h |
| | **Total** | | **≈ 97–129 h** |

La parte más incierta es el **streaming**: obliga a cambiar el puente local y a mover el lab de API Gateway HTTP API (que no transmite) a **REST API** (ver 4.5).

## 2. Hallazgos de la auditoría (qué se ve hoy)

**Chat** (el punto más débil)
- El encabezado de la página ocupa ~330 px y deja una tarjeta de ~500 px de alto y ~860 px de ancho: se siente pequeño aunque la pantalla sea grande.
- Estado vacío casi vacío (un saludo y tres botones); sin contexto de quién eres ni de qué se puede preguntar.
- Respuestas en texto plano: `**negritas**`, listas y enlaces llegan en bruto (el prompt pide "texto plano" y las plantillas usan `•`).
- Sin "Detener", copiar, regenerar ni retroalimentación; el campo es de una línea; la respuesta aparece de golpe tras 3–8 s.

**Inicio / Oportunidades**
- Todo es blanco, gris y negro: no hay jerarquía visual; los tipos de oportunidad solo se distinguen por una etiqueta gris.
- **Fechas inconsistentes:** Inicio usa `25/11/2026`, Oportunidades usa `2026-12-15`.
- Los eventos dicen "Fecha límite" (debería ser "Fecha"); "Procedimientos" en vez de "Trámites".
- Tarjetas de alturas distintas; botón "Volver a Inicio" redundante con la navegación; solo hay un filtro por tipo (sin carrera, campus ni orden por fecha); sin vacíos ni cargas elegantes.
- El resumen "Mi perfil" siempre muestra a Valerie (`simulatedAcademicData` es una constante), sin importar el perfil guardado.

**General**
- Sin favicon, sin `document.title` por ruta, sin enlace "saltar al contenido".
- Los datos mock usan 6 campus y 4 carreras; EBC tiene 14 campus y 8 licenciaturas (ver sección 6).

*Pendiente de revisión visual en la implementación: Perfil y Calendario (ya capturados).*

## 3. Identidad visual propuesta: v2 «Aurora» (ver la vista previa)

Se pidió algo **fresco y nuevo que se sienta parte de EBC**. La v1 «Brújula» (teal, oro y arena) se archivó en `docs/ux/propuesta-visual-v1.html`; la v2 se apoya más en el ADN real de EBC.

**Paleta**, con los colores del sitio de EBC como base (azul `#004A98`, cian `#0098D6`, lima `#9BC31B`, dorado `#F7AC14`) y usos nuevos:

| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `--navy` | `#0B2F6B` | Marca, texto fuerte, encabezados | 12.0:1 sobre neblina |
| `--blue` | `#004A98` | Acción principal y enlaces (azul EBC) | 8.6:1 con blanco |
| `--grad` | `#0098D6 → #9BC31B` | **Firma de marca:** línea del encabezado, progreso, acentos; solo decorativo | — |
| `--gold` | `#F7AC14` | Becas y avisos | — |
| `--coral` | `#E5533D` | Urgencias (≤ 3 días): bordes y barras; el texto usa `#A3321F` | 5.9:1 el texto |
| `--mist` | `#F3F7FB` | Fondo de página (frío y limpio, no gris neutro) | — |
| `--cyan-soft` / `--lime-soft` / `--gold-soft` / `--coral-soft` | `#E1F3FB` / `#F1F7DD` / `#FFF3D1` / `#FDE8E4` | Chips y paneles | — |
| `--lime-dark` | `#587A0B` | Texto sobre lima suave | 4.5:1 |

**Qué cambia frente a hoy:** el **negro institucional** del encabezado y de los botones se reemplaza por **encabezado claro con una línea degradada** y botón azul EBC; sigue siendo reconocible como EBC (su azul, su cian, su lima) pero se ve más actual.

**Tipografía:** **Sora** (geométrica, moderna) para títulos y cifras; **Inter** para texto; y **EB Garamond cursiva** (la serif de EBC) solo como acento en una palabra de los títulos ("Tu guía *académica*…"): el guiño institucional.

**Tipos de oportunidad** (color + ícono + texto, nunca solo color): curso cian, beca dorado, evento lima, trámite coral, desarrollo profesional azul EBC, empleo navy.

**Logo y favicon:** una **rosa de los vientos** sobre el degradado de EBC, con el norte en navy; el wordmark combina "EBC" en Sora y "Compass" en Garamond cursiva. Es redondo, se lee a 16 px y se distingue del logotipo de EBC sin desentonar. *Debe validarse con el área de marca de EBC.* Archivos en `docs/ux/brand/` (`ebc-compass-logo.svg`, `ebc-compass-mark.svg`, `favicon.svg`).

## 4. Diseño técnico por frente

### 4.1 Markdown en el chat (F2)
- **Frontend:** `react-markdown` + `remark-gfm` (listas, negritas, enlaces, tablas simples). Sin HTML crudo (seguro por defecto); enlaces con `target="_blank" rel="noopener noreferrer"`; estilos propios para listas, énfasis y código; encabezados limitados.
- **Backend:** el prompt pasa de "texto plano" a "Markdown simple (negritas, listas con `-`, sin encabezados ni tablas)"; las plantillas del modo reglas dejan de usar `•` y emiten listas Markdown para que se vean igual con o sin LLM. El guardrail sigue validando datos (los asteriscos no cambian su lógica).
- El historial guardado y el que devuelve `GET /conversations/:id` ya traen Markdown; se renderiza igual al recargar.

### 4.2 Layout del chat (F2)
- Pantalla casi completa (altura de la ventana menos encabezado), ancho hasta ~1100 px, **panel lateral** con la persona activa, temas de los que puede hablar y aviso de "respuestas orientativas"; en móvil el panel pasa a un encabezado colapsable.
- Campo de varias líneas que crece (Enter envía, Shift+Enter nueva línea), contador discreto, botones **Copiar**, **Regenerar** y 👍/👎 (solo estado local por ahora), sugerencias como tarjetas, y encabezado de la página reducido.

### 4.3 Personas demo (F3)
Hoy el "token" simulado es la constante `simulatedAcademicData` (Valerie). Propuesta:
- **Selector "Ver como…"** en el encabezado (solo con `VITE_DEMO_PERSONAS=true`; activo en local y apagado en el sitio del lab, salvo que se pida). Al elegir una persona se guardan su perfil, su `studentId` propio (cada persona tiene su conversación) y un **token simulado sin firma** cuyos *claims* imitan lo que entregaría Cognito (`name`, `custom:matricula`, `custom:campus`, `custom:programa`, `custom:semestre`). Así el código usa la misma ruta que usará con un token real: `academicDataFromClaims(token)` reemplaza a la constante.
- **Atajos:** `?persona=diego` en la URL (para compartir una vista) y `VITE_DEFAULT_PERSONA` para el arranque. Cambiar solo por variable de entorno obligaría a reiniciar Vite, por eso no es el mecanismo principal.
- **Definición única** en `shared/personas.json` (la leen el frontend y los scripts de verificación del backend). Incluye una persona **sin perfil** para probar el onboarding.

| Persona | Programa | Campus | Periodo | Para probar |
|---|---|---|---|---|
| Valerie Martínez (la actual) | Finanzas y Banca | CDMX | 2.º sem. | Nuevo ingreso, becas |
| Diego Ramírez | Mercadotecnia | Guadalajara | 5.º | FiT EBC, prácticas, microcredenciales |
| Ana Lucía Torres | Contaduría | Querétaro | 7.º | Impuestos, servicio social, titulación próxima |
| Carlos Mendoza | Comercio y Negocios Internacionales | CDMX Sur | 6.º | Relaciones internacionales, Global EBC |
| Sofía Herrera | Derecho | Toluca | 9.º | Titulación electrónica, cédula, prácticas finales |
| Mariana Ortiz | Adm. de Negocios Turísticos | Cancún | 4.º | Campus distinto, empleabilidad local |
| Javier Núñez | Lic. Ejecutiva en Programación y Transformación Digital | León | 3.er periodo | Modalidad ejecutiva, horarios |
| Laura Estrada | Maestría en Dirección Financiera | CDMX | 2.º trimestre | Posgrado, becas de excelencia |
| *(sin perfil)* | — | — | — | Onboarding y estados vacíos |

### 4.4 Datos mock más cercanos a EBC (F4) — ver sección 6.

### 4.5 Streaming (F5)

**Eventos y endpoint.** `POST /api/assistant/messages/stream` responde `text/event-stream` con: `meta` (conversación, idioma, intent, fuentes), `token` (fragmentos), `replace` (sustituye el texto si el guardrail lo rechaza), `done` (respuesta final y métricas) y `error`. Se consume con `fetch` + `ReadableStream` (EventSource no admite POST). El endpoint actual no streaming se **conserva** como respaldo.

**Piezas y esfuerzo**

| Pieza | Qué cambia | Esfuerzo |
|---|---|---|
| Puente local | Nuevo `converse-stream`: traduce `stream: true` de OpenAI al **event-stream binario** de Bedrock (`contentBlockDelta`, `messageStop`…) con los codecs que ya trae el SDK | 5–6 h |
| Backend | El nodo `generate` usa `ChatBedrockConverse.stream()` y emite eventos con `config.writer` (`streamMode: custom`); ruta SSE con cancelación (`AbortSignal` si el cliente cierra) | 5–6 h |
| Guardrail | Estrategia de validación con streaming (abajo) | 2–3 h |
| Frontend | Lector SSE, render incremental de Markdown (limitado por `requestAnimationFrame`), autoscroll que respeta si el usuario subió, **Detener**, "Pensando…" antes del primer token, error a mitad de respuesta (se conserva lo recibido + Reintentar), `aria-busy` y anuncio al terminar (no por token) | 4–5 h |
| Lab (AWS) | Streaming real: ver abajo | 4–6 h |

**Decisión de guardrail (recomendada A):**
- **A. Transmitir y validar al final.** Los tokens salen en vivo; al terminar se valida. Si falla, llega `replace` con la respuesta por reglas y un aviso. Ventaja: latencia mínima. Riesgo: durante unos segundos el usuario pudo ver un dato no respaldado.
- **B. Validar por oración** (retener hasta cerrar cada oración): más seguro, menos fluido.
- **C. No transmitir cuando el intent trae datos sensibles.**
Se propone A con las reglas actuales (códigos, fechas, montos y porcentajes) y B solo si la demo lo exige.

**Lab: API Gateway REST API (decisión tomada).** El HTTP API actual no transmite respuestas; el **REST API** sí, con *response transfer mode* `STREAM` en integraciones proxy (según la documentación de AWS: solo `AWS_PROXY`/`HTTP_PROXY`, el URI de la Lambda debe terminar en `/response-streaming-invocations`, la función debe usar el formato de streaming, no hay caché de endpoint con streaming y no existe streaming de la petición). Implica:
- **Migrar el API del lab de HTTP API a REST API** (`sst.aws.ApiGatewayV1`) con **authorizer de Cognito (User Pools)**, que es nativo en REST. Hay que **decidir si todo `/api/*` se migra** (recomendado: una sola URL) o si conviven dos APIs.
- **Dos funciones:** la actual con `serverless-http` (respuestas normales) y una nueva con `streamifyResponse` solo para `POST /api/assistant/messages/stream`.
- **Cambia el formato del evento:** REST usa payload v1, así que la identidad sale de `requestContext.authorizer.claims.sub` (hoy se lee `authorizer.jwt.claims.sub` de HTTP API). Se leerán ambos.
- **CORS** hay que declararlo en REST (respuestas `OPTIONS` y encabezados), y `GET /health`/`/opportunities` del equipo se mueven con el resto.
- **Por verificar antes de implementar:** que SST exponga `responseTransferMode` (si no, con *transform* de Pulumi), los límites exactos de tiempo y tamaño del streaming y que el authorizer de Cognito no tenga restricciones con streaming. Spike de 3–4 h en cuanto haya lab.
- `lab:smoke` y `lab:deploy` se actualizan para el REST API y para probar el streaming.

**Modelo con razonamiento:** `gpt-6-luna` con esfuerzo `high` no emite texto mientras razona, así que el streaming mejora la percepción *después* del primer token; el estado "Pensando…" y, si hace falta, bajar el esfuerzo siguen siendo necesarios.

**Conversación interrumpida:** si el usuario pulsa Detener, se guarda su mensaje y la respuesta parcial marcada como interrumpida (así el historial no pierde el turno).

### 4.6 Caché de prompts para ahorrar tokens (F5b)

- **Bedrock:** `Converse` admite *cache points* (`cachePoint`) en modelos compatibles (Claude y Amazon Nova, entre otros; la lista y los mínimos por modelo se confirman en la documentación de Bedrock al implementar). Lo ya cacheado se cobra con tarifa reducida y baja la latencia; el caché expira si no hay aciertos dentro de su ventana. Nova además cachea de forma automática.
- **Aviso importante:** el caché solo aplica a un **prefijo estable y suficientemente largo** (del orden de 1 000 tokens o más, según modelo). Hoy el prompt de sistema es corto y casi todo lo demás cambia en cada turno (hoja de hechos y pasajes), así que **tal como está rendiría poco**. Por eso se mide antes de decidir.
- **Qué se hace:**
  1. **Medir:** registrar `inputTokens`, `cacheReadInputTokens` y `cacheWriteInputTokens` que devuelve Converse (y los equivalentes de OpenAI) en los logs y en `meta` de la respuesta.
  2. **Reordenar el prompt** de más estable a más variable: reglas del sistema → bloque estable de ejemplos/glosario → historial → datos del turno, con **un `cachePoint` tras el bloque estable** y otro tras el historial en conversaciones largas.
  3. **Local:** el puente ignora `cachePoint` pero reporta los tokens cacheados que informa OpenAI (el caché automático de OpenAI también exige prefijo largo), para ver el efecto en la demo.
  4. **Otros ahorros baratos:** esfuerzo de razonamiento más bajo en consultas simples, menos pasajes (top 2–3), historial de 4 mensajes (ya) y un modelo pequeño en el lab.
- **Resultado esperado:** un informe con tokens antes y después. Si el prefijo no alcanza el mínimo, se documenta y se prioriza el resto de ahorros.

### 4.7 Cognito simulado en local (F3b)

**Sí se puede, y con tokens reales.** Comprobado con el AWS Emulator: su Cognito entrega **JWT firmados RS256** (con `sub`, `iss`, `aud`, `token_use`, `exp`) y publica `.well-known/jwks.json` y `openid-configuration`, igual que Cognito real. Por tanto se puede verificar la firma en local exactamente como lo hará el authorizer en el lab.

Propuesta:
- **Usuarios = personas:** `npm run provision` crea en el emulador un User Pool con un usuario por persona (más "sin perfil").
- **Sesión demo (solo local, nunca en el lab):** al elegir una persona en "Ver como…", el frontend llama a `POST /api/dev/session`; el backend (con `DEV_AUTH=true`) obtiene un token con `AdminInitiateAuth` y lo devuelve. Se evita el inicio de sesión SRP del navegador contra el emulador porque su certificado HTTPS no es de confianza para el navegador.
- **Verificación real en el backend local:** un middleware verifica firma, `iss`, `aud` y expiración contra el JWKS del emulador (con `aws-jwt-verify` o `jose`); la identidad es el `sub`. En el lab esa misma verificación la hace el authorizer de API Gateway y el backend solo lee los *claims*: el código de las rutas es el mismo.
- **Qué cambia en la app:** el frontend ya envía `Authorization: Bearer`; `academicDataFromClaims(token)` reemplaza a la constante de Valerie; los datos académicos se toman de los *claims* si el emulador acepta atributos personalizados (**por verificar**; si no, se resuelven por `sub` en el registro `shared/personas.json`).
- **Seguridad:** `DEV_AUTH` y el endpoint de sesión no existen en el paquete de Lambda del lab, y el selector está apagado salvo `VITE_DEMO_PERSONAS=true`.
- **Pruebas manuales útiles:** token vencido (401), token de otro pool (401), sin token (401) y acceso a la conversación de otra persona (404).

### 4.8 Persistencia de conversaciones y memoria a largo plazo (F5c)

**Problema hoy.** El historial vive solo en el checkpoint de LangGraph (DynamoDB, TTL de 7 días) y `messages` se recorta a los últimos 20 (`MAX_HISTORY`). Pasado ese límite, o al expirar el TTL, el modelo y el usuario pierden los mensajes viejos. El campo `summary` del estado existe, pero nada lo llena. Solo hay **una** conversación por estudiante.

**Cuatro capas, cada una con un trabajo distinto**

| Capa | Dónde | Para qué | Vida |
|---|---|---|---|
| Memoria de trabajo | Checkpoint de LangGraph (tabla actual) | Estado del turno y de la conversación activa | Expira (TTL 7 días, **se conserva**: es memoria operativa y se puede reconstruir) |
| Resumen compactado | Campo `summary` del checkpoint | Contexto de lo que ya salió de la ventana de mensajes | Se regenera |
| **Registro completo** | **Tabla nueva `Conversations`** | Historial íntegro que ve el usuario; fuente para reconstruir | **Sin TTL** |
| **Memoria a largo plazo** | Ítems `MEMORY#` en la misma tabla nueva | Datos estables del alumno, compartidos entre conversaciones | Sin TTL; editable y borrable por la persona |

**Tabla `Conversations` (sin TTL)**
- `PK = studentId` (el `sub` del token, F3b); `SK` por tipo de ítem:
  - `CONV#<conversationId>`: metadatos (título, `createdAt`, `updatedAt`, vista previa del último mensaje, número de mensajes, `summary` y hasta qué mensaje está resumido).
  - `MSG#<conversationId>#<createdAt>#<messageId>`: un mensaje (rol, texto en Markdown, intent, fuentes, métricas, `interrupted` si el usuario pulsó Detener).
  - `MEM#<clave>`: un dato de memoria a largo plazo (ver abajo).
- Consultas sin escaneo: conversaciones de una persona (`begins_with CONV#`), mensajes de una conversación paginados (`begins_with MSG#<id>#`), memoria (`begins_with MEM#`).
- **Escrituras idempotentes** (clave determinista por `messageId`): un reintento no duplica. Si falla la escritura, **no se falla la respuesta al usuario**: se registra el error y se reintenta.
- Local: `npm run provision` crea la misma tabla en el emulador; en el lab se declara en `platform/infra/data.ts` (hoy esa tabla tiene `ttl`; la nueva no).

**Varias conversaciones aisladas por persona**
- El `thread_id` del checkpoint pasa a ser `<studentId>#<conversationId>`. Cada conversación tiene su propio checkpoint y su propio resumen; **nada se comparte entre conversaciones salvo la memoria a largo plazo**.
- Rutas nuevas: `GET /conversations` (lista), `POST /conversations` (crea), y las existentes `GET`/`DELETE /conversations/:id` y `POST /messages` reciben `conversationId`. **Toda ruta verifica que la conversación pertenezca al `studentId` del token; si no, 404** (sin revelar que existe).
- El título se toma de la primera pregunta (recortada). **Sin llamada extra al modelo.**
- `DELETE` borra la conversación en el registro completo **y** su checkpoint.
- **Frontend (cuando toque):** lista de conversaciones en el panel lateral del chat, "Nueva conversación", renombrar y borrar.

**Compactación del contexto (resumen)**
- El modelo recibe: **memoria a largo plazo + resumen + últimos 4–6 mensajes completos + datos del turno**. El historial completo ya no se manda.
- **Cuándo:** al superar un umbral (p. ej. 12 mensajes o cierto número de tokens), **después** de responder y sin bloquear al usuario; se resume solo lo que sale de la ventana y se guarda en `summary`. No se resume en cada turno (costo, latencia y choque con el streaming).
- **Qué debe contener el resumen:** temas tratados, preferencias, decisiones y preguntas ya resueltas. **No** debe repetir códigos, fechas, montos ni porcentajes: eso se vuelve a leer siempre de la hoja de hechos del turno, y el guardrail sigue validando contra ella.
- **Reconstrucción:** si el checkpoint expiró o se perdió, al reabrir la conversación se arma el estado desde el registro completo (resumen guardado + últimos mensajes).
- Ayuda a la caché de prompts (4.6): la memoria y el resumen cambian poco y forman un prefijo estable.
- Se mide en logs: mensajes y tokens enviados antes y después de compactar.

**Memoria a largo plazo (información del alumno que no cambia)**
- **Qué entra:** hechos estables y útiles para orientar: programa, campus, periodo de ingreso, modalidad, idioma preferido, metas ("quiere hacer prácticas en banca"), restricciones de horario o de trabajo que el alumno mencionó, intereses. **Qué no entra:** salud, situación económica detallada, identificaciones, contraseñas ni nada sensible (AGENTS.md: nunca guardar datos reales sensibles). Se aplica una lista de categorías permitidas.
- **Dos orígenes con prioridad distinta:**
  1. **Perfil y claims del token** (`name`, `custom:programa`, `custom:campus`, `custom:semestre`, F3/F3b): son la **fuente de verdad** y **siempre ganan** ante lo aprendido en una conversación.
  2. **Aprendidos de las conversaciones:** un paso de extracción, junto al de compactación (después de responder, fuera del camino crítico), propone altas o cambios; cada dato guarda `valor`, `origen` (`perfil` | `conversacion`), `fuente` (id del mensaje) y `updatedAt`. Un dato nuevo contradictorio reemplaza al viejo; si no hay certeza, no se guarda.
- **Cómo se usa:** un bloque corto y **estable** al inicio del prompt ("Lo que sabes de esta persona"), con tope (~20 datos, ~300 tokens). Es contexto, **no autoridad**: no sustituye la hoja de hechos para fechas, montos o requisitos, y el guardrail no lo toma como respaldo de una cifra.
- **Control de la persona:** pantalla o panel **"Lo que recuerdo de ti"** para ver, corregir y borrar cada dato, y **"Olvidar todo"**. Borrar una conversación **no** borra la memoria a largo plazo (se borra aparte, a propósito, y se explica en la interfaz).
- Con las personas demo (F3) la memoria se **siembra desde el perfil** de cada una, y la persona **sin perfil** empieza vacía para probar cómo se va llenando.

**Piezas y esfuerzo**

| Pieza | Qué cambia | Esfuerzo |
|---|---|---|
| Tabla y adaptador | Tabla `Conversations` (local y lab), repositorio con escrituras idempotentes, `thread_id` compuesto | 3–4 h |
| API de conversaciones | Lista, crea, lee, borra; verificación de pertenencia; migrar el `GET` actual | 2–3 h |
| Compactación | Nodo posterior a la respuesta, prompt de resumen sin cifras, reconstrucción desde el registro | 3–4 h |
| Memoria a largo plazo | Ítems `MEM#`, siembra desde perfil/claims, extracción con lista de categorías, bloque en el prompt, rutas para ver/borrar | 4–6 h |
| Verificación | Scripts `verify:*` (aislamiento entre personas y entre conversaciones, idempotencia, reconstrucción, memoria que no autoriza cifras) | 2–3 h |

## 5. Fases, orden y dependencias

1. **F1 — Sistema visual y marca (8–10 h).** Tokens CSS (variables), fuentes, favicon y logo en `index.html`/Layout, `document.title` por ruta, enlace "saltar al contenido", reemplazo del negro y grises por la paleta. *Primero, porque toca todas las pantallas.*
2. **F2 — Chat: layout y Markdown (8–10 h).** Depende de F1.
3. **F3 — Personas (6–8 h)** y **F3b — Cognito simulado en local (8–10 h).** F3b depende de F3 (los usuarios del emulador son las personas); conviene antes de F4 para diseñar datos por persona.
4. **F4 — Datos realistas (10–14 h).** Catálogo y corpus por persona; re-ejecutar `kb:upload`, `kb:verify` y `verify:*`.
5. **F5 — Streaming + REST API del lab (22–28 h)** y **F5b — Caché de prompts (4–6 h).** F5b puede ir en paralelo; conviene medir tokens antes de F5 para tener la línea base.
   *(F5, detalle:)* Después de F2 (el render incremental usa el Markdown) y de F4 si se quiere una demo con datos finales; puede avanzar en paralelo en el backend.
6. **F5c — Persistencia de conversaciones y memoria a largo plazo (14–20 h).** Depende de **F3b** (el `studentId` es el `sub` del token) y de **F5** (la respuesta interrumpida con Detener también se guarda en el registro). La tabla y la API pueden empezar antes, en paralelo con F5. El frontend (lista de conversaciones, "Lo que recuerdo de ti") entra con F6.
7. **F6 — Pulido UX/UI de las demás pantallas (12–16 h).** Después de F1.
8. **F7 — Verificación, documentación y PR (5–7 h).**

*Camino crítico:* F1 → F2 → F5. F3 y F4 se pueden trabajar en paralelo con F2.

## 6. Datos más cercanos a EBC (sugerencias)

Tomado de las páginas públicas de EBC (programas, campus, becas, trámites y vinculación). **Lo no público (montos, fechas de convocatorias, requisitos exactos) sigue siendo simulado y rotulado como tal.**

| Área | Hoy | Propuesta (real en el sitio de EBC) |
|---|---|---|
| **Campus** | 6 (CMS, GDL, CNC, QRO, CHI, PCH) | **14:** Aguascalientes, Cancún, Chiapas, Ciudad de México, Ciudad de México Sur, Guadalajara, Hermosillo (nuevo), León, Mérida, Pachuca, Querétaro, San Luis Potosí, Tlalnepantla y Toluca |
| **Carreras** | 4 (Banca, Finanzas, Mercadotecnia, Adm. de Empresas) | **8 licenciaturas:** Administración de Negocios, Adm. de Negocios Turísticos, Adm. de Negocios de la Comunicación y el Entretenimiento, Comercio y Negocios Internacionales, Contaduría, Derecho, Finanzas (y Banca) y Mercadotecnia; **ejecutivas** (Adm. y Comercialización, Contabilidad y Finanzas, Negocios, Programación y Transformación Digital); **posgrados** (Maestría en Alta Dirección, Maestría en Dirección Financiera, Especialidad en Impuestos) |
| **Becas** | "Beca Fundación EBC", "Santander", "al mérito" (inventadas) | **Beca de Excelencia Académica (BEA)** y **Beca de Respaldo Económico**: apoyo del **10 al 40 %**, duración distinta por nivel (dos semestres, cuatro o siete periodos, dos trimestres), sujeta al **Comité de Becas** y tramitada en el proceso de admisión. Conservar las inventadas solo como "convenios simulados" si se quieren |
| **Trámites** | Reinscripción, constancia, solicitud de beca | Historial académico (general, semestral, en inglés), certificados electrónicos (bachillerato y licenciatura), **titulación electrónica** (100 % de créditos, fotografías, cédula profesional por gob.mx), **servicio social** (alta, carta de aceptación, carta de terminación, retroactivo) |
| **Vinculación** | "Foro Fintech", "Networking", "Feria" | **FiT EBC** (feria de empleabilidad, 2 ediciones al año por campus, 500+ empresas en 2025), **Ruta de Empleabilidad FiT EBC**, **Prácticas Profesionales**, **Catapulta** (emprendimiento), **Extensión Universitaria (EXU)**, **Relaciones Internacionales / Global EBC**, Responsabilidad Social |
| **Educación continua** | "Certificación AMIB", "Bloomberg" | Diplomados, cursos y **microcredenciales**, **EBC IA** |
| **Calendario** | Fechas sueltas | Inicio de clases en **agosto 2026** (licenciaturas); periodos distintos por modalidad (semestral, ejecutiva por periodos, posgrado trimestral) |
| **Catálogo** | 20 oportunidades, sin campus ni nivel | ~35, con `campus`, `nivel` (licenciatura/ejecutiva/posgrado) y cobertura para las 8 personas |
| **Matrícula** | `M0100010` | Se conserva el formato |

**Corpus nuevo:** campus, programas, becas (BEA y Respaldo), titulación y cédula, servicio social, FiT EBC y prácticas. Todos con `simulated: true` donde haya cifras o fechas no públicas, y una lista **"validar con EBC"** para que alguien de la escuela confirme lo que sea oficial.

## 7. Mejoras de UX/UI (F6)

**Prioridad alta**
- Chat a pantalla casi completa, con panel de contexto y estados vacíos útiles (F2).
- Una sola función de fechas (`dd/MM/aaaa`) y etiquetas correctas ("Fecha" para eventos, "Trámites").
- Tarjetas con tipo en color + ícono, altura uniforme, fecha y "faltan N días" bien visibles.
- Inicio con un bloque "Tu siguiente paso" (la fecha más próxima y su acción), y recomendaciones por persona.

**Prioridad media**
- Filtros en Oportunidades: tipo (chips), carrera, campus, orden por fecha y búsqueda; contador de resultados.
- Quitar "Volver a Inicio"; títulos de página por ruta; esqueletos de carga y estados vacíos amables.
- Perfil: usar los datos de la persona/token en lugar de la constante.

**Prioridad baja / opcional**
- Modo oscuro, favoritos con recordatorio, animaciones sutiles (respetando `prefers-reduced-motion`).

## 8. Decisiones

**Tomadas**
- **Lab con API Gateway REST API** para transmitir respuestas, y **un solo REST API para todo `/api/*`** (incluye las rutas existentes `/health` y `/opportunities`). Se avisa al equipo antes de tocar `platform/`.
- **Caché de prompts** del modelo, con medición previa (4.6).
- **Cognito simulado en local** con el emulador (4.7), y **authorizer de Cognito en el REST API del lab** (4.5): es el mismo contrato de identidad en ambos entornos.
- **Dirección visual:** inspirada en EBC pero fresca (v2 «Aurora»: encabezado claro, degradado cian→lima, Sora + Garamond de acento). Pendiente solo la **validación del área de marca de EBC** para el logo.
- **Guardrail con streaming:** opción A (transmitir y validar al final; si falla, `replace` por la respuesta de reglas con aviso).
- **Persistencia:** el historial completo se guarda en una **tabla nueva de DynamoDB sin TTL** (clave `PK = studentId`, `SK` por tipo de ítem); el checkpoint sigue siendo la memoria de trabajo y conserva su TTL, porque se puede reconstruir desde el registro.
- **Varias conversaciones por persona, aisladas:** `thread_id = <studentId>#<conversationId>`; toda ruta verifica pertenencia (404 si no es de la persona).
- **Compactación:** resumen al pasar un umbral, después de responder, **sin cifras ni fechas** (esos datos siempre salen de la hoja de hechos).
- **Memoria a largo plazo:** datos estables del alumno, con el perfil/claims como fuente de verdad, extracción de lo aprendido en conversación con lista de categorías permitidas, y control de la persona para verlos y borrarlos.
- **Personas:** las 8 + "sin perfil", con selector "Ver como…" en la app y `?persona=`.
- **Datos:** sustituir las becas inventadas por las reales de EBC (BEA y Respaldo Económico) y ampliar a 14 campus y 8 carreras, siempre rotulando lo no público como simulado.
- **Dependencias nuevas:** `react-markdown`, `remark-gfm`, y `aws-jwt-verify` o `jose`. Sin pruebas automatizadas.
- **Modelo del lab:** `lab:deploy` priorizará un modelo con soporte de caché (Claude y Nova lo tienen).
- **El plugin `frontend-design` está instalado**, pero no cargó en la sesión actual (los plugins se cargan al iniciar Claude Code): se usará al reiniciar la sesión, en la F1.

**Abiertas (no bloquean el arranque)**
1. **Quién valida lo "oficial" de EBC** (becas, trámites, fechas): hasta que alguien lo confirme, todo cifra/fecha no pública queda como simulada, con la lista "validar con EBC".
2. **Validación del logo** con el área de marca de EBC.
3. **Alcance de la F6** (pulido de pantallas): se confirma al terminar F1 y F2, con capturas.
4. **Persistencia (F5c):** confirmar que el checkpoint conserve su TTL de 7 días (propuesto) o también se quite; umbral de compactación (12 mensajes o por tokens); y la lista exacta de categorías permitidas para la memoria a largo plazo.

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| El streaming con el puente (event-stream binario) puede ser más trabajoso de lo estimado | Primero un spike de 2 h con el SDK real; si se complica, SSE solo desde el backend con el modelo en no streaming (peor experiencia, pero sirve para la demo) |
| Streaming en el lab sin poder probarlo | Mismo enfoque que la Fase 7 anterior: se verifica el handler localmente y se documenta qué solo se prueba en el lab |
| Migrar a REST API rompe rutas de los compañeros o la URL del frontend | Un solo cambio coordinado en `platform/`, misma ruta `/api/*`, y `lab:smoke` actualizado; avisar al equipo antes |
| El caché de prompts no rinde por prefijo corto | Medir primero (4.6); documentar y priorizar los otros ahorros |
| Mostrar un dato no validado antes de que el guardrail lo corrija | Estrategia A con aviso; B como alternativa; prompt y hoja de hechos siguen siendo la primera defensa |
| El cambio de negro institucional a encabezado claro choca con el criterio del equipo | Cambio concentrado en variables CSS y un solo componente de encabezado; capturas antes y después; contrastes verificados (WCAG AA) |
| Datos "reales" que en realidad no sean oficiales | Rótulo `simulado`, lista "validar con EBC", y las cifras no públicas siguen inventadas y marcadas |
| Sin TTL, la tabla crece y guarda texto de estudiantes para siempre | Solo datos demo (AGENTS.md); borrado por conversación y "Olvidar todo"; antes de usar datos reales hará falta una política de retención y consentimiento |
| El resumen o la memoria introducen un dato incorrecto que el guardrail da por bueno | El resumen no lleva cifras ni fechas; la memoria es contexto y nunca respalda una cifra; el perfil gana sobre lo aprendido; verificación específica |
| La extracción de memoria guarda algo sensible o equivocado | Lista de categorías permitidas, no se guarda si no hay certeza, la persona puede ver y borrar cada dato |
| La escritura al registro falla a medias o duplica mensajes | Claves idempotentes por `messageId`; la respuesta al usuario no depende de esa escritura; reintento |
| Cambios amplios de UI entran en conflicto con ramas del equipo | Ramas pequeñas por fase, rebase frecuente sobre `main`, PRs por fase |

## 10. Plugin de diseño

`frontend-design@claude-plugins-official` ya está instalado en tu Claude Code (verificado en `~/.claude/plugins`). Se usará en la F1 para refinar componentes y tokens; la propuesta visual de este plan no dependía de él.
