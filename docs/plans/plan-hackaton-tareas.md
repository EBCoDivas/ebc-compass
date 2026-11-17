# Tareas previas al hackatón

Todo se construye en local, sobre el emulador, y queda listo para desplegarse en AWS el día del hackatón.
Cada tarea va en su propia rama `feature/<nombre-de-la-tarea>` con Pull Request, pruebas y evidencia.

## Qué vamos a mostrar

Compass acompaña al alumno según la etapa en que está: le dice solo lo que le toca ahora, se adelanta a lo que necesita y le ayuda a resolverlo.

**Capacidades agénticas (dos):**

1. **Agente proactivo de seguimiento.** Le habla primero al alumno: elige y ordena lo que le conviene según su etapa y le avisa antes de que pregunte.
2. **Agente del chat que resuelve.** Consulta los datos del alumno, responde con fuentes y propone acciones que el alumno confirma.

**Acciones con confirmación (dos):**

- **Solicitar la beca de primer ingreso.** Revisa requisitos, indica lo que falta y llena la solicitud. Queda "en revisión".
- **Generar la ficha de pago de inscripción.** Monto, referencia y fecha límite calculados por reglas. Es una ficha simulada: Compass no cobra.

**Logros:** se desbloquean con hitos reales del alumno, calculados con reglas.

**Principio:** la IA decide qué sugerir, cómo explicarlo y qué herramienta usar. Las reglas deciden lo oficial: trámites obligatorios, elegibilidad, montos y fechas. El alumno confirma toda acción.

## Workflow

```
                 ┌────────── MCP (datos del alumno) ──────────┐
                 │                                             │
  Inicio de sesión / cambio de pendientes          Alumno escribe o toca un aviso
            │                                                  │
            ▼                                                  ▼
  [IA] Agente de seguimiento ──── aviso con contexto ────► [IA] Agente del chat
   · lee etapa, pendientes y memoria                        · usa herramientas del MCP
   · elige y ordena opcionales                              · responde con fuentes
   · escribe avisos                                         · propone acciones
            ▲                                                  │
            │                                                  ▼
            │                                     [humano] Tarjeta de confirmación
            │                                                  │
            │                                                  ▼
            └──── recalcula la ruta ◄──── [reglas] Ejecutor + logros
```

| Tipo | Piezas |
|---|---|
| Determinista (reglas) | Guardrails de entrada y salida, ruta y obligatorios, elegibilidad, montos, fechas, ejecutor de acciones, logros |
| No determinista (IA) | Agente de seguimiento y agente del chat |
| Humano | Confirmación de cada acción |

Si el modelo falla, la ruta y los avisos se muestran con reglas.

## Tareas

### 1. Datos por etapa y pendientes del alumno

- Contrato de datos con dos partes: **catálogo** (lo que ofrece EBC) y **pendientes del alumno** (qué le toca, con estado y fecha). Lo usan todas las demás tareas.
- Etapa en cada oportunidad (nuevo ingreso, a mitad de carrera, cierre o todas). Alertas, calendario y recomendaciones filtran por etapa.
- Cuenta nueva de Ana Lucía Torres en 1.er semestre, con la misma carrera y campus que la de 7.º.
- Escena de 1.º: beca de primer ingreso con requisitos y fecha límite, tarifas simuladas de inscripción y pendientes de nuevo ingreso.
- Escena de 7.º: requisitos de titulación de Contaduría, horas de servicio social acumuladas con un ritmo que no alcanza a tiempo y opciones de servicio social con horario, algunas por la tarde.
- Memoria de Ana en 7.º precargada con "trabaja por las tardes".
- Pendientes coherentes para las demás personas demo.
- Prueba de coherencia: a nadie le aparece algo fuera de su etapa y cada pendiente apunta a algo del catálogo.

**Listo cuando:** Ana en 1.º y Ana en 7.º ven Inicio, alertas, calendario y recomendaciones distintas, y la prueba de coherencia pasa.

Responsable: ______

### 2. Ruta y logros

- "Lo que te toca ahora": obligatorios, pasos y estados, con un máximo de pendientes según la etapa.
- Logros por hitos reales: beca solicitada, ficha de pago generada, servicio social avanzado.
- Reglas de cálculo que usan los agentes: elegibilidad de la beca, monto y referencia de la ficha, y si las horas de servicio social alcanzan para la fecha de titulación.

**Listo cuando:** cada cuenta ve su ruta y sus logros, y los cálculos tienen pruebas.

Responsable: ______

### 3. Servidor MCP con los datos del alumno

- Herramientas de lectura: contexto del alumno (etapa, pendientes y memoria), requisitos de un trámite o beca, oportunidades, avance académico y búsqueda en la base de conocimiento.
- Modo de datos fijos para pruebas repetibles.

**Listo cuando:** las herramientas devuelven los datos de la tarea 1 para cualquier persona demo.

Responsable: ______

### 4. Agente proactivo de seguimiento (prioridad)

