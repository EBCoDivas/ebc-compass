import type { Opportunity } from '../../../shared/contracts/studentPlanning.js'
import type { CatalogEntry } from '../banner/catalog/seed.js'

/** Fuente del catálogo: Banner (su tabla BannerCatalog en DynamoDB). */
export interface CatalogSource { readCatalog(): Promise<CatalogEntry[]> }

export interface CatalogSnapshot {
  /** Todo el catálogo, en el orden en que lo guarda Banner. */
  all: Opportunity[]
  /** Oportunidades generales (cursos, eventos, becas y trámites de siempre). */
  general: Opportunity[]
  /** Pendientes de nuevo ingreso, de mitad y de cierre de carrera. */
  stage: Opportunity[]
  /** Pendientes propios de cada carrera (servicio social, titulación, prácticas). */
  career: Opportunity[]
}

export class CatalogNotLoaded extends Error { constructor() { super('El catálogo todavía no se cargó desde Banner.') } }

const MAX_AGE_MS = 60_000
let snapshot: CatalogSnapshot | undefined
let loadedAt = 0
let inFlight: Promise<void> | undefined

function split(entries: readonly CatalogEntry[]): CatalogSnapshot {
  const strip = ({ collection: _collection, ...item }: CatalogEntry): Opportunity => item
  const of = (collection: CatalogEntry['collection']) => entries.filter(entry => entry.collection === collection).map(strip)
  return { all: entries.map(strip), general: of('general'), stage: of('stage'), career: of('career') }
}

export function setCatalog(entries: readonly CatalogEntry[]) {
  snapshot = split(entries)
  loadedAt = Date.now()
}

/**
 * Carga el catálogo desde Banner y lo conserva un minuto en memoria. Si Banner falla y ya hay una copia, se sigue con ella;
 * si no hay ninguna, el error sube y la petición responde que no está disponible.
 */
export async function ensureCatalog(source: CatalogSource, maxAgeMs = MAX_AGE_MS): Promise<void> {
  if (snapshot && Date.now() - loadedAt < maxAgeMs) return
  inFlight ??= source.readCatalog().then(entries => {
    if (!entries.length) throw new Error('BANNER_CATALOG_EMPTY')
    setCatalog(entries)
  }).catch(error => { if (!snapshot) throw error }).finally(() => { inFlight = undefined })
  await inFlight
}

/** El catálogo ya cargado. Las rutas, el chat y el MCP llaman antes a `ensureCatalog`. */
export function currentCatalog(): CatalogSnapshot {
  if (!snapshot) throw new CatalogNotLoaded()
  return snapshot
}

export function resetCatalog() { snapshot = undefined; loadedAt = 0; inFlight = undefined }
