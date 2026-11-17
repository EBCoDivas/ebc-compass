# Plan: streaming, identidad visual y UX del chat, personas demo y datos más cercanos a EBC

- **Rama:** `feature/assistant-ux-refresh` (desde `main` en `86b7d14`)
- **Estado:** F1 a F3b implementadas; F4, F5, F5b y backend de F5c implementados y verificados en local; F6 en revisión y F8 implementada con validación local; F5 REST y caché Bedrock pendientes de despliegue en el lab; pendientes revisión visual y lab · **Fecha:** 2026-11-16
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
| 8 | Persistencia de valoraciones 👍/👎 por respuesta | F8 | 4–6 h |
| | **Total** | | **≈ 96–128 h** |

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
- Campo de varias líneas que crece (Enter envía, Shift+Enter nueva línea), contador discreto, botón **Copiar** y 👍/👎 (solo estado local por ahora), sugerencias como tarjetas, y encabezado de la página reducido.

### 4.3 Personas demo (F3)
Las ocho personas y la cuenta «Sin perfil» se definen en `shared/personas.json`. F3b las registra como cuentas Cognito y usa login con correo/contraseña. El selector y los atajos por URL de la primera versión de F3 quedan retirados. Los datos académicos se presentan desde `academicDataFromClaims(token)` y los perfiles/conversaciones se aíslan por el `sub` autenticado.

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
- **A. Transmitir y validar al final.** Los tokens salen en vivo; al terminar se valida. Si falla, llega `replace` con un aviso de respuesta no verificable y la opción de reintentar; los resultados por filtros se ofrecen aparte, bajo una acción explícita. Ventaja: latencia mínima. Riesgo: durante unos segundos el usuario pudo ver un dato no respaldado.
- **B. Validar por oración** (retener hasta cerrar cada oración): más seguro, menos fluido.
- **C. No transmitir cuando el intent trae datos sensibles.**
Se propone A con las reglas actuales (códigos, fechas, montos y porcentajes) y B solo si la demo lo exige.

**Lab: API Gateway REST API (decisión tomada).** El HTTP API actual no transmite respuestas; el **REST API** sí, con *response transfer mode* `STREAM` en integraciones proxy (según la documentación de AWS: solo `AWS_PROXY`/`HTTP_PROXY`, el URI de la Lambda debe terminar en `/response-streaming-invocations`, la función debe usar el formato de streaming, no hay caché de endpoint con streaming y no existe streaming de la petición). Implica:
- **Migrar el API del lab de HTTP API a REST API** (`sst.aws.ApiGatewayV1`) con **authorizer de Cognito (User Pools)**, que es nativo en REST. Se implementó una sola URL para todo `/api/*`.
- **Dos funciones:** la actual con `serverless-http` (respuestas normales) y una nueva con `streamifyResponse` solo para `POST /api/assistant/messages/stream`.
- **Cambia el formato del evento:** REST usa payload v1, así que la identidad sale de `requestContext.authorizer.claims.sub` (hoy se lee `authorizer.jwt.claims.sub` de HTTP API). Se leerán ambos.
- **CORS** hay que declararlo en REST (respuestas `OPTIONS` y encabezados), y `GET /health`/`/opportunities` del equipo se mueven con el resto.
- **Configurado en SST:** SST 4.17.2 y AWS Pulumi 7.55.0 fijados; la opción nativa `streaming: true` configura `responseTransferMode` y el URI. CORS y el deployment también son declarativos. **Pendiente en AWS:** comprobar authorizer, CORS y transmisión a través del endpoint desplegado; los stages SST 3 existentes requieren diff y refresh antes de desplegar. Ver Avance de F5.
- `lab:smoke` y `lab:deploy` se actualizan para el REST API y para probar el streaming.

**Modelo con razonamiento:** `gpt-6-luna` con esfuerzo `high` no emite texto mientras razona, así que el streaming mejora la percepción *después* del primer token; el estado "Pensando…" y, si hace falta, bajar el esfuerzo siguen siendo necesarios.

**Conversación interrumpida:** si el usuario pulsa Detener, se guarda su mensaje y la respuesta parcial marcada como interrumpida (así el historial no pierde el turno).

### 4.6 Caché de prompts para ahorrar tokens (F5b)

