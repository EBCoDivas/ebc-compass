# Tareas previas al hackatón

Todo se construye en local, sobre el emulador, y queda listo para desplegarse en AWS el día del hackatón.
Cada tarea va en su propia rama `feature/<nombre-de-la-tarea>` con Pull Request, pruebas y evidencia.

## Qué vamos a mostrar

Compass acompaña al alumno según la etapa en que está: le dice solo lo que le toca ahora, se adelanta a lo que necesita y le ayuda a resolverlo.

**Capacidades agénticas (dos):**

1. **Agente proactivo de seguimiento.** Le habla primero al alumno: elige y ordena lo que le conviene según su etapa y le avisa antes de que pregunte.
2. **Agente del chat que resuelve.** Consulta los datos del alumno, responde con fuentes y propone acciones que el alumno confirma.

**Acciones con confirmación (dos):**

- **Solicitar la beca de primer ingreso.** Revisa requisitos, indica lo que falta y Ana sube su carta de motivos (PDF o Word) en la tarjeta. Queda "en revisión".
- **Pagar la inscripción.** Compass muestra el importe, la fecha límite y la tarjeta que ya tiene registrada en su expediente (un número de prueba). Ana confirma el pago y Banner emite un comprobante y registra la inscripción como pagada.

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
- **Dos capas de datos.** La capa por etapa (nuevo ingreso, mitad de carrera y cierre) es compartida y se escribe una vez: inducción, charla de inicio, pago de inscripción y beca de primer ingreso. La capa por carrera (cursos, prácticas, requisitos de servicio social y de titulación) se escribe solo para las tres carreras de la demo.
- **Tres carreras con datos completos**, cada una con su cuenta:

  | Carrera | Cuenta | Etapa | Qué muestra |
  |---|---|---|---|
  | Contaduría | Ana, en 1.º y en 7.º (salto en el tiempo) | Nuevo ingreso y cierre | La historia completa, con la mayor profundidad |
  | Mercadotecnia | Diego, 5.º | Mitad de carrera | Prácticas, cursos y eventos de su área |
  | Derecho | Sofía, 9.º | Cierre | Titulación y servicio social con la fecha encima, en una carrera distinta a la de Ana |

- Cuenta nueva de Ana Lucía Torres en 1.er semestre, con la misma carrera y campus que la de 7.º.
- Escena de 1.º: beca de primer ingreso con requisitos y fecha límite, tarifas simuladas de inscripción y pendientes de nuevo ingreso.
- Escena de 7.º: requisitos de titulación de Contaduría, horas de servicio social acumuladas con un ritmo que no alcanza a tiempo y opciones de servicio social con horario, algunas por la tarde.
- Memoria de Ana en 7.º precargada con "trabaja por las tardes".
- Las demás cuentas demo no se escriben a mano: reciben los pendientes de su etapa por reglas, sin contenido propio de la carrera, para que nunca se vean vacías.
- Prueba de coherencia: a nadie le aparece algo fuera de su etapa o de su carrera, y cada pendiente apunta a algo del catálogo.
- **Subtarea: ingesta de la base de conocimiento desde S3, como en el lab.** Los documentos nuevos de esta tarea (por ejemplo la guía de inducción de nuevo ingreso) deben llegar a los vectores por el mismo camino que en AWS:
  - `kb:sync-s3` publica los documentos y sus `.metadata.json` en el bucket del emulador, como `lab:knowledge` en `KnowledgeDocuments`.
  - `kb:ingest` hace el papel de `StartIngestionJob`: lee el **bucket** (no la carpeta `knowledge/`), fragmenta, genera los embeddings con Titan v2 a través del puente y escribe los vectores. `kb:index` ejecuta ambos pasos.
  - La fragmentación imita la estrategia por omisión de Bedrock Knowledge Bases (fragmentos de unos 300 tokens que respetan los límites de oración, con traslape), la misma que usa la Knowledge Base del lab, que no declara otra estrategia. Es una aproximación: el conteo de tokens es estimado.
  - Los metadatos se escriben con las claves de Bedrock (`AMAZON_BEDROCK_TEXT_CHUNK`, `AMAZON_BEDROCK_METADATA`, `x-amz-bedrock-kb-source-uri`).
  - Lo que no se puede ensayar en local es el `StartIngestionJob` en sí: el emulador no ingiere. Eso se confirma en el lab.

