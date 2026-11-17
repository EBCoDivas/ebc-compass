# Mejoras previas a las tareas del hackatón

Cinco mejoras que se hacen antes de las tareas de [plan-hackaton-tareas.md](plan-hackaton-tareas.md).
Están ordenadas para que ninguna se tenga que rehacer cuando lleguen esas tareas.
Cada mejora va en su propia rama `feature/<nombre>` con Pull Request, pruebas y evidencia.

## Estado del avance

- Fase 1 implementada en `feature/mejoras-previas`: validación automatizada local del setup y del historial completada. Pendientes pruebas en máquinas nuevas de cada sistema y revisión manual en navegador.
- Fase 2 implementada para validación local; capa nativa de Bedrock declarada, pendiente de despliegue y comprobación en el lab.
- Fase 3 implementada en local con contrato compartido, avance demo en Inicio y recomendaciones agrupadas con razones. Pendiente revisión manual en navegador.
- Fase 4 implementada para validación local; requiere configurar los dos modelos de Bedrock por entorno. Fase 5 implementada con la tabla actual: extracción mediante el modelo, hasta 10 notas de 200 caracteres, corrección y olvido. Evaluación de AgentCore Memory y prueba en AWS pendientes.

## Fase 1: base estable

Dos arreglos rápidos y sin dependencias entre sí. Se pueden hacer en paralelo.

### 1.1 Setup para quien baja el repo por primera vez

**Hoy:** `npm run setup` se detiene si falta Docker o si Node no es la versión 22, y solo avisa si falta el AWS CLI.

**Objetivo:** que una persona nueva ejecute un solo comando y sepa exactamente qué le falta y cómo resolverlo.

- Detectar el sistema operativo (macOS, Windows, Linux) y revisar cada prerrequisito: Docker, AWS CLI y lo que use el emulador.
- Para lo que falte, mostrar el comando de instalación de ese sistema (por ejemplo, `brew install --cask docker` en macOS o `winget` en Windows) y ofrecer ejecutarlo **solo con confirmación** de la persona. Nunca instalar en silencio.
- **Node:** no se instala ni se cambia de versión. Si falta o no es la versión requerida, solo se muestra una alerta con la versión esperada, para que cada quien lo configure a su manera (nvm, fnm, instalador oficial).
- Al final, un resumen con ✔ / ⚠ / ✖ y el siguiente paso, alineado con `npm run doctor`.
- Actualizar la sección de arranque del README y `local/README.md`.

**Listo cuando:** en una máquina sin Docker, el setup lo detecta, ofrece instalarlo, y con Node en otra versión solo muestra la alerta sin detenerse en lo demás.

Responsable: ______

### 1.2 El chat conserva fuentes, tiempo y sugerencias al recargar

**Hoy:** al recargar, el último mensaje pierde las fuentes, el tiempo de respuesta (en segundos) y las preguntas sugeridas para continuar.

**Hallazgos en el código:**
- El tiempo de respuesta (`latencyMs`) se calcula en la ruta y se envía en la respuesta, pero **no se guarda** en el historial.
- Las fuentes y las sugerencias sí se guardan en el backend y el frontend las lee al recargar, así que hay que reproducir dónde se pierden: en el guardado, en la lectura del historial o al pintarlas.
- El aviso de "respuesta con reglas básicas" (`degraded`) tampoco se guarda y desaparece al recargar.

**Alcance:**
- Guardar en el historial los datos del mensaje que la interfaz muestra: tiempo de respuesta, modo (`llm` / reglas) y si fue degradada.
- Corregir la pérdida de fuentes y sugerencias.
- Prueba de ida y vuelta: enviar, recargar y comparar lo que se ve antes y después.

**Listo cuando:** después de recargar, el último mensaje muestra las mismas fuentes, el mismo tiempo y las mismas sugerencias que antes de recargar.

Responsable: ______

### Evidencia de fase 1

