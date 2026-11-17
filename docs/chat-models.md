# Modelos del chat

El selector compartido por la página y el panel ofrece Lunna (predeterminado) y Terra. Cada petición puede incluir `model: "lunna" | "terra"`; cualquier otro valor devuelve 400. La selección se guarda en la respuesta y el historial. Un reintento con el mismo requestId debe conservar el modelo.

## Configuración

En Bedrock, configura `BEDROCK_LUNNA_MODEL_ID` y `BEDROCK_TERRA_MODEL_ID` con modelos disponibles para la cuenta. SST transmite ambas variables a las dos Lambdas. La configuración de caché independiente usa `ASSISTANT_LUNNA_PROMPT_CACHE` y `ASSISTANT_TERRA_PROMPT_CACHE` (off, system o system-history); si se omiten, heredan ASSISTANT_PROMPT_CACHE. La compatibilidad de caché se evalúa para cada identificador.

Local usa los identificadores lógicos local-lunna y local-terra. El puente traduce mediante `OPENAI_LUNNA_MODEL` (hereda OPENAI_MODEL, o gpt-6-luna) y `OPENAI_TERRA_MODEL` (gpt-6.1-terra). Las dos rutas Converse y ConverseStream respetan la selección.

Las diferencias de rapidez y profundidad dependen de los modelos configurados. Pendiente validar visualmente y con servicios reales; no se ha desplegado esta fase.
