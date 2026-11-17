# Mejoras previas a las tareas del hackatón

Cinco mejoras que se hacen antes de las tareas de [plan-hackaton-tareas.md](plan-hackaton-tareas.md).
Están ordenadas para que ninguna se tenga que rehacer cuando lleguen esas tareas.
Cada mejora va en su propia rama `feature/<nombre>` con Pull Request, pruebas y evidencia.

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

## Fase 3: avance académico y recomendaciones en Inicio

**Decisión:** no se crea una página "Dashboard". Se amplía Inicio, que ya tiene el rumbo y las recomendaciones, para no duplicar pantallas.

- **Contrato de datos primero:** definir la forma del avance académico (materias cursadas y totales, créditos, semestre y promedio si aplica). Debe ser **la misma** que después devolverá la herramienta MCP de Banner (tarea 2 del plan del hackatón), para que esa tarea solo cambie la fuente de datos y no la pantalla.
- **Datos simulados por persona:** cada una de las nueve cuentas demo tiene materias y créditos coherentes con su semestre. **Sin fórmulas inventadas.** Si un dato no existe, no se muestra.
- **Tarjeta de avance académico** en Inicio.
- **Recomendaciones agrupadas por tipo:** cursos, becas, eventos y trámites.
- **"Por qué te lo recomendamos"** con las razones del motor de reglas actual. La versión generada por IA queda para después y no requiere rehacer la interfaz.

**Listo cuando:** cada cuenta demo ve su propio avance y sus recomendaciones agrupadas con su razón, y el contrato de datos está documentado para la tarea de Banner.

Responsable: ______

## Fase 4: elegir el modelo del chat

**Hoy:** el modelo es fijo por entorno (`BEDROCK_MODEL_ID`).

**Objetivo:** que en el chat se pueda elegir entre **Lunna** y **Terra**, y nada más.

- **Decisión pendiente:** qué modelo de Bedrock hay detrás de cada nombre, y cuál es el predeterminado.
- **Selector en el chat** (página y panel flotante), con una línea que explique la diferencia entre ambos, por ejemplo rapidez frente a profundidad.
- **Backend:** lista cerrada de dos modelos. La petición indica cuál usar y el backend rechaza cualquier otro valor. Cada modelo con su propia configuración de caché de prompts.
- **Local:** el puente de Bedrock debe traducir ambos nombres a modelos de OpenAI.
- **Registro:** el modelo usado se guarda en cada mensaje, para el panel de administración y para comparar en las evaluaciones.

**Listo cuando:** el alumno cambia de modelo, la siguiente respuesta usa el elegido, queda registrado en el mensaje y un valor distinto de Lunna o Terra se rechaza.

Responsable: ______

## Orden y relación con el plan del hackatón

1. **Fase 1** primero, en paralelo: deja el repo fácil de levantar y el chat confiable.
2. **Fase 2** después: el registro de bloqueos alimenta el panel de administración y el momento de "inyección bloqueada" de la demo.
3. **Fases 3 y 4** en paralelo. La 3 deja listo el contrato de datos que usará la tarea de Banner. La 4 deja registrado el modelo, que sirve para comparar en la tarea de evaluaciones.

## Decisiones pendientes

- **Lunna y Terra:** qué modelo de Bedrock corresponde a cada uno y cuál es el predeterminado.
- **Setup:** si las instalaciones se ofrecen en los tres sistemas operativos o solo en macOS y Windows.
- **Guardrails:** si Bedrock Guardrails entra desde esta fase o solo las reglas locales, con Bedrock en el hackatón.
