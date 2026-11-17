# Memoria a petición

Compass reconoce al inicio del mensaje «recuerda que…», «no olvides que…» o «remember that…». Usa el modelo seleccionado para extraer un dato académico/profesional. Si encaja exactamente en una categoría editable existente, guarda su valor controlado; en otro caso redacta una nota breve en tercera persona. Trabajar por las tardes no equivale a estar disponible por las tardes.

- Máximo 10 notas por cuenta y 200 caracteres por nota. Slots fijos y escrituras condicionales evitan superar el límite con peticiones concurrentes.
- La confirmación se construye después de persistir; no la redacta el modelo. Ante rechazo, ausencia del modelo o fallo de almacenamiento se informa que no se guardó.
- Las notas se consultan y corrigen en `GET /api/assistant/memory` y `PUT /api/assistant/memory/note:1` (slots 1 a 10). La corrección vuelve a pasar por extracción y filtros. `DELETE` permite olvidar una nota o toda la memoria. Todas las rutas usan la identidad verificada.
- Las categorías provenientes del perfil se cambian en Perfil. Los valores guardados explícitamente por el usuario no se sobrescriben mediante extracción automática.
- Preguntas sobre la propia meta, horario o recuerdos consultan la memoria de la cuenta sin inventar datos. Si no hay una meta guardada, Compass pide aclararla. Los filtros de inyección y datos de terceros se aplican antes de esta consulta.
- En otra conversación las notas se incluyen en `<MEMORIA>` como contexto no autoritativo. Las solicitudes explícitas no se reextraen durante el mantenimiento ni se usan como mensajes de contexto.
- El olvido se realiza desde el panel; pedirlo por chat todavía no ejecuta el borrado.
- Olvidar memoria conserva el historial; para borrar conversaciones hay una acción independiente.
- En modo reglas no se extraen notas nuevas. Las ya guardadas siguen visibles y se pueden olvidar.

## Protección y límites

Antes de enviarlo al extractor se revisan indicadores de credenciales, identificadores financieros, salud, datos de terceros e instrucciones. El resultado del modelo se valida y filtra otra vez; el guardrail nativo se aplica si está configurado. Es una protección heurística para la demo: puede tener falsos positivos y no garantiza detectar cualquier dato sensible. Usar únicamente datos ficticios.

La extracción tiene 15 segundos de plazo y usa el proveedor existente. No agrega rutas ni servicios AWS nuevos. La tabla de conversaciones almacena los recuerdos con claves por identidad.

## AgentCore Memory

Pendiente de evaluación en el lab: comparar extracción, aislamiento por estudiante, corrección, borrado, retención y coste con la tabla actual. No hay migración ni integración activa; el contrato del panel se mantiene como referencia para una futura sustitución del almacenamiento.
