# Conversaciones y memoria del asistente (F5c)

El registro completo se guarda en `Conversations`, separado de los checkpoints
operativos de LangGraph. La tabla nueva no tiene TTL. Un checkpoint conserva su
TTL de siete días; el adaptador ignora registros vencidos aunque DynamoDB todavía
no los haya eliminado físicamente. El historial puede reconstruir el contexto
cuando el checkpoint falta o ha expirado.

## Datos y escritura

La partición es siempre el `sub` autenticado. Las claves de ordenación son:

| Prefijo | Contenido |
|---|---|
| `CONV#id` | Título, fechas, vista previa, contador, idioma, último tema, resumen y cursores internos |
| `MSG#id#fecha#orden#messageId` | Mensaje íntegro; orden estudiante/asistente para fechas iguales |
| `TURN#id#requestId` | Resultado de un turno, para reintentos idempotentes |
| `MEM#categoría` | Hecho controlado, origen, mensaje fuente y fechas; o marca de olvido sin valor anterior |

El par estudiante/asistente, el contador y el resultado del turno se guardan en
una transacción condicional. Repetir `requestId` devuelve el mismo mensaje sin
generar otra respuesta. Reutilizarlo con otra pregunta produce 409. Las condiciones
persisten después de la ventana temporal de idempotencia propia de DynamoDB.
Los mensajes conservan fuentes, métricas del proveedor, errores de generación y
validación, alternativas del catálogo y la marca `interrupted`.

Hay un bloqueo temporal por conversación para impedir generaciones concurrentes
entre instancias de Lambda. La compactación tiene su propio bloqueo y no impide
que llegue un turno nuevo. Las actualizaciones de metadatos y memoria usan versiones
para evitar sobrescrituras concurrentes.

Si la escritura del registro falla después de generar, se intenta tres veces y
la respuesta se entrega con `meta.historyStatus: pending`. El turno queda en una
cola del checkpoint y se reintenta antes de generar el siguiente; el chat muestra
que está pendiente. No se anuncia guardado durable si falló. Si también falla el
checkpoint o expira antes de recuperarse el registro, esa cola no garantiza la
recuperación del turno: no sustituye una cola externa durable. Un fallo al leer
el registro o verificar pertenencia impide generar y se informa como error.

## Contrato HTTP

Todas las rutas requieren identidad verificada; `studentId` del cuerpo o de la
consulta no permite cambiar de propietario. Otra cuenta recibe 404 para una
conversación ajena. Los endpoints están bajo `/api/assistant`:

| Método y ruta | Contrato |
|---|---|
| `GET /conversations?limit&cursor` | `{ conversations, nextCursor? }`; páginas por clave, sin escaneos |
| `POST /conversations` | Crea y devuelve `{ conversationId, title }`; acepta un UUID opcional para reintentar la creación |
| `PATCH /conversations/:id` | `{ title }`, entre uno y ochenta caracteres; 204 |
| `GET /conversations/:id?limit&cursor` | `{ messages, nextCursor?, messageCount, ... }`; mensajes en orden cronológico |
| `DELETE /conversations/:id` | Elimina mensajes, resultados y checkpoint; conserva una marca técnica del ID sin contenido para impedir resurrecciones; 204 |
| `POST /messages` y `/messages/stream` | Admiten `conversationId`, `requestId` e idioma; JSON y SSE comparten el comportamiento durable |
| `GET /memory` | `{ facts, allowedValues }`, sin marcas de olvido |
| `PUT /memory/:key` | `{ value }` del conjunto permitido; 204; campos del perfil se corrigen desde el perfil |
| `DELETE /memory/:key` | Olvida esa categoría; 204 |
| `DELETE /memory` | Olvida todas las categorías; 204 |

`limit` admite de uno a cien elementos. Un cursor queda vinculado al prefijo de
la consulta y la partición siempre se fija en el servidor. Los errores usan
`{ code, message }`: 400 para entrada inválida, 401 sin sesión, 404 si no pertenece,
409 para conflictos y 503 si el registro no está disponible.

El cliente crea la conversación antes de enviar el primer mensaje y conserva el
ID de reintento cuando se corta el transporte. Una nueva tentativa después de un
fallo explícito del modelo usa otro ID, para permitir una generación nueva.
Al cargar el historial consume todas las páginas, sin el límite antiguo de veinte.
Los paneles de lista de conversaciones y administración de memoria corresponden
a F6; esta fase entrega las rutas y la base de persistencia.

## Compactación y contexto

