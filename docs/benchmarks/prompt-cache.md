# F5b: medición de tokens y caché de prompts

Medición local del 16 de noviembre de 2026, con el puente Bedrock → OpenAI,
`gpt-6-luna`, razonamiento `high`, SDK real y el prompt de la aplicación.
No se ejecutaron inferencias ni despliegues en AWS real.

## Resultado histórico del prompt corto

En la medición inicial, la caché explícita quedó **apagada por defecto** (`ASSISTANT_PROMPT_CACHE=off`).
En cuatro consultas con el mismo prompt se reportaron 550 tokens de entrada y
cero lecturas de caché. La prueba del sistema más una pregunta mínima consumió
301 tokens de entrada: es una cota superior del prefijo estático, no un conteo
exacto del sistema aislado. No se observó ahorro por caché.

El prompt ya ordena sistema estable → últimos cuatro mensajes → datos variables.
No se añadieron ejemplos de relleno ni documentos fijos para forzar un acierto.
Se mantienen los tres pasajes máximos y la ventana de cuatro mensajes. La caché
no sustituye el historial durable ni la memoria de F5c.

## Antes y después

La consulta de becas usa perfil demo y recuperación local por palabras clave
para mantener iguales los documentos. Las cuatro llamadas usan el mismo prompt
sin historial; cambia únicamente la solicitud de checkpoints al SDK.

| Caso | Entrada total | Lectura de caché | Salida | Tiempo del proveedor | Primer texto |
|---|---:|---:|---:|---:|---:|
| Antes: checkpoints apagados | 550 | 0 | 236 | 3938 ms | 2511 ms |
| Repetición, apagados | 550 | 0 | 203 | 3237 ms | 1980 ms |
| Después: checkpoint de sistema | 550 | 0 | 217 | 3659 ms | 2197 ms |
| Repetición, sistema | 550 | 0 | 219 | 3237 ms | 1977 ms |
| Sistema + pregunta mínima | 301 | 0 | 38 | 1174 ms | No medido |

En esa versión del puente, OpenAI aplicaba su propia caché y se ignoraban los checkpoints Bedrock.
Esta comparación comprueba la medición y que esos marcadores no alteran el texto
enviado al proveedor; no demuestra el comportamiento de caché explícita de Bedrock.
Las variaciones de salida y tiempo no se atribuyen a una mejora de caché.
No se calculan ahorros monetarios a partir de estas cinco muestras.

También se verificó una consulta completa con Cognito, RAG del vector store,
SSE y DynamoDB del emulador: 1327 tokens de entrada, 0 lecturas de caché y 326
tokens de salida. El proveedor terminó en 4595 ms y emitió el primer texto a los
2868 ms; la respuesta validada y las métricas llegaron en `done` y el turno
temporal se eliminó. El tamaño total de una petición no implica que su prefijo
estable alcance el mínimo.

## Configuración y contrato

- `off`: no envía checkpoints explícitos; puede existir caché implícita del proveedor.
- `system` (predeterminado actual): checkpoint después del sistema.
- `system-history`: añade otro al final del historial, antes de los datos del turno.

Solo se envían checkpoints a los modelos de la lista conservadora en
`backend/src/assistant/adapters/promptCache.ts`. Admite IDs regionales y ARNs de
perfiles de inferencia. Los modelos desconocidos siguen con inferencia normal,
sin checkpoints; `local-chat` traduce los marcadores a breakpoints explícitos en modelos OpenAI compatibles; en otros modelos omite esos parámetros.
No se fuerza un TTL personalizado. Antes de activar en el lab, comprobar el
modelo, el mínimo de tokens y el coste de escrituras en su documentación.

Bedrock publica mínimos distintos por modelo: Nova Lite y Sonnet 4.6 requieren
1024 tokens; Haiku 4.5 requiere 4096. El mínimo de prefijo publicado para el modelo
OpenAI de esta prueba es 1024. Las lecturas son de mejor esfuerzo, no garantizadas.
Fuentes: [Bedrock prompt caching](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html),
[OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching).

`meta.usage` en JSON y SSE, y los logs `assistant.llm.usage`, incluyen:

- `inputTokens`: entrada no leída ni escrita en caché, según la convención Bedrock.
- `totalInputTokens`: entrada total, incluyendo lecturas y escrituras.
- `cacheReadInputTokens`, `cacheWriteInputTokens`: solo si el proveedor los informa.
- `outputTokens`, `totalTokens`: contadores del proveedor, incluyendo razonamiento cuando corresponda.
- `latencyMs`: duración de la inferencia; `firstTokenMs`: primer fragmento de texto, solo en streaming.
- `checkpointMode`: marcadores solicitados al SDK tras comprobar compatibilidad; no indica un acierto.

