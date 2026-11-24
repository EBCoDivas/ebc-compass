// Las pruebas no consultan Banner: cargan los datos iniciales del catálogo. Se importa por su efecto.
import { catalogSeed } from '../banner/catalog/seed.js'
import { setCatalog } from '../catalog/catalog.js'

setCatalog(catalogSeed)
