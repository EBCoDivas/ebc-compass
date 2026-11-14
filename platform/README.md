# EBC Compass Platform

This directory contains the AWS infrastructure definition for EBC Compass, built with SST v3 and TypeScript. The initial stage is `dev` in `us-east-1`.

## Included infrastructure

- Amazon Cognito User Pool with email as the sign-in username and a public web client.
- API Gateway HTTP API with `GET /health` and CORS for the local Vite origin (`http://localhost:5173`).
- Node.js 22 health Lambda and API/Lambda CloudWatch logs retained for one week.
- Private, HTTPS-only S3 document bucket. New objects use Amazon S3 managed-key encryption (SSE-S3) by default.
- S3 Vectors bucket and a 1,024-dimensional `float32` cosine index.
- Amazon Bedrock Knowledge Base using Titan Text Embeddings V2 and an S3 data source. The source bucket starts empty; no ingestion is run here.

Business API routes, JWT authorization for those routes, the frontend site, and assistant inference will be added when the backend and frontend branches are integrated.

## Local development

Requirements: Node.js 22, npm, and the SST v3 CLI installed through this package.

```sh
npm install
npm run install:providers
npm run typecheck
npm test
```

`install:providers` downloads the SST provider packages and generates local type definitions under the ignored `.sst/` directory. It does not deploy infrastructure.

## Future AWS deployment prerequisites

Before deploying, configure AWS credentials for the target account, confirm `us-east-1` is the intended region, and enable access to the Amazon Titan Text Embeddings V2 model in Amazon Bedrock. No AWS credentials are needed for the health unit test.

When deployment is authorized, use the `dev` stage:

```sh
npm run dev
npm run deploy
npm run remove
```

These commands are documented for a later step and are not part of the local setup or verification workflow.