- **Subtarea: intereses del onboarding alineados a la carrera.** Las opciones de intereses ya no son una lista fija igual para todos:
  - `shared/interests.json` define los intereses sugeridos por carrera (Contaduría, Mercadotecnia y Derecho) y una lista general para las demás carreras.
  - Cada interés se redacta con el vocabulario del catálogo, porque el motor de recomendaciones puntúa por coincidencia de texto con el título y la descripción. Si un interés no coincide con ninguna oportunidad, se ve útil pero no hace nada.
  - Los intereses precargados de las cuentas demo son opciones de esa lista, para que aparezcan seleccionados en el perfil.
  - Al escribir un interés propio, las sugerencias salen de la misma lista, no de reglas fijas.
  - Prueba de coherencia: cada interés sugerido coincide con al menos una oportunidad de su carrera.

**Listo cuando:** Ana en 1.º y Ana en 7.º ven Inicio, alertas, calendario y recomendaciones distintas, Diego y Sofía ven los de su carrera y etapa, la prueba de coherencia pasa, la base de conocimiento se indexa leyendo el bucket y las preguntas de oro siguen pasando, y el onboarding ofrece intereses distintos según la carrera.

Responsable: ______

### 2. Ruta y logros

- "Lo que te toca ahora": obligatorios, pasos y estados, con un máximo de pendientes según la etapa.
- Logros por hitos registrados: beca solicitada, inscripción pagada, servicio social avanzado.
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
- Acciones: solicitar la beca de primer ingreso y pagar la inscripción con la tarjeta registrada.
- Se ejecutan en Banner (simulado) después de confirmar en la tarjeta. Banner revalida los datos, la tarjeta registrada y la carta subida y guarda un resultado idempotente con auditoría por cuenta y matrícula en DynamoDB.
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

### 7. Acceso del jurado a las cuentas demo

Hoy las credenciales del lab quedan solo en `scripts/lab/.state/personas.json`, en la computadora de quien ejecutó `lab:personas`. El jurado no tendría cómo saber con quién entrar. Esta tarea deja todo preparado en el repositorio; el lab todavía no existe y se aplica el día del hackatón.

- **Contraseña compartida para las cuentas demo, en local y en el lab.** `provision` (local) y `lab:personas` la toman de una variable de entorno en lugar de generar una aleatoria por cuenta, para no depender de un archivo privado (`local/.state/cognito.json` o `scripts/lab/.state/personas.json`). Son cuentas ficticias con datos simulados.
- **Panel "Cuentas de demostración" en el inicio de sesión, en local y en el lab.** Se activa con un indicador de compilación, como el acceso local. Lista las cuentas por lo que representan, en el orden de la historia: Ana en 1.er semestre, Ana en 7.º, Diego y Sofía (y la persona admin cuando exista la tarea 6). Cada una con un botón "Usar esta cuenta" que rellena el correo y la contraseña. El inicio de sesión sigue siendo el real de Cognito. En local, el equipo deja de buscar credenciales en el archivo privado y la demo se ensaya igual que la verá el jurado.
- **Limpieza de cuentas en `lab:personas`.** Hoy solo crea y actualiza cuentas. Debe borrar las que ya no están en `shared/personas.json`, como ya hace `provision` en local, y registrar la cuenta de Ana en 1.º.
- **Guía corta para el jurado** en el envío del proyecto: la URL, las cuentas y qué mirar con cada una.
- **Aviso para el despliegue:** si el sitio es público, cualquiera puede llamar a Bedrock. Fijar una alarma de presupuesto y no publicar la URL fuera del jurado.

