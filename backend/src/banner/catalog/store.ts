import { Conflict, type DocumentStore, type Value } from '../../assistant/conversations/store.js'
import { catalogSeed, type CatalogEntry } from './seed.js'

export const LOCAL_BANNER_CATALOG_TABLE = 'BannerCatalog'
const OWNER = 'CATALOG'
const PREFIX = 'OPP#'

/**
 * El catálogo de oportunidades vive en DynamoDB (tabla propia de Banner): un elemento por oportunidad.
 * Si la tabla está vacía, Banner la carga con los datos iniciales; así un ambiente nuevo funciona sin pasos manuales.
 */
export function createCatalogStore(store: DocumentStore, seed: readonly CatalogEntry[] = catalogSeed) {
  async function readAll(): Promise<(CatalogEntry & { order: number })[]> {
    const items: (CatalogEntry & { order: number })[] = []
    let cursor: string | undefined
    do {
      const page = await store.page(OWNER, PREFIX, 100, cursor)
      items.push(...page.items.map(({ value }) => value as unknown as CatalogEntry & { order: number }))
      cursor = page.cursor
    } while (cursor)
    return items
  }

  async function load() {
    await Promise.all(seed.map(async (entry, order) => {
      try { await store.write(OWNER, [{ key: PREFIX + entry.id, value: { ...entry, order, version: 0 } as unknown as Value }]) }
      catch (error) { if (!(error instanceof Conflict)) throw error }
    }))
  }

  return {
    async list(): Promise<CatalogEntry[]> {
      let items = await readAll()
      if (!items.length) { await load(); items = await readAll() }
      return items.sort((a, b) => a.order - b.order).map(({ order: _order, version: _version, ...entry }: CatalogEntry & { order: number; version?: number }) => entry as CatalogEntry)
    },
  }
}
export type CatalogStore = ReturnType<typeof createCatalogStore>
