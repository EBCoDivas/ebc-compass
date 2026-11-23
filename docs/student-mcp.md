# MCP de datos del alumno

AgentCore Gateway publica cinco herramientas de lectura de Compass. El Gateway invoca una sola Lambda de herramientas. Banner simulado es otra Lambda privada con un contrato JSON versionado. `getStudentRecord` recibe la matrícula verificada y devuelve `{ record }`. `getEnrollmentActions` consulta el estado por cuenta y matrícula. `confirmEnrollmentAction` recibe la propuesta archivada y vuelve a evaluar sus condiciones. Inicio y MCP reutilizan el mismo lector.

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

El aprovisionamiento de `npm run dev:rules` crea Banner y su tabla `BannerActions` e intenta aprovisionar el Gateway y su destino en AWS Emulator. Requiere las dependencias de backend y el comando `zip` para empaquetar las Lambdas. Para las operaciones con estado, el backend local ejecuta el mismo manejador de Banner y se conecta a DynamoDB del emulador. En el lab esas operaciones se invocan directamente en la Lambda privada. Con backend en marcha, `npm run mcp:verify` comprueba la lectura de dos cuentas y su correspondencia con la API de avance.

En AWS Emulator usa `MCP_TRANSPORT=local` en `local/.env` y vuelve a arrancar. El emulador aprovisiona el Gateway y ejecuta la Lambda de herramientas, pero no reenvía la cabecera con el contexto del alumno ni el prefijo `compass___` del nombre de la herramienta, así que `npm run mcp:verify` falla con el transporte `gateway`. Con `local`, el cliente ejecuta el mismo contrato MCP sin puerto público y Banner sigue ejecutándose como Lambda en el emulador. El diagnóstico indica el transporte. El modo local no está permitido en un stage de AWS; el Gateway real se valida en el lab.

## Hackatón

El despliegue SST crea las dos Lambdas, AgentCore Gateway, el destino y sus permisos. Con las credenciales del lab, ejecuta `npm run lab:deploy -- --confirm --skip-smoke --verify-mcp` para desplegar, registrar las cuentas y probar MCP sin interacciones del chat. El despliegue carga el corpus con el proceso de conocimiento existente. Si ya está desplegado y las cuentas están registradas, basta `npm run lab:mcp`. El principal que ejecuta la prueba necesita `bedrock-agentcore:InvokeGateway` sobre ese Gateway y permisos para iniciar las sesiones de prueba de Cognito.

## Chat y confirmación

El chat usa las herramientas MCP con el contexto de la sesión verificada. En modo LLM, Bedrock Converse elige herramientas en una ronda acotada. El chat usa los hechos y los fragmentos verificados para responder con fuentes. El puente local traduce esa selección a llamadas de función de OpenAI. `npm run dev:rules` permite ensayar la historia por reglas y con el mismo transporte MCP. En el lab, cada selector usa el modelo detectado por el despliegue como valor por omisión. `BEDROCK_LUNNA_MODEL_ID` y `BEDROCK_TERRA_MODEL_ID` permiten configurarlos por separado.

1. Inicia sesión como Ana de primer semestre y abre **Preparar con Compass** desde su ruta. Revisa los requisitos y la fecha que trae MCP, sube la [carta de motivos de Ana](demo/carta-de-motivos-ana-torres.pdf) en la tarjeta y selecciona **Enviar solicitud**. Banner registra la solicitud **En revisión** y en Inicio se desbloquea **Beca solicitada**.
2. Abre **Pagar con Compass** o di «Quiero pagar mi inscripción». La tarjeta muestra el importe, la fecha límite y la tarjeta registrada. Al seleccionar **Pagar**, Banner registra el pago, emite el comprobante y desbloquea **Inscripción pagada**. Puedes consultar el comprobante desde Inicio.
3. Entra como Ana de séptimo y pregunta «¿Cómo va mi servicio social y qué opciones tengo?». Compass consulta las horas y la memoria de horario, y presenta el cálculo y opciones del catálogo con sus fuentes.

Las herramientas de preparación devuelven una propuesta. El ejecutor recibe una confirmación autenticada y envía a Banner la propuesta del turno guardado. Banner revisa el expediente, las fechas y el importe de su catálogo antes de guardar el resultado y la auditoría en `BannerActions`. La escritura condicional reúne ambos trámites por cuenta y matrícula. Los reintentos devuelven el mismo resultado, incluso si se perdió la respuesta después de la escritura. El pago opera con importes simulados y no requiere datos bancarios.