- **Bedrock:** `Converse` admite *cache points* (`cachePoint`) en modelos compatibles (Claude y Amazon Nova, entre otros; la lista y los mínimos por modelo se confirman en la documentación de Bedrock al implementar). Lo ya cacheado se cobra con tarifa reducida y baja la latencia; el caché expira si no hay aciertos dentro de su ventana. Nova además cachea de forma automática.
- **Aviso importante:** el caché solo aplica a un **prefijo estable y suficientemente largo** (del orden de 1 000 tokens o más, según modelo). Hoy el prompt de sistema es corto y casi todo lo demás cambia en cada turno (hoja de hechos y pasajes), así que **tal como está rendiría poco**. Por eso se mide antes de decidir.
- **Qué se hace:**
  1. **Medir:** registrar `inputTokens`, `cacheReadInputTokens` y `cacheWriteInputTokens` que devuelve Converse (y los equivalentes de OpenAI) en los logs y en `meta` de la respuesta.
  2. **Reordenar el prompt** de más estable a más variable: reglas del sistema → bloque estable de ejemplos/glosario → historial → datos del turno, con **un `cachePoint` tras el bloque estable** y otro tras el historial en conversaciones largas.
  3. **Local:** el puente traduce `cachePoint` a breakpoints explícitos en modelos OpenAI compatibles y reporta las lecturas y escrituras informadas; en modelos anteriores omite parámetros no soportados.
  4. **Otros ahorros baratos:** esfuerzo de razonamiento más bajo en consultas simples, menos pasajes (top 2–3), historial de 4 mensajes (ya) y un modelo pequeño en el lab.
- **Resultado esperado:** un informe con tokens antes y después. Si el prefijo no alcanza el mínimo, se documenta y se prioriza el resto de ahorros. **Implementado:** [medición F5b](../benchmarks/prompt-cache.md); 550 tokens de entrada y cero lecturas de caché en esta muestra. La medición inicial usó un prompt corto. El prompt Markdown posterior activa system por defecto; ver actualización del informe.

### 4.7 Cognito simulado en local (F3b)

**Sí se puede, y con tokens reales.** Comprobado con el AWS Emulator: su Cognito entrega **JWT firmados RS256** (con `sub`, `iss`, `aud`, `token_use`, `exp`) y publica `.well-known/jwks.json` y `openid-configuration`, igual que Cognito real. Por tanto se puede verificar la firma en local exactamente como lo hará el authorizer en el lab.

**Decisión actualizada: cuentas y login, sin selector de usuarios.**
- Aprovisionar las nueve cuentas demo en Cognito, con correos ficticios y contraseñas generadas fuera de Git. Usar la pantalla de acceso con correo/contraseña y Cerrar sesión; retirar «Ver como…», los atajos por URL y los tokens sin firma de F3.
- En local, el navegador llama a POST /api/dev/session con credenciales; el servidor usa el cliente Cognito contra el emulador para obtener un ID token firmado. No se envían credenciales AWS al navegador. Esta ruta solo se monta en el servidor local, nunca en Lambda.
- Proteger todas las rutas de negocio locales con verificación RS256, issuer, audience, token_use y expiración contra el JWKS del emulador. Usar exclusivamente el sub verificado para conversaciones y claims para los datos académicos; ignorar studentId suplantado desde el cliente.
- Persistencia local: el emulador actual no tiene almacenamiento durable. Un registro en local/.state (ignorado, permisos 600) conserva las cuentas y contraseñas para reprovisionarlas tras reinicios. Conserva accesos, pero los sub y tokens internos pueden cambiar; hay que volver a iniciar sesión. La persistencia íntegra de identidad/datos entre reinicios requiere un proveedor durable y queda como limitación explícita para F5c.
- En el lab, Cognito conserva cuentas de forma nativa y API Gateway verifica JWT. Mantener el login SRP existente y una herramienta de aprovisionamiento explícita de cuentas demo; no ejecutar despliegues o escrituras en AWS real como parte de la validación local.
- Perfil, guardadas y conversación del navegador se aíslan por sub autenticado. No hay perfil precargado para la cuenta «Sin perfil». Las credenciales no se publican en frontend, logs ni documentación.
- Verificar acceso con contraseña correcta/incorrecta, sin token, JWT vencido/manipulado/de otro pool o audiencia, idempotencia del aprovisionamiento, logout y acceso a conversaciones ajenas (404). Documentar lectura local de credenciales sin imprimirlas durante verificaciones.

### 4.8 Persistencia de conversaciones y memoria a largo plazo (F5c)

**Problema previo a F5c.** El historial vivía solo en el checkpoint de LangGraph (DynamoDB, TTL de 7 días) y `messages` se recorta a los últimos 20 (`MAX_HISTORY`). Pasado ese límite, o al expirar el TTL, el modelo y el usuario pierden los mensajes viejos. El campo `summary` del estado existe, pero nada lo llena. Solo hay **una** conversación por estudiante.

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

### 4.9 Persistencia de valoraciones (F8)

**Objetivo.** Guardar las valoraciones 👍/👎 por respuesta para utilizarlas más adelante. Se conserva la interacción actual de dos pulgares, sin solicitar motivos ni comentarios.

