import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { DynamoDocumentStore } from '../assistant/conversations/store.js'
import { createBannerActionHandler, LOCAL_BANNER_ACTIONS_TABLE } from './actions.js'
import { createCatalogStore, LOCAL_BANNER_CATALOG_TABLE } from './catalog/store.js'

const isLocalEmulator = () => !process.env.APP_STAGE && process.env.AWS_ENDPOINT_URL === 'https://127.0.0.1:9297'

/** Banner usa dos tablas propias de DynamoDB: las acciones del alumno (BannerActions) y el catálogo (BannerCatalog). */
export function createBannerRuntime() {
  const actionsTable = process.env.BANNER_ACTIONS_TABLE?.trim() || (isLocalEmulator() ? LOCAL_BANNER_ACTIONS_TABLE : undefined)
  const catalogTable = process.env.BANNER_CATALOG_TABLE?.trim() || (isLocalEmulator() ? LOCAL_BANNER_CATALOG_TABLE : undefined)
  if (!actionsTable) throw new Error('Falta BANNER_ACTIONS_TABLE.')
  if (!catalogTable) throw new Error('Falta BANNER_CATALOG_TABLE.')
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ maxAttempts: 1, requestHandler: { requestTimeout: 3500, throwOnRequestTimeout: true } }),
    { marshallOptions: { removeUndefinedValues: true } })
  const catalog = createCatalogStore(new DynamoDocumentStore(client, catalogTable))
  return { actions: createBannerActionHandler(new DynamoDocumentStore(client, actionsTable), undefined, catalog), catalog }
}
