# Tareas previas al hackatón

Trabajo de preparación. El despliegue en el lab de AWS se hace el día del hackatón.
Cada tarea va en su propia rama `feature/<nombre-de-la-tarea>` con Pull Request, pruebas y evidencia.

## 1. Base de datos del agente: telemetría, feedback y roles

- Registro por turno (intención, agente, herramientas usadas, resultado del guardrail, latencia), ligado al pulgar arriba o abajo de cada respuesta.
- Roles `student` y `admin` en Cognito, con una persona de prueba admin y autorización por rol en el backend.

**Listo cuando:** cada respuesta deja un registro y un estudiante no puede entrar a rutas de admin.

Responsable: ______

## 2. MCP con Banner simulado y documentos

- Prueba técnica del emulador (AgentCore Gateway, Lambda y Lambda en Python) para decidir cómo corre el MCP en local.
- Servidor MCP con herramientas de lectura: datos del alumno, materias cursadas, inscripciones, oportunidades y fechas.
- La búsqueda en el Vector Store se expone como otra herramienta, con un modo de datos fijos para pruebas repetibles.
- Datos simulados de Banner para las nueve personas. Cada oportunidad apunta al id de su documento en `knowledge/manifest.json`, y un script detecta contradicciones entre ambos.
- El perfil se llena con estos datos y se deja de pedir las materias terminadas.

**Listo cuando:** el agente responde con datos de Banner y fuentes de documentos.

Responsable: ______

## 3. Arquitectura multiagente

- Orquestador, agente de consulta (solo lectura) y agente de acciones (herramientas que escriben). Nada más.
- Los agentes usan las herramientas del MCP.
- Se compara contra el comportamiento actual con las preguntas de `knowledge/golden-questions.json`.

**Listo cuando:** las preguntas de oro pasan igual o mejor que antes, y se puede volver al grafo actual si algo falla.

Responsable: ______

## 4. Acciones del agente con confirmación

- Inscripción a un curso desde el chat, con tarjeta de confirmación (pendiente, confirmada, cancelada, error), y reflejo en el rumbo y el calendario.
- El mismo patrón para recordatorios y para agendar cita con Servicios Escolares.
- Las acciones son idempotentes, quedan auditadas y usan la identidad verificada del token.

**Listo cuando:** ninguna acción se ejecuta sin confirmación explícita, y hay una prueba que lo demuestra.

Responsable: ______

## 5. Panel de administración

- Una sola pantalla, solo para el rol `admin`.
- Conversaciones por usuario y traza de cada una (agente que respondió, herramientas usadas).
- Estadísticas: herramientas más usadas y pulgares arriba y abajo.
- Bloqueos del guardrail con su categoría.

**Listo cuando:** una persona admin ve la traza completa de una conversación, incluido un intento de inyección de prompt bloqueado.

Responsable: ______

## 6. Evaluaciones

- Arnés con las preguntas de oro: comprobaciones de intención, herramienta elegida y guardrail.
- Calidad de respuesta con Bedrock (modelo como juez).
- Comparación entre dos versiones de un prompt.

**Listo cuando:** hay un reporte reproducible y una comparación de dos versiones.

Responsable: ______

## Si sobra tiempo

- Oportunidades con IA y "por qué te lo recomendamos".
- Solicitud de beca asistida.

## Orden

1. Las tareas 1 y 2 van primero y en paralelo: las demás dependen de ellas.
2. La 3 y la 4 siguen en cadena.
3. La 5 avanza en paralelo en cuanto existe la 1.
4. La 6 se prepara en paralelo y se cierra cuando la 3 esté lista.

## Antes del día del hackatón

Todo se construye en el emulador, que no tiene LLM, AgentCore Memory ni evaluaciones reales de Bedrock.
Conviene reservar un rato previo para probar en AWS real, como mínimo, el servidor MCP y una respuesta del agente, para que los problemas de IAM no aparezcan el mismo día.
