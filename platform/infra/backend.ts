// El backend Express (backend/src/lambda.ts) como una sola Lambda detrás de `ANY /api/{proxy+}`:
// catálogo, recomendaciones, alertas y asistente, con las mismas rutas que en local (el frontend no cambia).

export function createBackend(input: {
  stage: string;
  streaming?: boolean;
  mcp: { banner: { name: any; arn: any }; gateway: { gatewayUrl: any; gatewayArn: any } };
  inputGuardrail: { id: any; arn: any; version: any };
  table: { name: any };
  profilesTable: { name: any; arn: any };
  historyTable: { name: any; arn: any };
  knowledgeBaseId: any;
  knowledgeBaseArn: any;
}) {
  // El identificador del modelo de Bedrock lo detecta `npm run lab:deploy` (o se fija con LAB_BEDROCK_MODEL_ID).
  const modelId = process.env.BEDROCK_MODEL_ID;
  const promptCacheMode = process.env.ASSISTANT_PROMPT_CACHE ?? "system";
  if (!["off", "system", "system-history"].includes(promptCacheMode)) {
    throw new Error("ASSISTANT_PROMPT_CACHE debe ser off, system o system-history.");
  }
  if (!modelId) {
    throw new Error(
      "Falta BEDROCK_MODEL_ID. Despliega con `npm run lab:deploy -- --confirm`: detecta solo un modelo disponible en la cuenta.",
    );
  }

  return new sst.aws.Function(input.streaming ? "StreamingBackendFunction" : "BackendFunction", {
    handler: input.streaming ? "../backend/src/lambda-stream.handler" : "../backend/src/lambda.handler",
    streaming: input.streaming ?? false,
    runtime: "nodejs22.x",
    memory: "1024 MB",
    // El endpoint buffered conserva su presupuesto de 29 s; streaming usa un presupuesto independiente.
    timeout: input.streaming ? "90 seconds" : "29 seconds",
    link: [input.table], // permisos de lectura/escritura sobre la tabla de conversaciones
    environment: {
      APP_STAGE: input.stage,
      ASSISTANT_MODE: "llm",
      // Reserva cinco segundos para la evaluación de entrada dentro del presupuesto buffered.
      ASSISTANT_LLM_TIMEOUT_MS: input.streaming ? "60000" : "17000",
      ASSISTANT_PROMPT_CACHE: promptCacheMode,
      ASSISTANT_PROMPTS_DIR: "/var/task/prompts",
      BEDROCK_MODEL_ID: modelId,
      BEDROCK_LUNNA_MODEL_ID: process.env.BEDROCK_LUNNA_MODEL_ID ?? modelId,
      BEDROCK_TERRA_MODEL_ID: process.env.BEDROCK_TERRA_MODEL_ID ?? "",
      ASSISTANT_LUNNA_PROMPT_CACHE: process.env.ASSISTANT_LUNNA_PROMPT_CACHE ?? promptCacheMode,
      ASSISTANT_TERRA_PROMPT_CACHE: process.env.ASSISTANT_TERRA_PROMPT_CACHE ?? promptCacheMode,
      BEDROCK_INPUT_GUARDRAIL_ID: input.inputGuardrail.id,
      BEDROCK_INPUT_GUARDRAIL_VERSION: input.inputGuardrail.version,
      KNOWLEDGE_BASE_ID: input.knowledgeBaseId,
      CONVERSATIONS_TABLE: input.table.name,
      CONVERSATION_HISTORY_TABLE: input.historyTable.name,
      PROFILES_TABLE: input.profilesTable.name,
      BANNER_FUNCTION_NAME: input.mcp.banner.name,
      MCP_TRANSPORT: "gateway",
      MCP_GATEWAY_URL: input.mcp.gateway.gatewayUrl,
      // Respaldo por palabras clave si la Knowledge Base no responde: los documentos viajan dentro del paquete.
      KNOWLEDGE_DIR: "/var/task/knowledge",
    },
    permissions: [
      { actions: ["lambda:InvokeFunction"], resources: [input.mcp.banner.arn] },
      { actions: ["bedrock-agentcore:InvokeGateway"], resources: [input.mcp.gateway.gatewayArn] },
      { actions: ["bedrock:ApplyGuardrail"], resources: [input.inputGuardrail.arn] },
      { actions: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query", "dynamodb:BatchWriteItem"], resources: [input.historyTable.arn] },
      { actions: ["dynamodb:GetItem", "dynamodb:PutItem"], resources: [input.profilesTable.arn] },
      // Converse usa la acción bedrock:InvokeModel. Con perfiles de inferencia entre regiones el recurso cambia por modelo.
      { actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"], resources: ["*"] },
      { actions: ["bedrock:Retrieve"], resources: [input.knowledgeBaseArn] },
    ],
    copyFiles: [
      { from: "../knowledge", to: "knowledge" },
      { from: "../backend/prompts", to: "prompts" },
    ],
    nodejs: {
      // Express y LangChain usan require() dinámico: se habilita dentro del paquete ESM.
      banner:
        "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
    },
    logging: { format: "json", retention: "1 week" },
  });
}
