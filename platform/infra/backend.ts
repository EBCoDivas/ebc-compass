// El backend Express (backend/src/lambda.ts) como una sola Lambda detrás de `ANY /api/{proxy+}`:
// catálogo, recomendaciones, alertas y asistente, con las mismas rutas que en local (el frontend no cambia).

export function createBackend(input: {
  stage: string;
  table: { name: any };
  knowledgeBaseId: any;
  knowledgeBaseArn: any;
}) {
  // El identificador del modelo de Bedrock lo detecta `npm run lab:deploy` (o se fija con LAB_BEDROCK_MODEL_ID).
  const modelId = process.env.BEDROCK_MODEL_ID;
  if (!modelId) {
    throw new Error(
      "Falta BEDROCK_MODEL_ID. Despliega con `npm run lab:deploy -- --confirm`: detecta solo un modelo disponible en la cuenta.",
    );
  }

  return new sst.aws.Function("BackendFunction", {
    handler: "../backend/src/lambda.handler",
    runtime: "nodejs22.x",
    memory: "1024 MB",
    // API Gateway HTTP API corta a los 30 s: la Lambda y el modelo deben terminar antes (ver ASSISTANT_LLM_TIMEOUT_MS).
    timeout: "29 seconds",
    link: [input.table], // permisos de lectura/escritura sobre la tabla de conversaciones
    environment: {
      APP_STAGE: input.stage,
      ASSISTANT_MODE: "llm",
      ASSISTANT_LLM_TIMEOUT_MS: "22000",
      BEDROCK_MODEL_ID: modelId,
      KNOWLEDGE_BASE_ID: input.knowledgeBaseId,
      CONVERSATIONS_TABLE: input.table.name,
      // Respaldo por palabras clave si la Knowledge Base no responde: los documentos viajan dentro del paquete.
      KNOWLEDGE_DIR: "/var/task/knowledge",
    },
    permissions: [
      // Converse usa la acción bedrock:InvokeModel. Con perfiles de inferencia entre regiones el recurso cambia por modelo.
      { actions: ["bedrock:InvokeModel"], resources: ["*"] },
      { actions: ["bedrock:Retrieve"], resources: [input.knowledgeBaseArn] },
    ],
    copyFiles: [{ from: "../knowledge", to: "knowledge" }],
    nodejs: {
      // Express y LangChain usan require() dinámico: se habilita dentro del paquete ESM.
      banner:
        "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
    },
    logging: { format: "json", retention: "1 week" },
  });
}