- Setup y doctor comparten detección de Node, Docker, Compose y AWS CLI. Node solo genera aviso; Docker/Compose son obligatorios y AWS CLI es opcional.
- Instalaciones ofrecidas con confirmación en macOS/Homebrew y Windows/winget; Linux recibe instrucciones manuales. Sin terminal interactiva o con `--no-prompt` no se instala nada.
- Prueba del setup con PATH vacío: revisa las herramientas faltantes, muestra el siguiente paso y se detiene antes de crear archivos o instalar dependencias.
- El archivo de mensajes conserva `latencyMs`, `mode`, `degraded`, fuentes, sugerencias y métricas disponibles. JSON, SSE y Lambda usan el tiempo del turno guardado; el frontend restaura los mismos datos al abrir o recargar el chat. Los mensajes antiguos sin métricas no reciben tiempos inventados.
- Pruebas de ida y vuelta JSON/SSE → historial y de representación antes/después de recargar, sin OpenAI ni AWS real.
- No se ejecutó el setup completo, porque instala dependencias y aprovisiona recursos. Las plataformas Windows/Linux se cubren con pruebas de detección y planes de instalación, no con instalaciones reales. El Dockerfile actual del emulador sigue usando aarch64; el soporte nativo x86 no se valida en esta entrega.

## Fase 2: guardrails de entrada

**Hoy:** el guardrail revisa solo la **salida** del modelo (idioma y que no invente datos). Las preguntas de entrada no se filtran.

**Objetivo:** detectar antes de llamar al modelo las preguntas fuera de alcance o maliciosas, detenerlas y responder algo seguro.

- **Categorías:** fuera de alcance (temas ajenos a EBC), intento de manipular las instrucciones (inyección de prompt), contenido dañino o abusivo, y solicitud de datos de otras personas.
- **Respuesta segura** por categoría, en el idioma de la pregunta, que explique en qué sí puede ayudar Compass. Sin llamar al modelo.
- **Dos capas:** reglas locales (funcionan en el emulador y en pruebas) y, en el lab, Bedrock Guardrails como capa nativa de AWS. Esta segunda capa también cuenta para la demo.
- **Registro de cada bloqueo** con su categoría. Este dato lo usará después el panel de administración (tarea 5 del plan del hackatón).
- Conjunto de pruebas con preguntas válidas, fuera de alcance e intentos de inyección. Las preguntas de oro deben seguir pasando: ninguna pregunta legítima se bloquea.

**Listo cuando:** los intentos de inyección y las preguntas fuera de alcance reciben una respuesta segura sin llegar al modelo, y las preguntas de oro pasan igual que antes.

Responsable: ______

### Avance de fase 2

- Nodo `checkInput` antes del catálogo, la recuperación documental y el LLM; reglas locales y puerto de evaluación nativa compartidos por JSON/SSE/Lambda.
- Respuestas fijas por categoría e idioma, eventos `assistant.input.blocked` sin texto de la pregunta en los logs y campo `inputBlock` persistido en los mensajes.
- Mensajes bloqueados excluidos del contexto, los resúmenes y la extracción de memoria; acciones de feedback ocultas para las respuestas de bloqueo.
- Adaptador `ApplyGuardrail` con cinco segundos de plazo y bloqueo temporal ante fallo; guardrail versionado, variables y permiso sobre su ARN declarados en SST para ambas Lambdas.
- Pruebas de categorías, las 15 preguntas de oro, ausencia de llamadas a servicios posteriores, archivo/recarga JSON/SSE y fallo nativo simulado. Ver [contrato, límites y prueba manual](../input-guardrails.md).
- Validación: 47 pruebas backend, 24 frontend y 6 de plataforma aprobadas; typecheck de backend/frontend/local/lab/plataforma, lint, build y `git diff --check` correctos.
- La protección local es heurística. La eficacia nativa, sus falsos positivos y el flujo visual siguen pendientes de validación real; no se ejecutó ningún despliegue en AWS.

