const region = "us-east-1";
const embeddingModelArn = `arn:aws:bedrock:${region}::foundation-model/amazon.titan-embed-text-v2:0`;

export function createKnowledgeBase() {
  const documentsBucket = new sst.aws.Bucket("KnowledgeDocuments", {
    enforceHttps: true,
    cors: false,
  });

  const vectorBucket = new awsnative.s3vectors.VectorBucket("KnowledgeVectors");

  const vectorIndex = new awsnative.s3vectors.Index("KnowledgeVectorIndex", {
    vectorBucketArn: vectorBucket.vectorBucketArn,
    indexName: "ebc-compass-knowledge",
    dataType: "float32",
    dimension: 1024,
    distanceMetric: "cosine",
    metadataConfiguration: {
      nonFilterableMetadataKeys: [
        "AMAZON_BEDROCK_TEXT_CHUNK",
        "AMAZON_BEDROCK_METADATA",
      ],
    },
  });

  const accountId = aws.getCallerIdentityOutput({}).accountId;
  const knowledgeBaseRole = new aws.iam.Role("KnowledgeBaseServiceRole", {
    assumeRolePolicy: $jsonStringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "bedrock.amazonaws.com" },
          Action: "sts:AssumeRole",
          Condition: {
            StringEquals: { "aws:SourceAccount": accountId },
            ArnLike: {
              "aws:SourceArn": $interpolate`arn:aws:bedrock:${region}:${accountId}:knowledge-base/*`,
            },
          },
        },
      ],
    }),
  });

  new aws.iam.RolePolicy("KnowledgeBaseAccessPolicy", {
    role: knowledgeBaseRole.id,
    policy: $jsonStringify({
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "ReadKnowledgeDocuments",
          Effect: "Allow",
          Action: ["s3:ListBucket"],
          Resource: [documentsBucket.arn],
        },
        {
          Sid: "ReadKnowledgeDocumentObjects",
          Effect: "Allow",
          Action: ["s3:GetObject"],
          Resource: [$interpolate`${documentsBucket.arn}/*`],
        },
        {
          Sid: "GenerateKnowledgeEmbeddings",
          Effect: "Allow",
          Action: ["bedrock:InvokeModel"],
          Resource: [embeddingModelArn],
        },
        {
          Sid: "UseKnowledgeVectorIndex",
          Effect: "Allow",
          Action: [
            "s3vectors:GetIndex",
            "s3vectors:GetVectors",
            "s3vectors:PutVectors",
            "s3vectors:QueryVectors",
            "s3vectors:DeleteVectors",
          ],
          Resource: [vectorIndex.indexArn],
        },
      ],
    }),
  });

  const knowledgeBase = new awsnative.bedrock.KnowledgeBase(
    "CompassKnowledgeBase",
    {
      name: "ebc-compass-knowledge",
      roleArn: knowledgeBaseRole.arn,
      knowledgeBaseConfiguration: {
        type: "VECTOR",
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn,
          embeddingModelConfiguration: {
            bedrockEmbeddingModelConfiguration: {
              dimensions: 1024,
              embeddingDataType: "FLOAT32",
            },
          },
        },
      },
      storageConfiguration: {
        type: "S3_VECTORS",
        s3VectorsConfiguration: {
          vectorBucketArn: vectorBucket.vectorBucketArn,
          indexArn: vectorIndex.indexArn,
          indexName: vectorIndex.indexName,
        },
      },
    },
  );

  const dataSource = new awsnative.bedrock.DataSource(
    "KnowledgeDocumentsSource",
    {
      knowledgeBaseId: knowledgeBase.knowledgeBaseId,
      name: "ebc-compass-documents",
      dataSourceConfiguration: {
        type: "S3",
        s3Configuration: { bucketArn: documentsBucket.arn },
      },
      dataDeletionPolicy: "DELETE",
    },
  );

  return {
    documentsBucket,
    vectorBucket,
    vectorIndex,
    knowledgeBase,
    dataSource,
  };
}