**Alcance**
- Sustituir el estado temporal de F2 por persistencia en backend. Registrar estudiante desde el token, conversación, mensaje del asistente, valoración positiva/negativa y fechas de creación/actualización.
- Guardar una única valoración por estudiante y mensaje; repetir el mismo pulgar es idempotente y cambiarlo o retirarlo devuelve 409 (`FEEDBACK_ALREADY_SET`). Verificar pertenencia de la conversación y existencia del mensaje del asistente.
- Recuperar la valoración al recargar el historial. Bloquear los pulgares después de guardarla y mostrar errores de guardado sin afirmar que se registró.
- Persistir las valoraciones en la tabla Conversations de DynamoDB local/lab, con las rutas autenticadas descritas en el avance de F8. Eliminar también las valoraciones al borrar la conversación asociada.
- El uso posterior de estos datos queda pendiente: esta fase no incluye motivos, comentarios, panel de administración, usuario administrador, casos de evaluación, comparación de ejecuciones ni entrenamiento automático.

**Aceptación y entrega**
- La persona guarda una sola vez su 👍/👎 y ve el estado persistido al recargar.
- No puede valorar mensajes ajenos o inexistentes. Verificar autenticación, pertenencia, idempotencia y fallos de persistencia.
- Cerrar F8 con validación local, evidencia del lab cuando esté disponible, documentación y PR propio.

## 5. Fases, orden y dependencias

1. **F1 — Sistema visual y marca (8–10 h).** Tokens CSS (variables), fuentes, favicon y logo en `index.html`/Layout, `document.title` por ruta, enlace "saltar al contenido", reemplazo del negro y grises por la paleta. *Primero, porque toca todas las pantallas.*
2. **F2 — Chat: layout y Markdown (8–10 h).** Depende de F1.
3. **F3 — Personas (6–8 h)** y **F3b — Login con Cognito local (8–10 h).** F3b depende de F3 (los usuarios del emulador son las personas); conviene antes de F4 para diseñar datos por persona.
4. **F4 — Datos realistas (10–14 h).** Catálogo y corpus por persona; re-ejecutar `kb:upload`, `kb:verify` y `verify:*`.
5. **F5 — Streaming + REST API del lab (22–28 h)** y **F5b — Caché de prompts (4–6 h).** F5b puede ir en paralelo; conviene medir tokens antes de F5 para tener la línea base.
   *(F5, detalle:)* Después de F2 (el render incremental usa el Markdown) y de F4 si se quiere una demo con datos finales; puede avanzar en paralelo en el backend.
6. **F5c — Persistencia de conversaciones y memoria a largo plazo (14–20 h).** Depende de **F3b** (el `studentId` es el `sub` del token) y de **F5** (la respuesta interrumpida con Detener también se guarda en el registro). La tabla y la API pueden empezar antes, en paralelo con F5. El frontend (lista de conversaciones, "Lo que recuerdo de ti") entra con F6.
7. **F6 — Pulido UX/UI de las demás pantallas (12–16 h).** Después de F1.
8. **F8 — Persistencia de valoraciones (4–6 h).** Depende de F3b (identidad) y F5c (mensajes persistentes). Guarda únicamente 👍/👎 por respuesta, recupera el estado al recargar y bloquea cambios posteriores. Su uso posterior queda fuera de esta fase. Ver 4.9.

*Camino crítico:* F1 → F2 → F5. F3 y F4 se pueden trabajar en paralelo con F2.

### Avance de F2

- El layout amplio, textarea, sugerencias y copiar ya existían; se completaron las valoraciones temporales (no se envían ni persisten), el contexto cerrado inicialmente en móvil y los avisos de copia.
- Prompt bilingüe y plantillas por reglas emiten Markdown simple. El historial usa el mismo renderizador, con compatibilidad para las viñetas antiguas.
- HTML crudo e imágenes deshabilitados; enlaces HTTP(S) externos con protección de pestaña nueva.
- Se retiró Regenerar por decisión de producto. Se conserva Reintentar para solicitudes fallidas.
- Las preguntas iniciales, las sugerencias de seguimiento y los temas del panel envían la pregunta directamente al pulsarlos. Se bloquean envíos mientras carga el historial o hay una solicitud en curso, incluidos clics repetidos.
- Streaming y Detener pertenecen a F5. Queda pendiente comprobar visualmente escritorio/móvil y con lector de pantalla.

### Avance de F3 (implementación inicial, sustituida por F3b)