La fórmula es `totalInputTokens = inputTokens + lecturas + escrituras`. LangChain
incluye las dos últimas en `input_tokens`; el adaptador las separa. OpenAI incluye
las lecturas en `prompt_tokens`; el puente las resta una sola vez al traducir.
Las escrituras se incluyen cuando se informa cache_write_tokens; si no, quedan ausentes y nunca se inventa un cero.
No se registran preguntas, perfiles, respuestas, tokens de sesión ni credenciales.
Un fallo sin métricas no se presenta como consumo cero.

## Reproducir

Con el entorno local en marcha y el puente reiniciado para cargar este código:

```sh
npm run verify:prompt-cache
npm --prefix backend run verify:stream
```

El primer comando hace cinco inferencias locales y guarda solo métricas y un hash
del prompt en `local/.state/prompt-cache-report.json`, ignorado por Git. Rechaza
endpoints que no sean localhost. No crea un vector store ni modifica conversaciones
demo. La recuperación del benchmark es por palabras clave; `verify:stream`
comprueba por separado RAG y persistencia reales del entorno local.

En el lab, `ASSISTANT_PROMPT_CACHE` se fija en el entorno del despliegue; SST lo
inyecta a ambas funciones. No hay recursos ni permisos AWS nuevos. El valor actual es system. El acierto real debe comprobarse en las métricas del modelo. La reducción del
esfuerzo de razonamiento se evalúa por separado con las preguntas de referencia
antes de cambiar su valor actual.

Validación: 23 pruebas de backend, 18 de frontend, 4 de plataforma y 1 del
puente aprobadas. Typecheck de backend/frontend/local/lab/plataforma, build,
lint y `git diff --check` correctos. La serialización de checkpoints se probó
con el SDK real y un servidor HTTP controlado; el ahorro en Bedrock real sigue
sin verificar.

## Actualización: prompt Markdown único y caché activa

El prompt corto fue reemplazado por un único assistant.md en
backend/prompts/. Recogen identidad, comportamiento del producto, fuentes, tipos de oportunidad,
reglas académicas, límites de actuación, privacidad y estilo. Se revisaron
requirements.md (RF-01 a RF-06, NF-03 y BR-01 a BR-05), design.md (alcance, asistente
y privacidad) y tasks.md (asistente bilingüe). Las restricciones antiguas de
asistente sin modelo y almacenamiento solo local se adaptaron al estado actual.
No se copian datos personales ni convocatorias variables al sistema estable.

El grafo lee el único archivo en español al inicializarse y lo reutiliza durante su vida útil. La instrucción de idioma se envía por separado en cada turno, después del punto de caché. Una preferencia explícita tiene prioridad sobre
la detección. El estado del sistema no incorpora perfil, documentos ni reloj.

Conteo offline aproximado con o200k_base del prompt compartido actual, sin consumir API:

| Versión | Caracteres | Tokens estimados |
|---|---:|---:|
| Español compartido | 12213 | 2451 |

Este conteo no equivale al tokenizer de Bedrock. Supera el mínimo de 1024 de
los modelos compatibles habituales, pero no prueba que alcance 4096 para Haiku
4.5. La selección automática del lab prioriza Nova Lite/Micro; un modelo fijado
explícitamente se respeta. No se rellena el prompt para mínimos de otros modelos.

ASSISTANT_PROMPT_CACHE=system queda activo por defecto en configuración, adaptador
y SST. En el puente, GPT-5.6/GPT-6 compatibles reciben un breakpoint explícito tras
el sistema y modo explicit con TTL de 30 minutos: no se escribe automáticamente
el bloque variable como otro punto de caché. El proveedor informa lecturas y,
cuando están disponibles, escrituras; ambas se separan de la entrada no cacheada.
Editar el Markdown cambia el prefijo y puede requerir calentarlo. Cambiar el idioma de respuesta conserva el prefijo.

Esta actualización se valida con pruebas offline de idiomas, carga única,
serialización, contabilidad y empaquetado Lambda. Se hicieron **cero llamadas a
OpenAI**; no se afirma un ahorro nuevo ni un acierto medido. Las muestras históricas
de la tabla anterior describen el prompt anterior y no se reutilizan como prueba
del nuevo.

Validación de la actualización: 25 pruebas de backend, 4 del puente, 18 de frontend
y 5 de plataforma aprobadas, además de typecheck, build, lint, git diff --check y
verify:lambda en modo reglas. Ninguna de estas comprobaciones llama a OpenAI.

### Criterio de alcance del producto

Los prompts definen reglas de operación del producto y no instruyen al asistente
a presentarse como demo ni a calificar globalmente los datos como simulados. Los
specs son referencia histórica del MVP y de la propuesta final, no un límite
inmutable de funcionalidades; prevalecen las decisiones de alcance acordadas
con el equipo. Las capacidades deben estar habilitadas y las acciones confirmadas
por el sistema antes de que el asistente afirme haberlas ejecutado. Se mantienen
la fundamentación en fuentes, las reglas académicas y la protección de datos.
Esta corrección no modifica los registros del catálogo ni los documentos fuente.
La documentación integral de la presentación actual queda para el cierre.
