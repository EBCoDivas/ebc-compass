/// <reference path="./.sst/platform/config.d.ts" />

const region = "us-east-1";

export default $config({
  app() {
    return {
      name: "ebc-compass",
      removal: "remove",
      home: "aws",
      providers: {
        aws: { region },
        "aws-native": {
          package: "@pulumi/aws-native",
          version: "1.82.0",
          region,
        },
      },
    };
  },

  async run() {
    const [{ createApi }, { createAuth }, { createKnowledgeBase }] =
      await Promise.all([
        import("./infra/api"),
        import("./infra/auth"),
        import("./infra/knowledge-base"),
      ]);

    const { userPool, webClient } = createAuth();
    const { api } = createApi($app.stage);
    const knowledge = createKnowledgeBase();

    return {
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