- Las 8 personas y «Sin perfil» se definen en `shared/personas.json`, con UUID distintos, programa, campus, periodo e intereses ficticios.
- Selector «Ver como…» con `VITE_DEMO_PERSONAS=true`, `?persona=diego` y `VITE_DEFAULT_PERSONA`. Al cambiar se recarga la página para reiniciar el estado del chat; los borradores sin enviar se descartan.
- Perfiles, conversaciones y guardadas se almacenan por persona. Se conservan las claves antiguas para el modo sin personas demo; no se migran a otra identidad.
- Inicio y Perfil leen los datos académicos desde los claims simulados, preservando nombre personalizado, intereses y preferencias por persona. «Sin perfil» permite completar el onboarding.
- F3 usa tokens demo sin firma exclusivamente cuando no está configurado Cognito; no confieren permisos. La identidad confiable y los JWT firmados siguen pendientes en F3b. En el lab, Cognito desactiva esta simulación.
- El contrato del perfil del asistente admite las carreras de las personas; la ampliación del catálogo/corpus y la detección de sus nombres en preguntas quedan en F4.
- Verificación local de las nueve personas: `node --import ./backend/node_modules/tsx/dist/loader.mjs backend/scripts/verify-personas.ts`. No requiere emulador ni LLM.

### Avance de F3b

- Login local con correo/contraseña, ID tokens RS256 emitidos por Cognito y Cerrar sesión; retirados selector, identidades por URL y tokens sin firma.
- `npm run provision` crea/verifica nueve cuentas y conserva sus credenciales en `local/.state/cognito.json` (ignorado, modo 600). El servidor solo expone la sesión local en loopback; el handler Lambda no importa esa ruta.
- Verificados firma, issuer, audiencia, expiración y token_use. Perfil académico y conversaciones usan claims/sub verificados. Lectura y borrado de conversación ajena devuelven 404 incluso si se envía otro studentId.
- Las sesiones se guardan en sessionStorage; perfiles y guardadas se aíslan por sub. Al cerrar sesión o recibir 401 se elimina la sesión activa. Los ID tokens ya emitidos conservan su validez hasta expirar; no se implementa revocación inmediata ni renovación automática.
- `npm --prefix backend run verify:auth` valida las nueve cuentas contra el emulador sin imprimir credenciales. Las pruebas unitarias cubren tokens vencidos, firma manipulada, otra audiencia/pool y tokens sin firma.
- Preparados el esquema de atributos académicos en SST y `npm run lab:personas -- --confirm` para registrar las nueve cuentas en el lab (credenciales privadas en `scripts/lab/.state/personas.json`). No se han desplegado ni ejecutado cambios en AWS real.
- El emulador sigue siendo efímero: se restauran cuentas y contraseñas, pero no sus sub ni los checkpoints tras destruirlo. No se afirma persistencia nativa de Cognito local.
- Pendiente: revisión visual en navegador y validación del login/atributos en el lab tras un despliegue autorizado.

### Ampliación de F3b: perfiles persistentes (implementada en local)

- Tabla StudentProfiles independiente y sin TTL en DynamoDB local/lab, con studentId = sub autenticado. Declaración SST y permisos GetItem/PutItem acotados a la tabla; sin despliegue en AWS real.
- GET /api/profiles devuelve cero o un perfil de la sesión; POST actualiza ese registro y confirma con el perfil guardado. Incluye nombre preferido, intereses, preferencias, materias, metas, promedio/disponibilidad opcionales y updatedAt. Datos académicos desde los claims cuando existen.
- El frontend carga el perfil remoto antes de montar Inicio/Perfil/Asistente. La caché del navegador se mantiene por cuenta; si no existe perfil remoto, migra los ajustes previos de esa misma identidad.
- El guardado espera a DynamoDB. Un fallo muestra un error y conserva el formulario sin anunciar éxito ni navegar. Las cuentas no pueden elegir el perfil de otro usuario desde el cuerpo o la URL.
- Verificación: pruebas de autorización/errores y sincronización del frontend; verify:profiles prueba el repositorio contra DynamoDB del emulador con otra instancia de servidor, usando datos temporales y limpieza posterior.
- La persistencia local conserva datos al reiniciar el backend, pero el emulador sigue siendo efímero. El almacenamiento durable entre reinicios del emulador y la persistencia de guardadas/conversaciones no se incluyen en este ajuste.

### Primer acceso: configuración del perfil (implementado)

- Después del login y de recuperar el perfil de DynamoDB, las cuentas sin onboardingCompletedAt entran a /perfil antes de Inicio. Las demás rutas de la aplicación redirigen a Perfil hasta confirmar la configuración; Cerrar sesión permanece disponible.
- Se muestra «Completa tu perfil» y «Guardar y comenzar». Nombre y datos académicos son obligatorios; intereses, preferencias y metas siguen siendo opcionales.
- El formulario envía completeOnboarding: true en POST /api/profiles. El backend registra onboardingCompletedAt con su reloj únicamente al guardar correctamente, conserva la primera fecha en ediciones posteriores e ignora fechas enviadas por el cliente.
- El perfil demo precargado o una completitud del 100% no equivalen a configuración confirmada. La migración automática de la caché tampoco marca el onboarding.
- Los perfiles anteriores sin esa marca piden una confirmación inicial, conservando sus ajustes existentes. Con la marca persistida, futuros accesos van a Inicio, incluso desde otro navegador. No se requiere modificar la tabla ni el esquema de Cognito.

