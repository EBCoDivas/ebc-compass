# MCP de datos del alumno

AgentCore Gateway publica cinco herramientas de lectura de Compass. El Gateway invoca una sola Lambda de herramientas. Banner simulado es otra Lambda, privada, con la operación `getStudentRecord` (versión 1). Solo recibe la matrícula verificada y devuelve `{ record }`. No hay una URL pública para Banner. Inicio y MCP reutilizan el mismo lector, y los contratos de `GET /api/academic-progress` y `GET /api/student-planning` se conservan.

| Herramienta | Entrada | Fuente |
|---|---|---|
| `get_student_context` | Ninguna | Ruta, cálculos y pendientes de Compass; memoria de la sesión; expediente de Banner. |
| `get_requirements` | `opportunityId` | Requisitos, fechas y condiciones del catálogo de la cuenta. |
| `list_opportunities` | `type` opcional | Catálogo filtrado por etapa, campus y carrera. |
| `get_academic_progress` | Ninguna | Contrato de avance académico desde Banner. Sin expediente devuelve `{ progress: null }`. |
| `search_knowledge` | `query`, `language` (`es` o `en`) | Hasta tres fragmentos de guías con su fuente. |

El cliente de servidor parte de la sesión Cognito verificada y firma con SigV4 para invocar el Gateway; el destino se llama `compass`. Los argumentos del MCP no admiten IDs de alumno. IAM limita quién puede invocar el Gateway y cada Lambda. La cabecera de contexto se genera internamente para cada sesión: no se copian cabeceras del navegador, tokens ni datos de cuenta a la consulta vectorial. La memoria se lee sin escribir y respeta el olvido.

Las guías de orientación se publican en S3 y se recuperan mediante la base de conocimiento existente. El corpus no guarda expedientes, memoria, montos de pago ni fechas límite operativas. El catálogo de Compass aporta las fechas y tarifas; Banner aporta los datos del expediente para los cálculos.

## Ensayo local

El aprovisionamiento de `npm run dev:rules` crea Banner e intenta aprovisionar el Gateway y su destino en AWS Emulator. Requiere las dependencias de backend y el comando `zip` para empaquetar las Lambdas. Con backend en marcha, `npm run mcp:verify` verifica inicialización, herramientas, dos sesiones e igualdad con la API de avance. Usa guías por palabras clave para este ensayo y no llama al chat.

En AWS Emulator usa `MCP_TRANSPORT=local` en `local/.env` y vuelve a arrancar. El emulador aprovisiona el Gateway y ejecuta la Lambda de herramientas, pero no reenvía la cabecera con el contexto del alumno ni el prefijo `compass___` del nombre de la herramienta, así que `npm run mcp:verify` falla con el transporte `gateway`. Con `local`, el cliente ejecuta el mismo contrato MCP sin puerto público y Banner sigue ejecutándose como Lambda en el emulador. El diagnóstico indica el transporte. El modo local no está permitido en un stage de AWS; el Gateway real se valida en el lab.

## Hackatón

El despliegue SST crea las dos Lambdas, AgentCore Gateway, el destino y sus permisos. Con las credenciales del lab, ejecuta `npm run lab:deploy -- --confirm --skip-smoke --verify-mcp` para desplegar, registrar las cuentas y probar MCP sin interacciones del chat. El despliegue carga el corpus con el proceso de conocimiento existente. Si ya está desplegado y las cuentas están registradas, basta `npm run lab:mcp`. El principal que ejecuta la prueba necesita `bedrock-agentcore:InvokeGateway` sobre ese Gateway y permisos para iniciar las sesiones de prueba de Cognito. Las herramientas de escritura siguen en la tarea 5.