- Se dispara al iniciar sesión y cuando cambian los pendientes. Guarda su resultado para no llamar al modelo en cada visita.
- Elige y ordena opcionales dentro de los límites de las reglas: nunca omite un obligatorio ni sugiere algo fuera del catálogo o de la etapa.
- Escena de 1.º: avisa de la beca de primer ingreso.
- Escena de 7.º: detecta que el servicio social no alcanza para la fecha de titulación y propone opciones por la tarde, usando la memoria.
- Al tocar un aviso, el chat se abre con ese contexto.
- Si el modelo falla, se muestran avisos generados con reglas.

**Listo cuando:** los dos avisos aparecen sin que Ana pregunte, y tocar uno abre el chat sabiendo de qué se trata.

Responsable: ______

### 5. Chat con herramientas y acciones con confirmación

- El agente del chat usa las herramientas del MCP y responde con fuentes.
- Acciones: solicitar la beca de primer ingreso y generar la ficha de pago de inscripción (la ficha menciona la beca en revisión).
- Se ejecutan solo después de confirmar en la tarjeta, con un ejecutor determinista: idempotente, auditado y con la identidad del token.
- Al confirmar, se actualizan la ruta y los logros.
- "Siempre una salida": si Compass no puede resolver algo, da el siguiente paso concreto o canaliza con Servicios Escolares.

**Listo cuando:** ninguna acción se ejecuta sin confirmación, hay una prueba que lo demuestra, y lo confirmado aparece en Inicio.

Responsable: ______

### 6. Traza y panel de administración

- Registro de lo que hace cada agente: cuál actuó, qué herramientas usó, latencia, resultado del guardrail y valoración 👍/👎.
- Rol `admin` en Cognito, con una persona admin de prueba.
- Una sola pantalla con la traza de cada conversación y aviso, y los bloqueos del guardrail.

**Listo cuando:** la persona admin ve la traza de la demo recién hecha, incluido un intento de inyección bloqueado, y un alumno no puede entrar.

Responsable: ______

## Criterio común: listo para desplegar

- Todo corre en el emulador con los servicios de AWS que se usarán en el lab (DynamoDB, Lambda, Cognito).
- La configuración va por variables de entorno. Nada depende de atajos que solo existan en local.
- El agente proactivo queda listo para dispararse con EventBridge Scheduler en AWS.

## Orden

1. **Tarea 1**, empezando por el contrato de datos.
2. **Tareas 2 y 3** en paralelo. La 6 empieza aquí con el registro y el rol.
3. **Tareas 4 y 5** en paralelo.
4. **Tarea 6** se cierra al final.

## Fuera del alcance

Planificador con especialistas, inscripción a cursos, evaluaciones con Bedrock como juez, selector de modelo, medallas sin hitos reales y estadísticas grandes en el panel. Las preguntas de oro actuales siguen corriendo en las pruebas.

## La historia para el speech

Protagonista: **Ana Lucía Torres**, Contaduría, campus Querétaro. Una sola persona con un salto en el tiempo.

1. **El dolor.** Llegar a la universidad es abrumador: trámites, pagos, fechas, becas. El alumno no sabe qué hacer primero, y la información llega toda junta.
2. **Ana entra a Compass en 1.er semestre.** No ve veinte cosas: ve pocos pendientes y su ruta. El agente proactivo le avisa, sin que pregunte, que la beca de primer ingreso cierra pronto y que cumple los requisitos.
3. **Toca el aviso y se abre el chat** ya con el contexto. Compass le explica los requisitos, le dice qué le falta y prepara la solicitud. Ana confirma: la solicitud queda en revisión y desbloquea un logro.
4. **Pregunta cómo pagar su inscripción.** Compass genera la ficha con monto, referencia y fecha límite, y le recuerda que su beca está en revisión. Ana confirma y desbloquea otro logro.
5. **Salto en el tiempo: Ana en 7.º.** El mismo Inicio, otras prioridades: servicio social, prácticas y titulación. El agente proactivo detecta que, a su ritmo, no le alcanzan las horas de servicio social para titularse a tiempo, y le propone opciones por la tarde porque recuerda que trabaja en ese horario.
6. **Detrás de cámaras (30 a 45 segundos).** La traza de lo que acaba de pasar: qué agente actuó, qué herramientas usó y un intento de inyección bloqueado. Para EBC, este panel también muestra qué confunde a los alumnos de cada etapa.
7. **Cierre.** Dónde está el proyecto en madurez: repositorio y flujo de PR estándar, pruebas continuas con preguntas de oro y setup en un comando (Repetible), más observabilidad y guardrails (pasos hacia Confiable). Siguiente paso: conectar los datos reales de Banner a través del mismo MCP.

**Mensajes que el jurado debe llevarse:**

- Compass le dice a cada alumno solo lo que le toca según su etapa.
- Se adelanta: no espera a que el alumno pregunte.
- Siempre da una salida: nunca deja al alumno con la duda.
- La IA sugiere; las reglas deciden lo oficial; el alumno confirma.
