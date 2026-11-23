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
import { loadEnvFile, root } from '../../scripts/lib/emulator-env.mjs'
import { join } from 'node:path'
import { provisionAuth } from './provision-auth.js'
import { provisionStudentMcp } from '../../backend/src/mcp/provisionLocal.js'
import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3'
import { S3VectorsClient } from '@aws-sdk/client-s3vectors'
import { ensureVectorIndex, VECTOR_BUCKET, VECTOR_INDEX } from '../kb/vectors.js'

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

async function ensureProfilesTable(): Promise<void> {
  const name = process.env.PROFILES_TABLE ?? loadEnvFile(join(root, 'backend', '.env')).PROFILES_TABLE ?? 'StudentProfiles'
  try {
    await dynamo.send(new DescribeTableCommand({ TableName: name }))
    console.log('• Tabla de perfiles: ya existe')
  } catch (error) {
    if (!isMissing(error)) throw error
    if (check) throw new Error('Falta la tabla ' + name)
    await dynamo.send(new CreateTableCommand({ TableName: name, BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [{ AttributeName: 'studentId', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'studentId', KeyType: 'HASH' }],
    }))
    await waitUntilTableExists({ client: dynamo, maxWaitTime: 60 }, { TableName: name })
    console.log('✔ Tabla de perfiles: creada (sin TTL)')
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

async function ensureVectors(): Promise<void> {
  const existed = await ensureVectorIndex(new S3VectorsClient({}), check)
  console.log(existed ? `• Índice de vectores ${VECTOR_BUCKET}/${VECTOR_INDEX}: ya existe` : `✔ Índice de vectores ${VECTOR_BUCKET}/${VECTOR_INDEX}: creado`)
}

async function ensureHistoryTable(): Promise<void> {
  const name = process.env.CONVERSATION_HISTORY_TABLE ?? loadEnvFile(join(root, 'backend', '.env')).CONVERSATION_HISTORY_TABLE ?? 'Conversations'
  try {
    await dynamo.send(new DescribeTableCommand({ TableName: name }))
    console.log('• Tabla de historial y memoria: ya existe')
  } catch (error) {
    if (!isMissing(error)) throw error
    if (check) throw new Error('Falta la tabla ' + name)
    await dynamo.send(new CreateTableCommand({ TableName: name, BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [{ AttributeName: 'PK', AttributeType: 'S' }, { AttributeName: 'SK', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'PK', KeyType: 'HASH' }, { AttributeName: 'SK', KeyType: 'RANGE' }],
    }))
    await waitUntilTableExists({ client: dynamo, maxWaitTime: 60 }, { TableName: name })
    console.log('✔ Tabla de historial y memoria: creada (sin TTL)')
  }
  const ttl = await dynamo.send(new DescribeTimeToLiveCommand({ TableName: name }))
  if (['ENABLED', 'ENABLING'].includes(ttl.TimeToLiveDescription?.TimeToLiveStatus ?? '')) throw new Error('La tabla de historial no debe tener TTL.')
}

try {
  await ensureTable()
  await ensureProfilesTable()
  await ensureHistoryTable()
  await ensureBucket()
  await ensureVectors()
  await provisionAuth(check)
  await provisionStudentMcp(check)
  console.log(check ? '✔ Recursos verificados' : '✔ Aprovisionamiento completo')
} catch (error) {
  console.error(`✖ ${(error as Error).message}`)
  process.exit(1)
}
