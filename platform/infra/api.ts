export function createApi(
  stage: string,
  auth: { userPool: { id: any }, webClient: { id: any } },
  backend: { arn: any },
) {
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

  const api = new sst.aws.ApiGatewayV2("CompassApi", {
    cors: {
      // "*": el origen del sitio (CloudFront) se conoce después del API. No hay cookies (allowCredentials: false) y las
      // rutas exigen un JWT de Cognito en el encabezado Authorization.
      allowOrigins: ["*"],
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: ["authorization", "content-type"],
      allowCredentials: false,
    },
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
    name: "CognitoAuthorizer",
    jwt: {
      issuer: $interpolate`https://cognito-idp.us-east-1.amazonaws.com/${auth.userPool.id}`,
      audiences: [auth.webClient.id],
    },
  });
  api.route("GET /opportunities", opportunities.arn, { auth: { jwt: { authorizer: authorizer.id } } });
  // Backend completo (catálogo, recomendaciones, alertas y asistente) con las mismas rutas /api/* que en local.
  api.route("ANY /api/{proxy+}", backend.arn, { auth: { jwt: { authorizer: authorizer.id } } });

  return { api, health, opportunities };
}