El modelo recibe el sistema estable, la instrucción de idioma fuera del checkpoint
de caché, la memoria permitida, un resumen y hasta seis mensajes recientes más los
datos del turno. Nunca recibe el registro completo como historial.

Después de cerrar la respuesta HTTP se ejecuta el mantenimiento y se espera su
finalización también en Lambda. Al acumular doce mensajes no resumidos se compacta
lo anterior a los últimos seis. Los cursores permiten continuar sin releer todo.
Cada ejecución procesa como máximo cien mensajes por tarea.

Para controlar costo y evitar almacenar texto sensible libre, la compactación usa
una lista cerrada de temas y distingue orientación recibida de consulta pendiente.
No llama al modelo ni resume literalmente las respuestas. Las metas y preferencias
reconocidas se conservan por separado en la memoria. Esto mantiene el tema, pero
no sustituye un resumen narrativo de todas las decisiones; el usuario conserva el
registro completo para consultarlas. El resumen no contiene fechas, cifras ni
códigos extraídos del texto.

Los bloques `MEMORIA` y `RESUMEN` son contexto no autoritativo y quedan fuera de
`allowed`, la entrada del guardrail. No autorizan un monto, fecha o requisito.
Los logs registran cantidad de mensajes, caracteres y elementos de memoria,
incluyendo tamaños antes/después de compactar; no presentan esas longitudes como
un conteo real de tokens. Los tokens efectivos siguen en `meta.usage` cuando el
proveedor los informa.

## Memoria y control de la persona

Las categorías actuales son carrera, campus, semestre, intereses, meta, horario,
idioma y modalidad. Carrera/campus/semestre se siembran del perfil o claims
verificados, con prioridad de los claims actuales. Los datos opcionales del perfil
solo se incorporan si encajan en una categoría reconocida. Una cuenta sin perfil
empieza sin esos datos; no se infieren atributos faltantes.

La extracción de conversación acepta afirmaciones directas en primera persona y
solo guarda valores enumerados: por ejemplo, una meta de prácticas en banca o una
preferencia por actividades por la tarde. No guarda el texto original, detalles
de salud, situación financiera, identificaciones, contraseñas ni salida libre de
un modelo. Negaciones, afirmaciones sobre otras personas y categorías desconocidas
no producen recuerdos. El paso no consume inferencias adicionales.

Cada hecho registra origen (`profile`, `conversation` o `user` para edición manual),
mensaje fuente cuando corresponde, fecha de la afirmación y fecha de actualización.
Una afirmación antigua procesada tarde no reemplaza una más reciente. El perfil
vigente gana sobre lo aprendido; un recuerdo derivado del perfil se corrige desde
el perfil, no cambiando una copia en memoria.

Olvidar conserva una marca sin el valor anterior para impedir que un mantenimiento
pendiente o la siembra del perfil lo repongan. Para reactivar una categoría editable
se guarda explícitamente un valor permitido. El historial anterior al último olvido
se conserva para la persona, pero deja de enviarse como contexto reciente al modelo.
Olvidar memoria no elimina el perfil ni el registro completo; borrar una conversación
tampoco elimina automáticamente los recuerdos. Son controles separados.

## Migración y validación

Al abrir una conversación anterior, si solo existe su checkpoint, se importan los
mensajes que todavía contiene una sola vez. No se pueden recuperar mensajes que
ya se habían recortado o expirado antes de esta fase, ni fuentes/métricas que la
versión anterior no había guardado.

```sh
npm run provision
npm run verify:conversations
```

La verificación usa datos temporales y modo reglas contra DynamoDB del emulador:
historial de treinta mensajes, paginación, aislamiento, dos conversaciones,
idempotencia, expiración real del checkpoint y memoria/olvido. Limpia sus registros
y no llama a OpenAI. Las pruebas offline cubren además escrituras fallidas y su
cola, cancelación, migración, permisos HTTP y cifras no autorizadas por memoria.

SST declara la tabla sin TTL y permisos de lectura, escritura condicional,
consulta y borrado en lote acotados a su ARN para ambas funciones. Las transacciones
usan los permisos de las operaciones sobre sus ítems, según la [documentación IAM
de DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis-iam.html).
No se desplegó esta fase en AWS real. La persistencia local depende del emulador:
su almacenamiento sigue siendo efímero si se destruye o reinicia su estado.

Validación final: pruebas de backend, puente, frontend y plataforma aprobadas;
tipos de los cinco paquetes, build, lint, git diff --check y verify:lambda
correctos. El prompt del sistema es único y está escrito en español; la
instrucción de idioma se coloca después del punto de caché. Cero llamadas a
OpenAI en esta fase.
