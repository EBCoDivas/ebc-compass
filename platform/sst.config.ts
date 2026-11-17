/// <reference path="./.sst/platform/config.d.ts" />

const region = "us-east-1";

export default $config({
  app() {
    return {
      name: "ebc-compass",
      removal: "remove",
      home: "aws",
      providers: {
        aws: { version: "7.55.0", region },
        "aws-native": {
          package: "@pulumi/aws-native",
          version: "1.82.0",
          region,
        },
      },
    };
  },

  async run() {
    const [
      { createApi },
      { createAuth },
      { createKnowledgeBase },
      { createConversationsTable, createProfilesTable, createHistoryTable },
      { createBackend },
      { createSite },
      { createInputGuardrail },
    ] = await Promise.all([
      import("./infra/api"),
      import("./infra/auth"),
      import("./infra/knowledge-base"),
      import("./infra/data"),
      import("./infra/backend"),
      import("./infra/site"),
      import("./infra/input-guardrail"),
    ]);

    const { userPool, webClient } = createAuth();
    const knowledge = createKnowledgeBase();
    const table = createConversationsTable();
    const profilesTable = createProfilesTable();
    const historyTable = createHistoryTable();
    const inputGuardrail = createInputGuardrail();
    const backend = createBackend({
      stage: $app.stage,
      inputGuardrail,
      table,
      profilesTable,
      historyTable,
      knowledgeBaseId: knowledge.knowledgeBase.knowledgeBaseId,
      knowledgeBaseArn: knowledge.knowledgeBase.knowledgeBaseArn,
    });
    const streaming = createBackend({
      streaming: true,
      stage: $app.stage,
      inputGuardrail,
      table,
      profilesTable,
      historyTable,
      knowledgeBaseId: knowledge.knowledgeBase.knowledgeBaseId,
      knowledgeBaseArn: knowledge.knowledgeBase.knowledgeBaseArn,
    });
    const { api } = createApi($app.stage, { userPool, webClient }, backend, streaming);
    const site = createSite({
      apiUrl: api.url,
      userPoolId: userPool.id,
      webClientId: webClient.id,
    });

    return {
      inputGuardrailId: inputGuardrail.id,
      inputGuardrailVersion: inputGuardrail.version,
      region,
      stage: $app.stage,
      siteUrl: site.url,
      conversationsTable: table.name,
      conversationHistoryTable: historyTable.name,
      backendFunction: backend.name,
      apiUrl: api.url,
      cognitoUserPoolId: userPool.id,
      cognitoWebClientId: webClient.id,
      documentsBucketName: knowledge.documentsBucket.name,
      knowledgeBaseId: knowledge.knowledgeBase.knowledgeBaseId,
      vectorBucketName: knowledge.vectorBucket.vectorBucketName,
      vectorBucketArn: knowledge.vectorBucket.vectorBucketArn,
      vectorIndexName: knowledge.vectorIndex.indexName,
      vectorIndexArn: knowledge.vectorIndex.indexArn,
      knowledgeBaseDataSourceId: knowledge.dataSource.dataSourceId,
    };
  },
});
