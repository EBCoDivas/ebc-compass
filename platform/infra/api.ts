export function createApi(stage: string) {
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
      allowOrigins: ["http://localhost:5173", "http://localhost:5174"],
      allowMethods: ["GET"],
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
  api.route("GET /opportunities", opportunities.arn);

  return { api, health, opportunities };
}
