# Guion de la demo: EBC Compass (5 a 7 minutos)

> Todo corre en local: AWS Emulator (DynamoDB, S3) + un puente que responde las llamadas de Bedrock con OpenAI. En el lab de AWS se quitan los endpoints locales y el mismo código usa Bedrock, la Knowledge Base sobre S3 Vectors y DynamoDB reales. Los datos y documentos son **simulados**.

## Antes de empezar (checklist, 5 min antes)

1. Abre **Docker Desktop** y espera a que arranque.
2. `npm run dev` y espera "✔ Todo listo". Abre http://localhost:5173.
3. `npm run doctor` debe terminar en "Todo en orden" (clave de OpenAI, puente, emulador, tabla, backend y frontend).
4. `npm run kb:status`: el Vector Store debe estar `completed` y no expirado (dura 30 días sin uso; si expiró: `npm run kb:upload`).
5. Prueba una pregunta en el chat y borra la conversación para empezar limpio.
6. Conexión a internet y clave de OpenAI válida (en `local/.env`).

**Plan B (sin internet o sin OpenAI):** detén todo y ejecuta `npm run dev:rules`. El asistente responde con reglas y plantillas en menos de 200 ms.

## Recorrido

| # | Pantalla | Qué hacer y decir | Resultado esperado |
|---|---|---|---|
| 1 | **Perfil** | Crear el perfil: *María*, campus *Ciudad de México Sur*, carrera *Finanzas*, semestre *5*. "El perfil se guarda en el navegador; no usamos datos reales." | Completitud 100 % |
| 2 | **Inicio** | Mostrar próximas fechas y recomendaciones del motor. "Cada recomendación tiene un enlace para preguntarle al asistente." | Foro Fintech, becas, etc. |
| 3 | **Oportunidades** | Abrir *Beca Santander Excelencia* → **Preguntar al asistente** | Llega al chat con la pregunta ya escrita |
| 4 | **Chat** | Enviar. "El LLM solo redacta: los datos salen del catálogo y de los documentos, y un guardrail rechaza cualquier dato inventado." | Requisitos (promedio 9.0), monto, fecha límite 30/11/2026, fuentes citadas y "Redactada con IA · X s" |
| 5 | **Chat** | Seguimiento: *¿y la fecha límite?* | Fechas de las becas (conserva el tema) |
| 6 | **Chat** | *¿Qué prerrequisitos tiene FIN-301?* | MAT-101 y CON-101; "ya completaste…" si el perfil los tiene |
| 7 | **Chat (inglés)** | *Which certifications do you recommend?* | Responde en inglés: Bloomberg Market Concepts y Certificación AMIB |
| 8 | **Chat** | Pregunta sin sentido: *qwerty* | No entiende y ofrece 3 preguntas alternativas |
| 9 | **Perfil** | *¿Hay un dato académico incorrecto?* → abre el chat con la pregunta | Pasos para corregir un dato (5 días hábiles) |
| 10 | **Chat** | **Borrar conversación** | Vuelve al estado inicial; se elimina también en DynamoDB |
| 11 | **Móvil** | Reducir la ventana (≈375 px) | Navegación inferior y chat utilizables |

## Qué decir sobre la arquitectura (1 minuto)

- **Frontend** React + Vite → **backend** Express con un **grafo de LangGraph** determinista (idioma → intent → hechos → conocimiento → redacción → guardrail).
- **Conversaciones** en DynamoDB mediante un checkpointer propio (portado del de AWS), con TTL.
- **Conocimiento**: 12 documentos simulados en un Vector Store de OpenAI hoy; en producción, la misma consulta (`Retrieve`) va a una Knowledge Base de Bedrock sobre **S3 Vectors** (`npm run kb:export` ya genera los archivos y metadatos para S3).
- **LLM**: se llama a **Bedrock Converse**; en local un puente lo traduce a OpenAI.

## Si algo falla

| Síntoma | Qué hacer |
|---|---|
| El asistente responde "por reglas" con un aviso amarillo | El modelo o el puente no respondieron; es el comportamiento previsto. Revisa `npm run doctor` |
| "No pudimos conectar con el asistente" | El backend no está arriba: `npm run dev`; luego **Reintentar** |
| Se perdieron las conversaciones | Se reinició el emulador (datos en memoria); empieza una nueva |
| Respuestas muy lentas | Baja `OPENAI_REASONING_EFFORT` a `medium` en `local/.env` y reinicia `npm run dev` |
| Puerto ocupado | `lsof -i :3000` (o 5173, 8787) y cierra ese proceso |

## Después de la demo

- `npm run stop` detiene el emulador (borra sus datos).
- `npm run kb:reset` elimina el Vector Store y sus archivos de OpenAI.
