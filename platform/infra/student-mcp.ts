import { STUDENT_CONTEXT_HEADER, TARGET_NAME, toolList } from "../../backend/src/mcp/contract.js";

export function createStudentMcp(input: {
  stage: string; historyTable: { name: any; arn: any }; knowledgeBaseId: any; knowledgeBaseArn: any;
}) {
  const bannerActions = new sst.aws.Dynamo("BannerActions", {
    fields: { PK: "string", SK: "string" },
    primaryIndex: { hashKey: "PK", rangeKey: "SK" },
  });
  // El catálogo de oportunidades (fechas, tarifas y requisitos) vive en la tabla propia de Banner.
  const bannerCatalog = new sst.aws.Dynamo("BannerCatalog", {
    fields: { PK: "string", SK: "string" },
    primaryIndex: { hashKey: "PK", rangeKey: "SK" },
  });
  const banner = new sst.aws.Function("BannerMock", {
    handler: "../backend/src/banner/lambda.handler",
    runtime: "nodejs22.x",
    timeout: "5 seconds",
    environment: { APP_STAGE: input.stage, BANNER_ACTIONS_TABLE: bannerActions.name, BANNER_CATALOG_TABLE: bannerCatalog.name },
    permissions: [
      { actions: ["dynamodb:GetItem", "dynamodb:PutItem"], resources: [bannerActions.arn] },
      { actions: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query"], resources: [bannerCatalog.arn] },
    ],
    logging: { format: "json", retention: "1 week" },
  });
  const tools = new sst.aws.Function("CompassMcpTools", {
    handler: "../backend/src/mcp/lambda.handler",
    runtime: "nodejs22.x",
    timeout: "8 seconds",
    environment: {
      APP_STAGE: input.stage,
      BANNER_FUNCTION_NAME: banner.name,
      CONVERSATION_HISTORY_TABLE: input.historyTable.name,
      KNOWLEDGE_BASE_ID: input.knowledgeBaseId,
      KNOWLEDGE_DIR: "/var/task/knowledge",
    },
    permissions: [
      { actions: ["lambda:InvokeFunction"], resources: [banner.arn] },
      { actions: ["dynamodb:GetItem", "dynamodb:Query"], resources: [input.historyTable.arn] },
      { actions: ["bedrock:Retrieve"], resources: [input.knowledgeBaseArn] },
    ],
    copyFiles: [{ from: "../knowledge", to: "knowledge" }],
    logging: { format: "json", retention: "1 week" },
  });
  const account = aws.getCallerIdentityOutput().accountId;
  const region = aws.getRegionOutput().region;
  const role = new aws.iam.Role("CompassMcpGatewayRole", {
    assumeRolePolicy: $interpolate`{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"bedrock-agentcore.amazonaws.com"},"Action":"sts:AssumeRole","Condition":{"StringEquals":{"aws:SourceAccount":"${account}"},"ArnLike":{"aws:SourceArn":"arn:aws:bedrock-agentcore:${region}:${account}:gateway/*"}}}]}`,
  });
  const invoke = new aws.iam.RolePolicy("CompassMcpInvokeTools", {
    role: role.name,
    policy: $interpolate`{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"lambda:InvokeFunction","Resource":"${tools.arn}"}]}`,
  });
  const gateway = new aws.bedrock.AgentcoreGateway("CompassMcpGateway", {
    name: "ebc-compass-" + input.stage,
    authorizerType: "AWS_IAM",
    protocolType: "MCP",
    roleArn: role.arn,
  });
  new aws.bedrock.AgentcoreGatewayTarget("CompassMcpTarget", {
    gatewayIdentifier: gateway.gatewayId,
    name: TARGET_NAME,
    credentialProviderConfiguration: { gatewayIamRole: {} },
    metadataConfiguration: { allowedRequestHeaders: [STUDENT_CONTEXT_HEADER] },
    targetConfiguration: { mcp: { lambda: {
      lambdaArn: tools.arn,
      toolSchema: { inlinePayloads: toolList.map(({ name, description, inputSchema }) => ({
        name, description, inputSchema: { type: inputSchema.type, properties: Object.entries(inputSchema.properties).map(([name, property]) => ({
          name, ...property, required: inputSchema.required?.includes(name) ?? false,
        })) },
      })) },
    } } },
  }, { dependsOn: [invoke] });
  return { banner, gateway };
}