## Fase 3: avance académico y recomendaciones en Inicio

**Decisión:** no se crea una página "Dashboard". Se amplía Inicio, que ya tiene el rumbo y las recomendaciones, para no duplicar pantallas.

- **Contrato de datos primero:** definir la forma del avance académico (materias cursadas y totales, créditos, semestre y promedio si aplica). Debe ser **la misma** que después devolverá la herramienta MCP de Banner (tarea 2 del plan del hackatón), para que esa tarea solo cambie la fuente de datos y no la pantalla.
- **Datos simulados por persona:** cada una de las nueve cuentas demo tiene materias y créditos coherentes con su semestre. **Sin fórmulas inventadas.** Si un dato no existe, no se muestra.
- **Tarjeta de avance académico** en Inicio.
- **Recomendaciones agrupadas por tipo:** cursos, becas, eventos y trámites.
- **"Por qué te lo recomendamos"** con las razones del motor de reglas actual. La versión generada por IA queda para después y no requiere rehacer la interfaz.

**Listo cuando:** cada cuenta demo ve su propio avance y sus recomendaciones agrupadas con su razón, y el contrato de datos está documentado para la tarea de Banner.

Responsable: ______

### Avance de fase 3

- Contrato compartido HTTP/MCP en [`academic-progress-contract.md`](../academic-progress-contract.md), con campos opcionales y fuente intercambiable para Banner.
- Endpoint `GET /api/academic-progress` protegido por identidad verificada; deriva el registro de los claims y no acepta un identificador enviado por el cliente. La ruta autenticada ya está declarada en SST.
- Ocho cuentas demo con perfil tienen snapshots explícitos de materias, créditos y periodo; el promedio solo está presente donde se definió. La cuenta `sin-perfil` devuelve `progress: null`; no se deducen datos académicos de un semestre.
- Inicio carga la tarjeta de avance sin calcular valores faltantes y agrupa recomendaciones por cursos/desarrollo profesional, becas, eventos, trámites y oportunidades laborales. Cada recomendación muestra la explicación del motor de reglas.
- Sin AWS real: el endpoint y la fuente actual son simulados; Banner queda para sustituir el lector, manteniendo el contrato.

## Fase 4: elegir el modelo del chat

**Hoy:** el modelo es fijo por entorno (`BEDROCK_MODEL_ID`).

**Objetivo:** que en el chat se pueda elegir entre **Lunna** y **Terra**, y nada más.

- **Decisión:** modelos configurables por entorno; Lunna es el predeterminado.
- **Selector en el chat** (página y panel flotante), con una línea que explique la diferencia entre ambos, por ejemplo rapidez frente a profundidad.
- **Backend:** lista cerrada de dos modelos. La petición indica cuál usar y el backend rechaza cualquier otro valor. Cada modelo con su propia configuración de caché de prompts.
- **Local:** el puente de Bedrock debe traducir ambos nombres a modelos de OpenAI.
- **Registro:** el modelo usado se guarda en cada mensaje, para el panel de administración y para comparar en las evaluaciones.

**Listo cuando:** el alumno cambia de modelo, la siguiente respuesta usa el elegido, queda registrado en el mensaje y un valor distinto de Lunna o Terra se rechaza.

Responsable: ______

## Fase 5: memoria a petición

### Implementación local

- Solicitudes explícitas al inicio: «recuerda que…», «no olvides que…» y «remember that…».
- Extracción con el modelo elegido; categoría controlada si encaja o nota en tercera persona. Máximo 10 notas por cuenta, de 200 caracteres.
- Confirmación después de persistir. Sin modelo, ante fallo o rechazo, se informa que no se guardó.
- Notas visibles, corregibles con revisión del modelo y borrables en el panel. Olvidar memoria conserva el historial.
- Filtros de datos sensibles e instrucciones antes de extraer y guardar; capa nativa cuando está configurada. Defensa heurística para la demo.
- Tabla actual en local y lab; evaluación de AgentCore Memory pendiente en AWS.
- Validación: 56 pruebas backend, 26 frontend, typecheck y lint correctos. Guardado y corrección de una nota comprobados en Chromium con el modelo local. AWS pendiente.
- Detalle: [memoria a petición](../explicit-memory.md).


