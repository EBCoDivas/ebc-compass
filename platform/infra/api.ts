export function createApi(
  stage: string,
  auth: { userPool: { id: any; arn: any }, webClient: { id: any } },
  backend: { arn: any },
  streaming: { arn: any },
) {
  // SST genera los preflight al desplegar las rutas. Authorization debe ser explícito.
  $transform(aws.apigateway.IntegrationResponse, (args, _opts, name) => {
    if (!name.startsWith("CompassApiCorsIntegrationResponse")) return;
    args.responseParameters = $output(args.responseParameters).apply((parameters) => ({
      ...parameters,
      "method.response.header.Access-Control-Allow-Headers": "'authorization,content-type'",
    }));
  });

  const health = new sst.aws.Function("HealthFunction", {
    handler: "src/functions/health.handler",
    runtime: "nodejs22.x",
    memory: "128 MB",
    timeout: "5 seconds",
    environment: { APP_STAGE: stage },
    logging: {
      format: "json",
      retention: "1 week",
    },
  });

  const api = new sst.aws.ApiGatewayV1("CompassApi", {
    endpoint: { type: "regional" },
    cors: true,
    accessLog: { retention: "1 week" },
  });

  api.route("GET /health", health.arn);
  const opportunities = new sst.aws.Function("OpportunitiesFunction", {
    handler: "src/functions/opportunities.handler",
    runtime: "nodejs22.x",
    memory: "128 MB",
    timeout: "5 seconds",
    logging: { format: "json", retention: "1 week" },
  });
  const authorizer = api.addAuthorizer({
    name: "CognitoAuthorizer", userPools: [auth.userPool.arn],
    transform: { authorizer: args => { args.identityValidationExpression = $interpolate`^${auth.webClient.id}$`; } },
  });
  api.route("GET /opportunities", opportunities.arn, { auth: { cognito: { authorizer: authorizer.id } } });
  // Backend completo (catálogo, recomendaciones, alertas y asistente) con las mismas rutas /api/* que en local.
  // Rutas explícitas: REST no retrocede al proxy voraz si existe un recurso hijo sin ese método.
  for (const path of ["/api/profiles", "/api/opportunities", "/api/recommendations", "/api/alerts",
    "/api/assistant/messages", "/api/assistant/conversations", "/api/assistant/conversations/{id}",
    "/api/assistant/conversations/{id}/messages/{messageId}/feedback",
    "/api/assistant/memory", "/api/assistant/memory/{key}", "/api/assistant/suggestions", "/api/assistant/health", "/api/{proxy+}"]) {
    api.route("ANY " + path, backend.arn, { auth: { cognito: { authorizer: authorizer.id } } });
  }

  api.route("POST /api/assistant/messages/stream", streaming.arn, {
    auth: { cognito: { authorizer: authorizer.id } },
    // La función ya existe y se pasa por ARN: la ruta debe indicar su modo explícitamente.
    streaming: true,
  });
  api.deploy();
  return { api, health, opportunities };
}
