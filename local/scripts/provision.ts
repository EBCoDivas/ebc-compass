// Crea (o verifica) los recursos de AWS que necesita la demo dentro del emulador.
// Idempotente. Se ejecuta con `npm run provision` (la raíz inyecta las variables del emulador).
// El emulador guarda todo en memoria: hay que volver a ejecutarlo cada vez que se reinicia.
//   --check   solo verifica que existan, sin crear nada (lo usa `npm run doctor`)

import {
  CreateTableCommand,
  DescribeTableCommand,
  DescribeTimeToLiveCommand,
  DynamoDBClient,
  UpdateTimeToLiveCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb'
import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3'

const check = process.argv.includes('--check')
const tableName = process.env.CONVERSATIONS_TABLE ?? 'ConversationCheckpoints'
const bucketName = process.env.KNOWLEDGE_BUCKET ?? 'ebc-compass-knowledge-local'

const dynamo = new DynamoDBClient({})
const s3 = new S3Client({ forcePathStyle: true })

function isMissing(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } }
  return e.name === 'ResourceNotFoundException' || e.name === 'NotFound' || e.name === 'NoSuchBucket' || e.$metadata?.httpStatusCode === 404
}

async function tableExists(): Promise<boolean> {
  try {
    await dynamo.send(new DescribeTableCommand({ TableName: tableName }))
    return true
  } catch (error) {
    if (isMissing(error)) return false
    throw error
  }
}

async function bucketExists(): Promise<boolean> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }))
    return true
  } catch (error) {
    if (isMissing(error)) return false
    throw error
  }
}

async function ensureTable(): Promise<void> {
  if (await tableExists()) {
    console.log(`• Tabla ${tableName}: ya existe`)
  } else if (check) {
    throw new Error(`Falta la tabla ${tableName}`)
  } else {
    await dynamo.send(
      new CreateTableCommand({
        TableName: tableName,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
      }),
    )
    await waitUntilTableExists({ client: dynamo, maxWaitTime: 60 }, { TableName: tableName })
    console.log(`✔ Tabla ${tableName}: creada`)
  }

  const ttl = await dynamo.send(new DescribeTimeToLiveCommand({ TableName: tableName }))
  if (ttl.TimeToLiveDescription?.TimeToLiveStatus === 'ENABLED' || ttl.TimeToLiveDescription?.TimeToLiveStatus === 'ENABLING') {
    console.log(`• TTL (atributo "ttl"): ya habilitado`)
  } else if (check) {
    throw new Error(`Falta el TTL en ${tableName}`)
  } else {
    await dynamo.send(
      new UpdateTimeToLiveCommand({
        TableName: tableName,
        TimeToLiveSpecification: { Enabled: true, AttributeName: 'ttl' },
      }),
    )
    console.log(`✔ TTL (atributo "ttl"): habilitado`)
  }
}

async function ensureBucket(): Promise<void> {
  if (await bucketExists()) {
    console.log(`• Bucket ${bucketName}: ya existe`)
  } else if (check) {
    throw new Error(`Falta el bucket ${bucketName}`)
  } else {
    await s3.send(new CreateBucketCommand({ Bucket: bucketName }))
    console.log(`✔ Bucket ${bucketName}: creado`)
  }
}

try {
  await ensureTable()
  await ensureBucket()
  console.log(check ? '✔ Recursos verificados' : '✔ Aprovisionamiento completo')
} catch (error) {
  console.error(`✖ ${(error as Error).message}`)
  process.exit(1)
}
