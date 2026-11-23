# EBC Compass: estado para la demo

## Qué podemos mostrar

- **Acceso y perfil:** diez cuentas ficticias; cada una tiene su sesión, perfil y conversaciones. Intereses, metas y disponibilidad personalizan la orientación.
- **Inicio:** próximas fechas, siguiente paso sugerido, avance académico simulado y recomendaciones agrupadas con su razón. Cada categoría abre su lista completa en Oportunidades.
- **Avance académico:** materias, créditos, periodo y promedio cuando está disponible. Ocho cuentas tienen datos; `sin-perfil` muestra el estado vacío.
- **Oportunidades y calendario:** cursos, becas, eventos, trámites y desarrollo profesional; búsqueda, filtros, fechas y guardado para después en el navegador.
- **Compass:** chat en página o panel flotante, español/inglés, respuestas en streaming, fuentes y preguntas de seguimiento. Se puede detener la generación y retomar conversaciones.
- **Modelos:** selector Lunna/Terra, con Lunna predeterminado y modelos configurables. En local, el puente usa OpenAI; el esfuerzo de razonamiento es común para ambos (`high` por defecto).
- **Historial y memoria:** fuentes, sugerencias y tiempo de respuesta se conservan al recargar. Memoria visible, editable y borrable. Se puede pedir «recuerda que trabajo por las tardes»: el modelo extrae una categoría o guarda una nota breve para conversaciones nuevas. Confirma después de guardar; máximo 10 notas de 200 caracteres. Preguntas como «¿en qué quiero trabajar?» o «¿qué recuerdas de mí?» consultan los recuerdos de la cuenta.
- **Protección de entrada:** reglas locales para bloquear solicitudes fuera de alcance, inyecciones, contenido dañino y datos de otras personas antes del modelo.

## Qué tener presente

- Las recomendaciones se calculan con reglas; los datos académicos y las oportunidades son de demo. Todavía no hay integración con Banner ni Salesforce.
- En local usamos emulador AWS + puente a OpenAI, con la base de conocimiento en S3 Vectors del emulador (igual que la Knowledge Base del lab). Bedrock y sus guardrails nativos requieren configuración y validación en el lab; los últimos cambios no se han desplegado allí.
- El emulador guarda datos en memoria: detenerlo borra perfiles e historial. Las oportunidades guardadas viven en el navegador.

## Check-in rápido: correr en local

Requisitos: **Node 22, npm y Docker Desktop encendido**. Desde la raíz del repo:

```sh
git switch main
git pull --ff-only origin main
npm run env:create
```

En `local/.env`, completa `OPENAI_API_KEY`. `npm run dev` carga la base de conocimiento en S3 Vectors del emulador en cada arranque.

```sh
npm run setup
npm run doctor
npm run dev
```

- Si ya tienes el entorno preparado, basta con actualizar el repo y ejecutar `npm run dev`.
- Abre **http://localhost:5173**. Las cuentas demo están en `local/.state/cognito.json` (privado, no compartir en el repo).
- Check-in: entrar con Ana Lucía (1.er semestre) → revisar Inicio → abrir una categoría → preguntar «¿Qué oportunidades me recomiendas según mi perfil?» → pedir «recuerda que trabajo por las tardes» → revisar “Lo que Compass recuerda” → abrir otra conversación → recargar y comprobar el historial.
- Sin OpenAI: `npm run dev:rules` (plantillas; no permite comparar respuestas de modelos).
- `Ctrl+C` detiene la aplicación. `npm run stop` detiene el emulador y borra sus datos.

Más detalle: [guía local](../local/README.md).