**Listo cuando:** quien abre la pantalla de inicio de sesión, en local o en el lab, ve las cuentas, entra con un clic y llega a Inicio con los datos de su etapa, y `provision` y `lab:personas` dejan exactamente las cuentas de `shared/personas.json`.

Responsable: ______

## Criterio común: listo para desplegar

- Todo corre en el emulador con los servicios de AWS que se usarán en el lab (DynamoDB, Lambda, Cognito).
- La configuración va por variables de entorno. Nada depende de atajos que solo existan en local.
- El agente proactivo queda listo para dispararse con EventBridge Scheduler en AWS.

## Orden

1. **Tarea 1**, empezando por el contrato de datos.
2. **Tareas 2 y 3** en paralelo. La 6 empieza aquí con el registro y el rol.
3. **Tarea 7** en cuanto termine la 2. Solo depende de las cuentas de la tarea 1 y se prepara sin el lab.
4. **Tareas 4 y 5** en paralelo.
5. **Tarea 6** se cierra al final.

## Fuera del alcance

Planificador con especialistas, inscripción a cursos, evaluaciones con Bedrock como juez, selector de modelo, medallas sin hitos reales y estadísticas grandes en el panel. Las preguntas de oro actuales siguen corriendo en las pruebas.

## La historia para el speech

Protagonista: **Ana Lucía Torres**, Contaduría, campus Querétaro. Una sola persona con un salto en el tiempo.

1. **El dolor.** Llegar a la universidad es abrumador: trámites, pagos, fechas, becas. El alumno no sabe qué hacer primero, y la información llega toda junta.
2. **Ana entra a Compass en 1.er semestre.** En Inicio ve sus próximos pasos. Compass le avisa que la beca de primer ingreso cierra pronto. Su promedio cumple el mínimo y todavía le falta la carta de motivos.
3. **Ana se postula a la beca desde el chat.** Abre el aviso y dice «Quiero solicitar la beca de primer ingreso». Compass consulta los requisitos y prepara la solicitud. Ana adjunta su [carta de motivos](../demo/carta-de-motivos-ana-torres.pdf) y pulsa **Enviar solicitud**. Banner registra la postulación **En revisión** y en Inicio se desbloquea **Beca solicitada**.
4. **Ana paga la inscripción a su carrera.** En el mismo chat dice «Quiero pagar mi inscripción». Compass muestra el importe, la fecha límite y la tarjeta registrada para el pago simulado. Ana revisa los datos, pulsa **Pagar** y recibe su comprobante. Al volver a Inicio, se ven los dos resultados de la escena: la beca sigue **En revisión** y aparece el logro **Inscripción pagada**.
5. **Salto en el tiempo: Ana en 7.º.** El mismo Inicio, otras prioridades: servicio social, prácticas y titulación. El agente proactivo detecta que, a su ritmo, no le alcanzan las horas de servicio social para titularse a tiempo, y le propone opciones por la tarde porque recuerda que trabaja en ese horario.
6. **Detrás de cámaras (30 a 45 segundos).** La traza de lo que acaba de pasar: qué agente actuó, qué herramientas usó y un intento de inyección bloqueado. Para EBC, este panel también muestra qué confunde a los alumnos de cada etapa.
7. **Cierre.** Dónde está el proyecto en madurez: repositorio y flujo de PR estándar, pruebas continuas con preguntas de oro y setup en un comando (Repetible), más observabilidad y guardrails (pasos hacia Confiable). Siguiente paso: conectar los datos reales de Banner a través del mismo MCP.

**Mensajes que el jurado debe llevarse:**

- Compass le dice a cada alumno solo lo que le toca según su etapa.
- Se adelanta: no espera a que el alumno pregunte.
- Siempre da una salida: nunca deja al alumno con la duda.
- La IA sugiere; las reglas deciden lo oficial; el alumno confirma.