### Avance de F5

- Puente local: ConverseStream entrega frames binarios AWS EventStream, con CRC, eventos de texto y metadatos de uso; la desconexión aborta la llamada OpenAI. Verificado usando el SDK real de Bedrock, sin simular los tokens.
- Grafo: streaming del modelo con eventos custom, validación final y replace si la generación contiene datos no respaldados. Conserva POST /messages para clientes anteriores. Los fallos de generación o validación se muestran explícitamente, con resultados del catálogo opcionales.
- Nueva ruta autenticada POST /api/assistant/messages/stream, con meta, token, replace, done y error. Valida la entrada antes de abrir SSE y envía latidos mientras espera.
- Frontend: lector SSE incremental UTF-8/CRLF, Markdown limitado a un render por animation frame, «Pensando…», botón Detener, texto parcial conservado ante errores de transporte y Reintentar. Autoscroll solo cuando el usuario sigue al final; anuncio accesible al terminar, sin anuncios por token. No se reintroduce Regenerar.
- Cancelación: el grafo no se aborta globalmente; cancela el proveedor y finaliza el checkpoint con el mensaje del estudiante y la respuesta parcial marcada interrupted. Un parcial con cifras no verificadas se sustituye por un aviso de validación antes de guardarlo. La cancelación por desconexión HTTP se prueba con un proveedor controlado.
- REST regional preparado con un solo URL, Cognito User Pools y dos funciones (buffered + streaming). El handler normal admite payload v1/v2; el handler de streaming usa streamifyResponse y HttpResponseStream del runtime Lambda.
- SST actualizado a 4.17.2 con proveedor AWS 7.55.0 fijado. La ruta declara streaming: true: SST configura STREAM y el URI response-streaming-invocations. Los preflight permiten authorization/content-type mediante un transform acotado al API. Su deployment depende de esos recursos y detecta sus cambios. Eliminado el parche posterior por SDK de lab:deploy y su dependencia client-api-gateway; un SST deploy directo también configura todo. La migración del estado de stages anteriores requiere sst diff y sst refresh; ver docs/deploy-lab.md.
- Las rutas normales se declaran explícitamente para evitar que los recursos hijos del endpoint de streaming bloqueen la resolución del proxy voraz de REST. La función de streaming tiene 90 s y límite del proveedor de 60 s; no se atribuye al endpoint buffered la misma duración.
- lab:smoke verifica SSE, fragmentos y done con un usuario temporal. No se ejecutaron cambios en AWS real: authorizer/CORS/transfer mode requieren validación allí. API Gateway puede continuar ejecutando Lambda tras desconectarse el cliente; la cancelación inmediata está verificada en local, no garantizada en el lab.
- Verificación real con Cognito, SSE, ConverseStream y DynamoDB del emulador: ejemplo de 165 fragmentos en 85 lecturas HTTP, respuesta final e historial comprobados y limpieza del turno temporal. Pruebas para frames divididos, Unicode, guardrail, cancelación/partial y handlers REST.
- Validación: 16 pruebas de backend y 15 de frontend aprobadas durante F5; tras el ajuste a SST 4, las 4 pruebas de plataforma verifican también la declaración de streaming autenticado y el alcance del transform de CORS. Typecheck de backend/frontend/local/lab/plataforma, lint y git diff --check correctos; build verificado durante F5. Revisión visual de escritorio/móvil y lector de pantalla pendiente.
- F5b completada con métricas y medición local (ver abajo); F5c implementa el registro completo y la memoria en backend; sus paneles entran con F6. interrupted se conserva hoy en el checkpoint, sujeto a su TTL y ventana de historial.

### Ajuste: fallos de IA transparentes

- Un fallo del proveedor devuelve `message.failure: MODEL_UNAVAILABLE`; un rechazo del guardrail devuelve `VALIDATION_FAILED`. `meta.mode` es `error`, con `degraded: true`. El texto explica el problema y el chat ofrece Reintentar. No se entrega automáticamente la plantilla como respuesta final de IA.
- Cuando existen oportunidades, `message.catalogFallback` contiene los resultados por filtros y sus fuentes. Se muestran solo al abrir «Ver oportunidades del catálogo», con la aclaración de que no son una respuesta generada por IA. Si no hay resultados, la opción no aparece. Copy y feedback de respuesta se ocultan en los fallos.
- Los fallos y el catálogo opcional se guardan en el checkpoint y se devuelven también al cargar el historial. Reintentar recupera la pregunta correspondiente incluso después de recargar. Los avisos de fallo se excluyen del contexto de respuestas previas enviado al modelo.
- Se conserva `done` para un turno finalizado y persistido, incluyendo fallos explícitos; el evento SSE `error` sigue reservado a errores de ejecución/transporte. El contrato es el mismo en JSON, SSE local y Lambda. El modo `rules` solicitado explícitamente para desarrollo, los saludos y la ayuda determinista continúan funcionando.
- Verificado con proveedor controlado: fallos a mitad de generación, guardrail, JSON/SSE, historial, catálogo vacío y render del chat con catálogo cerrado. No se requiere infraestructura adicional.

