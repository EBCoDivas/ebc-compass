# Verificación de RF-05 (asistente conversacional bilingüe)

- **Fecha:** 2026-11-16 · **Entorno:** demo local (AWS Emulator + puente a OpenAI, modelo `gpt-6-luna` con razonamiento `high`)
- **Cómo se verificó:** `npm run verify:rules` (5 ES + 5 EN, sin red), `npm run verify:flow` (flujo completo contra el backend), `npm run verify:llm` y comprobaciones manuales en el navegador. No hay pruebas automatizadas (decisión del equipo).

| # | Criterio (`requirements.md` RF-05) | Estado | Evidencia |
|---|---|---|---|
| 1 | Acepta texto en español | ✅ | `verify:rules` y `verify:flow` (preguntas en español con acentos, signos ¿? y erratas) |
| 2 | Acepta texto en inglés | ✅ | `verify:rules` (5 preguntas en inglés) y `verify:flow` ("Which certifications do you recommend?") |
| 3 | Responde en el mismo idioma | ✅ | `verify:flow` comprueba `language = en` para la pregunta en inglés; el detector es por tokens (no por subcadenas) |
| 4 | Coincidencia aproximada de palabras clave | ✅ | "becsa disponibles" → becas; "como me reinscribo" → trámite; "scholarhips for finance" → becas (EN); "fechas limte" → fechas |
| 5 | Contexto: carrera | ✅ | Respuestas "para Finanzas" y "Tomé en cuenta tu perfil (Finanzas, semestre 5)" |
| 6 | Contexto: semestre | ✅ | Prácticas de semestres 7–10 solo para quien está en 7.º o superior; cursos filtrados por semestre |
| 7 | Contexto: cursos completados | ✅ | FIN-301 aparece como "Ya lo completaste"; la respuesta con LLM: "Como ya completaste MAT-101, te faltaría acreditar CON-101" |
| 8 | Explica prerrequisitos | ✅ | Con LLM: "FIN-301 requiere MAT-101 y CON-101" (del corpus). En modo reglas el catálogo no trae prerrequisitos: lo dice y remite a Servicios Escolares |
| 9 | Explica requisitos de becas | ✅ | Con LLM: "Beca Fundación EBC: promedio mínimo 8.5, 3.º a 8.º semestre, sin adeudos, 30% de colegiatura…" |
| 10 | Explica pasos de trámites | ✅ | Con LLM: pasos de la solicitud de beca y de la reinscripción, y corrección de datos académicos (5 días hábiles) |
| 11 | Solo lógica basada en reglas, sin ML | ⚠️ Decisión V1 | **Híbrido:** las reglas deciden idioma, intent, entidades y datos; el LLM solo **redacta** a partir de la hoja de hechos y pasajes del corpus, con guardrail (rechaza datos no respaldados) y respaldo por plantillas. `ASSISTANT_MODE=rules` es 100 % reglas |
| 12 | Responde en menos de 2 s | ⚠️ Solo en modo reglas | Modo reglas: **máx. 171 ms** (`verify:flow`, incluye DynamoDB). Modo LLM con razonamiento `high`: **2,6 a 7,4 s** (se muestra "Escribiendo…"; `OPENAI_REASONING_EFFORT=medium` o `low` lo acorta) |
| 13 | Sin comprender → sugiere preguntas alternativas | ✅ | "qwerty asdf zxcv" → 3 preguntas alternativas (en plantilla y también en la respuesta del LLM) |
| 14 | Sin información → remite a recursos EBC | ✅ | "No tengo los requisitos detallados… acude a Servicios Escolares de tu campus" |

## Resumen

- **12 de 14 cumplidos sin matices**; los 2 restantes (11 y 12) son la consecuencia explícita de usar un LLM real en la demo, aprobada como V1, y se cumplen íntegramente en modo `rules`.
- **Plan B para la demo:** `npm run dev:rules` (sin OpenAI), con respuestas en menos de 200 ms.

## Otras verificaciones del flujo

| Qué | Resultado |
|---|---|
| `npm run verify:flow` con LLM | 12/12: catálogo (15 oportunidades de 6 tipos para Finanzas), recomendaciones, alertas, español, seguimiento, inglés, historial de 4 mensajes y borrado |
| `npm run verify:flow` en modo reglas | 12/12, respuestas en 37 a 171 ms |
| `npm run verify:checkpointer` | 12/12: conversaciones persistentes en DynamoDB que sobreviven al reinicio del backend |
| `npm run kb:verify` | 10/10 preguntas con el documento esperado en el top 3 |
| Navegador (Chrome headless) | Chat completo, enlaces "Preguntar al asistente" desde Inicio, Oportunidades y Perfil, error con reintento, borrado, móvil 375 px sin scroll horizontal y sin que la navegación inferior tape el campo; 0 errores de consola |
| Pruebas de los compañeros (backend y frontend), `tsc`, `eslint` y `vite build` | Pasan tras integrar `main` |
