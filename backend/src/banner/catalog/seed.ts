import type { Opportunity } from '../../../../shared/contracts/studentPlanning.js'
import { legacyOpportunities } from './legacy.js'
import { careerCatalog, stageCatalog } from './planning.js'

/** Grupo al que pertenece cada oportunidad: Compass arma la ruta con las de etapa y de carrera. */
export type CatalogCollection = 'general' | 'stage' | 'career'
export type CatalogEntry = Opportunity & { collection: CatalogCollection }

const tag = (items: readonly Opportunity[], collection: CatalogCollection): CatalogEntry[] => items.map(item => ({ ...item, collection }))

/** Datos iniciales de la tabla BannerCatalog. Banner los carga solo si la tabla está vacía. */
export const catalogSeed: CatalogEntry[] = [
  ...tag(legacyOpportunities, 'general'), ...tag(stageCatalog, 'stage'), ...tag(careerCatalog, 'career'),
]