### Avance de F5b

- Métricas reales del proveedor en logs agregados y meta.usage de JSON/SSE/Lambda: entrada no cacheada, entrada total, lecturas/escrituras informadas, salida, duración y primer texto. No se imprimen preguntas, perfiles ni credenciales. El grafo reinicia las métricas en cada turno y conserva el consumo si el guardrail rechaza la generación.
- Conversión OpenAI → Bedrock sin doble conteo: las lecturas se restan de prompt_tokens al producir inputTokens; LangChain las suma en su formato y el adaptador vuelve a separar los contadores. Las métricas no informadas quedan ausentes.
- ASSISTANT_PROMPT_CACHE: system (predeterminado), system-history u off. Checkpoints después del sistema y, opcionalmente, al final del historial; nunca después de los datos variables. Lista conservadora de modelos compatibles y normalización de IDs regionales/ARN; desconocidos sin checkpoints. SST inyecta la opción a ambas funciones sin recursos ni permisos nuevos.
- El orden estable → historial → datos ya existía. Se conserva sin rellenar el prompt para forzar el mínimo; siguen los cuatro mensajes y tres pasajes máximos. No se cambia el esfuerzo de razonamiento sin comparar calidad.
- Cinco inferencias locales: cuatro con 550 tokens de entrada y cero lecturas de caché; prueba del sistema con pregunta mínima de 301 tokens, cota superior del prefijo estable. En esa medición inicial se dejó apagada por insuficiencia del prefijo; el prompt Markdown posterior la activa. No se afirma ahorro nuevo ni se extrapolan tiempos. Informe y reproducción en docs/benchmarks/prompt-cache.md. Ese benchmark del puente anterior no demuestra un acierto Bedrock.
- Verificación adicional de SSE real con Cognito/RAG/DynamoDB: 1327 tokens de entrada, 326 de salida, cero lecturas de caché, métricas presentes y respuesta validada. Turno temporal eliminado. Activación y medición con Bedrock real quedan pendientes del lab.

### Ajuste de F5b: prompt estable único en español

- Instrucciones de comportamiento del producto en backend/prompts/assistant.md, sin identidad de demo ni obligación de advertir datos simulados. Los specs se usan como referencia histórica; las decisiones actuales y la ampliación de alcance acordada con el equipo prevalecen. Carga del único archivo en español una vez al construir el grafo; instrucción de idioma por turno después del checkpoint, con prioridad para la preferencia explícita. Perfil y documentos continúan fuera del sistema estable.
- Caché system activa por defecto en backend, adaptador y SST. El puente traduce el checkpoint a breakpoints explícitos para GPT-5.6/GPT-6 compatibles, con escrituras reportadas cuando existen. La selección automática del lab prioriza Nova Lite/Micro; no cambia un modelo fijado explícitamente.
- SST incluye los Markdown en ambas Lambdas y configura ASSISTANT_PROMPTS_DIR. Es necesario reiniciar/redesplegar para recargar cambios de prompt.
- Estimación offline o200k_base del prompt compartido: 2451 tokens; no equivale al tokenizer de Bedrock ni garantiza un acierto. La validación de esta actualización usa cero llamadas OpenAI; no se ejecuta el benchmark pagado.

### Avance de F5c: registro completo y memoria

