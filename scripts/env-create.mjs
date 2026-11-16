#!/usr/bin/env node
// Crea los archivos .env reales a partir de cada .env.example.
// - Nunca sobrescribe un .env existente.
// - No imprime valores; solo nombres de variables que debes completar.

import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packages = ['backend', 'frontend', 'local', 'lab']

// Variables que el usuario debe llenar a mano (secretos). Se avisa si están vacías.
const requiredSecrets = { local: ['OPENAI_API_KEY'] }

function emptyVariables(file, names) {
  const values = new Map()
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/)
    if (match) values.set(match[1], match[2].trim())
  }
  return names.filter((name) => !values.get(name))
}

const created = []
const skipped = []
const missing = []

for (const pkg of packages) {
  const example = join(root, pkg, '.env.example')
  const target = join(root, pkg, '.env')

  if (!existsSync(example)) {
    console.warn(`⚠ No existe ${relative(root, example)}; se omite ${pkg}.`)
    continue
  }

  if (existsSync(target)) {
    skipped.push(relative(root, target))
  } else {
    copyFileSync(example, target)
    created.push(relative(root, target))
  }

  const empty = emptyVariables(target, requiredSecrets[pkg] ?? [])
  if (empty.length > 0) missing.push({ file: relative(root, target), variables: empty })
}

for (const file of created) console.log(`✔ Creado ${file}`)
for (const file of skipped) console.log(`• Ya existe ${file} (no se modifica)`)

if (missing.length > 0) {
  console.log('\nCompleta estos valores (tú los colocas; no se versionan):')
  for (const { file, variables } of missing) {
    for (const name of variables) console.log(`  - ${name} en ${file}`)
  }
} else {
  console.log('\nNo faltan valores por completar.')
}
