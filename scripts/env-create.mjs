#!/usr/bin/env node
// Crea los archivos .env reales a partir de cada .env.example.
// - Conserva los valores existentes y completa solo la configuración local del jurado que falte.
// - No imprime valores; solo nombres de variables que debes completar.

import { randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packages = ['backend', 'frontend', 'local', 'scripts/lab']

// Variables que el usuario debe llenar a mano (secretos). Se avisa si están vacías.
const requiredSecrets = { local: ['OPENAI_API_KEY', 'OPENAI_VECTOR_STORE_ID'] }

function emptyVariables(file, names) {
  const values = new Map()
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/)
    if (match) values.set(match[1], match[2].trim())
  }
  return names.filter((name) => !values.get(name))
}

function withLocalJuryDefaults(source) {
  const env = parseEnv(source)
  const enabled = env.JURY_DEMO_ENABLED ?? 'true'
  const fields = []
  if (env.JURY_DEMO_ENABLED === undefined) fields.push('JURY_DEMO_ENABLED=true')
  if (enabled === 'true' && !env.JURY_DEMO_PASSWORD) {
    const password = 'JuryAa1!' + randomBytes(18).toString('hex')
    const assignment = /^[ \t]*(?:export[ \t]+)?JURY_DEMO_PASSWORD[ \t]*=.*$/gm
    const field = `JURY_DEMO_PASSWORD=${password}`
    if (env.JURY_DEMO_PASSWORD === undefined) fields.push(field)
    else source = source.replace(assignment, field)
  }
  return fields.length ? source + (source.endsWith('\n') || !source ? '' : '\n') + fields.join('\n') + '\n' : source
}

const created = []
const skipped = []
const updated = []
const missing = []

for (const pkg of packages) {
  const example = join(root, pkg, '.env.example')
  const target = join(root, pkg, '.env')

  if (!existsSync(example)) {
    console.warn(`⚠ No existe ${relative(root, example)}; se omite ${pkg}.`)
    continue
  }

  if (existsSync(target)) {
    const before = pkg === 'local' ? readFileSync(target, 'utf8') : undefined
    const after = before === undefined ? undefined : withLocalJuryDefaults(before)
    if (after !== undefined && after !== before) {
      writeFileSync(target, after)
      updated.push(relative(root, target))
    } else skipped.push(relative(root, target))
  } else {
    if (pkg === 'local') writeFileSync(target, withLocalJuryDefaults(readFileSync(example, 'utf8')), { flag: 'wx', mode: 0o600 })
    else copyFileSync(example, target)
    created.push(relative(root, target))
  }

  const empty = emptyVariables(target, requiredSecrets[pkg] ?? [])
  if (empty.length > 0) missing.push({ file: relative(root, target), variables: empty })
}

for (const file of created) console.log(`✔ Creado ${file}`)
for (const file of updated) console.log(`✔ Completado el acceso local del jurado en ${file}`)
for (const file of skipped) console.log(`• Ya existe ${file} (no se modifica)`)

if (missing.length > 0) {
  console.log('\nCompleta estos valores (tú los colocas; no se versionan):')
  for (const { file, variables } of missing) {
    for (const name of variables) console.log(`  - ${name} en ${file}`)
  }
} else {
  console.log('\nNo faltan valores por completar.')
}