- Conversations sin TTL, independiente de ConversationCheckpoints (TTL siete días). Registro íntegro, metadatos, mensajes con fuentes/métricas/errores/interrupted, cursores y resultado por requestId. Escritura transaccional y bloqueo por conversación entre instancias; reintentar el mismo turno no regenera ni duplica.
- API autenticada para listar, crear, leer por páginas, renombrar y borrar conversaciones; ver, editar y olvidar memoria. Propietario exclusivo del sub verificado; cuerpo/query no cambian la cuenta. Las rutas REST nuevas y el permiso de tabla se declaran en SST.
- Reconstrucción del contexto desde el registro al perder o expirar el checkpoint. Migración única de los mensajes todavía disponibles en checkpoints anteriores. No se inventa el historial previamente perdido.
- Compactación posterior a la respuesta al acumular doce mensajes sin resumir, conservando seis recientes. Resumen semántico por temas con vocabulario controlado y extracción de preferencias enumeradas en primera persona, sin inferencias adicionales. Se explicita la limitación frente a un resumen narrativo; el registro completo conserva todos los detalles.
- Memoria limitada por categorías, procedencia y fechas; perfil/claims actuales prevalecen. Datos sensibles y texto libre no se extraen. Olvidar no se revierte por siembra ni por mantenimiento pendiente; la memoria y el resumen no autorizan cifras en el guardrail.
- Fallos de escritura: tres intentos, estado pending visible y cola en el checkpoint para reintentar antes del siguiente turno. No se afirma durabilidad si también falla o expira esa cola. Mantenimiento con bloqueo independiente para no bloquear una nueva respuesta.
- Cliente: creación previa, ID estable para reintentos de transporte y carga de todas las páginas. Lista y panel «Lo que recuerdo de ti» siguen en F6.
- Verificado contra DynamoDB del emulador con treinta mensajes, paginación, varias conversaciones, aislamiento, idempotencia, expiración del checkpoint y olvido; datos temporales limpiados y cero llamadas a OpenAI. No desplegado en AWS real.
- Contrato, límites y reproducción: docs/assistant-conversations.md.

### Avance de F8: valoraciones persistentes

- Se conserva el identificador F8; F7 se elimina como fase independiente. Cada entrega incluye su validación y documentación.
- `PUT /api/assistant/conversations/:id/messages/:messageId/feedback`, autenticado: `{ rating: "positive" | "negative" | null }`; 204 al guardar o repetir la misma valoración, 400 para entrada inválida, 401 sin identidad, 404 para conversación ajena o respuesta inexistente, 409 (`FEEDBACK_ALREADY_SET`) al intentar cambiar o retirar una valoración guardada y 503 si no está disponible el almacenamiento.
- La tabla Conversations guarda ítems `FEEDBACK#<conversationId>#<messageId>` por estudiante, sin motivos. El historial devuelve `feedback` en cada respuesta valorada; eliminar una conversación borra sus valoraciones.
- La interfaz espera confirmación de guardado y permite reintentar un fallo; tras guardar una valoración los pulgares quedan bloqueados.
- Validación local: 38 pruebas backend, 18 frontend y 5 de plataforma aprobadas; typecheck de backend/frontend/local/lab/plataforma, lint y `git diff --check` correctos. Las pruebas de persistencia usan el adaptador en memoria con el contrato de DynamoDB.
- Ruta declarada para el lab; despliegue y comprobación en AWS y revisión del flujo en navegador pendientes.

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

### Avance de F4

- Catálogo de 35 oportunidades simuladas para las ocho personas: campus y nivel (licenciatura, ejecutiva, posgrado), periodos, fechas y ubicación cuando corresponden. Se mantienen los seis tipos de oportunidad y el curso FIN-301 para compatibilidad de las verificaciones.
- Directorio de 14 campus y oferta de ocho licenciaturas, cuatro ejecutivas y tres posgrados. Los IDs previos banking y business-administration siguen siendo compatibles; los nombres y variantes públicas quedan documentados como referencias, no como disponibilidad por campus.
- GET /api/opportunities y GET /api/recommendations admiten campus y level como filtros opcionales adicionales. Las recomendaciones respetan carrera, campus, nivel, periodo y vigencia; Inicio, Calendario y el asistente usan el alcance de la cuenta activa. No se agregan pantallas nuevas de filtrado de F6.
- El reconocimiento de carreras prioriza nombres específicos: Dirección Financiera no se interpreta como licenciatura en Finanzas, ni Negocios Internacionales como Administración. El catálogo muestra rótulo demo y las descripciones identifican actividades ficticias.
- Corpus ampliado a 17 documentos simulados: se sustituyeron las becas inventadas por orientación de BEA/BRE y se agregaron campus, programas, servicio social, titulación/cédula y FiT EBC/prácticas. El calendario del corpus se generó con las fechas del catálogo para evitar contradicciones. Fechas, vacantes, expedientes y actividades siguen siendo ficticios.
- Golden questions ampliadas a 15 (10 ES y 5 EN): recuperación real 15/15 con el mismo vector store, 17 documentos activos y cero fallidos. Las pruebas verifican coherencia del directorio académico, cobertura de las ocho personas, calendario/corpus y filtros de API/recomendaciones. Cuatro consultas LLM reales (2 ES y 2 EN) verificadas con respuestas que distinguen la demo de las convocatorias oficiales. Exportación local de 17 documentos y sus metadatos preparada para S3; no se ejecutó ingesta ni despliegue en AWS real.
- La rama actual aún conserva la CLI antigua del conocimiento. Para esta validación se usa una copia temporal ignorada de la CLI ya commiteada en feature/shared-vector-store (a5db330), apuntando al ID existente e invocando upload/verify sin --create. No se mezcla esa rama ni se crea otro store. Debe integrarse esa rama antes de distribuir el flujo nuevo del vector store al equipo.

