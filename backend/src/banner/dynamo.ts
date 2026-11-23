import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { DynamoDocumentStore } from '../assistant/conversations/store.js'
import { createBannerActionHandler, LOCAL_BANNER_ACTIONS_TABLE } from './actions.js'

export function createBannerRuntime() {
  const table = process.env.BANNER_ACTIONS_TABLE?.trim()
    || (!process.env.APP_STAGE && process.env.AWS_ENDPOINT_URL === 'https://127.0.0.1:9297' ? LOCAL_BANNER_ACTIONS_TABLE : undefined)
  if (!table) throw new Error('Falta BANNER_ACTIONS_TABLE.')
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ maxAttempts: 1, requestHandler: { requestTimeout: 3500, throwOnRequestTimeout: true } }),
    { marshallOptions: { removeUndefinedValues: true } })
  return createBannerActionHandler(new DynamoDocumentStore(client, table))
}