**Antes:** la memoria a largo plazo solo guarda 8 categorías fijas (carrera, campus, semestre, intereses, meta, horario, idioma y modalidad), con valores de una lista cerrada y detectadas con reglas de texto. Si el alumno pide "recuerda que trabajo por las tardes", no se guarda nada. Dentro de una misma conversación sí lo toma en cuenta (mensajes recientes y resumen), pero no en la siguiente.

**Objetivo:** que Compass guarde lo que el alumno le pide recordar explícitamente y lo use en conversaciones futuras.

- **Detectar la intención de recordar** ("recuerda que…", "no olvides que…", "remember that…") y extraer el dato con el modelo, no con reglas de texto.
- **Primero intentar una categoría existente:** si encaja en una de las 8 (por ejemplo, horario), se guarda ahí con su valor controlado.
- **Si no encaja, guardarlo como nota breve:** límite de longitud y de cantidad de notas por alumno, y redactada en tercera persona ("Trabaja por las tardes"), sin copiar el mensaje original.
- **Filtrar antes de guardar:**
  - Datos sensibles (contraseñas, números de cuenta o tarjeta, salud, datos de otras personas). `AGENTS.md` prohíbe guardar información sensible real.
  - Instrucciones o intentos de inyección. Un texto guardado vuelve a entrar al prompt en cada turno, así que pasa por el mismo filtro de entrada de la fase 2.
- **Confirmación en la respuesta:** Compass dice qué guardó ("Listo, recordaré que trabajas por las tardes"). Si no lo guardó, lo dice y explica por qué. Nunca promete recordar algo que no quedó guardado.
- **Visible y borrable:** las notas aparecen en "Lo que Compass recuerda", con las mismas acciones de corregir y olvidar que el resto de la memoria.
- **Uso en el prompt:** las notas entran en el bloque `<MEMORIA>`, que el prompt ya trata como contexto no autoritativo.
- **Para el hackatón:** evaluar AgentCore Memory como almacenamiento y extracción de esta memoria. No existe en el emulador, así que solo se puede probar en el lab; en local se mantiene la tabla actual.

**Listo cuando:** el alumno pide recordar algo, Compass confirma qué guardó, el dato aparece en "Lo que Compass recuerda", se usa en una conversación nueva, y un dato sensible o un intento de inyección no se guarda.

Responsable: ______

## Orden y relación con el plan del hackatón

1. **Fase 1** primero, en paralelo: deja el repo fácil de levantar y el chat confiable.
2. **Fase 2** después: el registro de bloqueos alimenta el panel de administración y el momento de "inyección bloqueada" de la demo.
3. **Fases 3 y 4** en paralelo. La 3 deja listo el contrato de datos que usará la tarea de Banner. La 4 deja registrado el modelo, que sirve para comparar en la tarea de evaluaciones.
4. **Fase 5** después de la 2, porque reutiliza su filtro de entrada para decidir qué se puede guardar.

## Decisiones pendientes

- **Lunna y Terra (resuelto):** configurables por entorno, con Lunna predeterminado.
- **Setup (resuelto en fase 1):** instalación asistida en macOS y Windows; instrucciones manuales en Linux.
- **Guardrails (resuelto en fase 2):** reglas locales activas y capa Bedrock declarada desde esta fase; despliegue y prueba real en el lab pendientes.
- **Memoria a petición (resuelto para esta fase):** 10 notas de 200 caracteres; tabla actual. AgentCore Memory pendiente de evaluación en el lab.