### Fuentes públicas consultadas para F4 (16/11/2026)

- [Becas EBC](https://www.ebc.mx/becas/): nombres BEA y Respaldo Económico, orientación de admisión y evaluación individual. El porcentaje no se garantiza y no se inventa un promedio mínimo.
- [Directorio de campus](https://www.ebc.mx/campus/nuestros-campus/): nombres del directorio, sin inferir oferta uniforme por sede.
- [Oferta educativa](https://www.ebc.mx/oferta-educativa/licenciaturas/) y [oferta por modalidad en CDMX](https://www.ebc.mx/campus/ciudad-de-mexico/): denominaciones de programas y modalidades. Algunas páginas usan variantes de Contaduría/Contaduría Pública, Finanzas/Finanzas y Banca y Turismo y Hospitalidad/Negocios Turísticos.
- [Trámites escolares](https://www.ebc.mx/tramites-escolares/): nombres de los trámites; el flujo de práctica se rotula como ficticio.
- [FiT EBC](https://www.ebc.mx/lp/fit/alumnos.php) y [referencia de servicios complementarios](https://www.ebc.mx/pdf/informativo-licenciaturas-ejecutivas.pdf): vinculación, Catapulta y EXU. Las sesiones y vacantes del catálogo no representan ofertas reales.

**Validar con EBC antes de considerar información oficial:** denominación vigente y oferta por campus/programa; elegibilidad, documentación, porcentajes y duración de cada beca; calendarios y convocatorias; trámites de servicio social/titulación; uso de las denominaciones Global EBC y EBC IA para actividades concretas. Hasta entonces las fechas y los procesos de Compass son ejemplos simulados.

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

### Revisión de conversaciones de F6

- Historial separado de «Mi contexto» mediante pestañas, con conversaciones recientes ordenadas por última actividad y señal de conversación actual.
- «Nueva conversación» como acción principal; renombrar y eliminar desde las opciones de cada fila, con edición y confirmación dentro del panel.
- Retirado el botón global «Borrar conversación»: la eliminación pertenece a cada conversación del historial.
- Pendiente la revisión visual en navegador para cerrar F6.

## 8. Decisiones

**Tomadas**
- **Lab con API Gateway REST API** para transmitir respuestas, y **un solo REST API para todo `/api/*`** (incluye las rutas existentes `/health` y `/opportunities`). Se avisa al equipo antes de tocar `platform/`.
- **Caché de prompts** del modelo, con medición previa (4.6).
- **Cognito simulado en local** con el emulador (4.7), y **authorizer de Cognito en el REST API del lab** (4.5): es el mismo contrato de identidad en ambos entornos.
- **Dirección visual:** inspirada en EBC pero fresca (v2 «Aurora»: encabezado claro, degradado cian→lima, Sora + Garamond de acento). Pendiente solo la **validación del área de marca de EBC** para el logo.
- **Guardrail con streaming:** opción A (transmitir y validar al final; si falla, `replace` por un aviso de validación y Reintentar).
- **Persistencia:** el historial completo se guarda en una **tabla nueva de DynamoDB sin TTL** (clave `PK = studentId`, `SK` por tipo de ítem); el checkpoint sigue siendo la memoria de trabajo y conserva su TTL, porque se puede reconstruir desde el registro.
- **Varias conversaciones por persona, aisladas:** `thread_id = <studentId>#<conversationId>`; toda ruta verifica pertenencia (404 si no es de la persona).
- **Compactación:** resumen al pasar un umbral, después de responder, **sin cifras ni fechas** (esos datos siempre salen de la hoja de hechos).
- **Memoria a largo plazo:** datos estables del alumno, con el perfil/claims como fuente de verdad, extracción de lo aprendido en conversación con lista de categorías permitidas, y control de la persona para verlos y borrarlos.
- **Personas:** las 8 + "sin perfil"; F3b sustituye el selector y `?persona=` por cuentas Cognito y login.
- **Valoraciones (F8):** persistir únicamente 👍/👎 por respuesta, sin motivos ni comentarios. El uso de estos datos se definirá más adelante; el panel administrativo y las evaluaciones quedan fuera del alcance actual.
- **Datos:** sustituir las becas inventadas por las reales de EBC (BEA y Respaldo Económico) y ampliar a 14 campus y 8 carreras, siempre rotulando lo no público como simulado.
- **Dependencias nuevas:** `react-markdown`, `remark-gfm`, y `aws-jwt-verify` o `jose`. Se ejecutan las suites disponibles; F3b añade pruebas de validación JWT y aislamiento de sesiones.
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
