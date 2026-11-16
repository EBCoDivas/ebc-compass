// Despliegue de EBC Compass al lab de AWS con el mínimo de pasos manuales. Guía: docs/deploy-lab.md
//
//   npm run lab:check                   revisa credenciales, modelo de Bedrock y herramientas (solo lectura)
//   npm run lab:deploy -- --confirm     TODO en un comando: modelo → SST deploy → conocimiento → prueba de humo
//   npm run lab:knowledge -- --confirm  sube documentos, sincroniza la Knowledge Base y comprueba la recuperación
//   npm run lab:smoke -- --confirm      prueba de humo contra el sitio y el API desplegados
//   npm run lab:user -- --confirm       crea o reinicia el usuario de demostración y muestra su contraseña
//   npm run lab:status                  URLs y recursos del despliegue (solo lectura)
//   npm run lab:destroy -- --confirm    elimina todo lo desplegado
//
// Los comandos que cambian la nube exigen --confirm (el README reserva el despliegue a actividades autorizadas).

import { spawnSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BedrockClient, ListFoundationModelsCommand, ListInferenceProfilesCommand } from '@aws-sdk/client-bedrock'
import { StartIngestionJobCommand, GetIngestionJobCommand, BedrockAgentClient } from '@aws-sdk/client-bedrock-agent'
import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime'
import { BedrockRuntimeClient, ConverseCommand, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider'
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..')
const REGION = 'us-east-1' // misma región que platform/sst.config.ts
const stage = process.env.LAB_STAGE || 'dev'
const stateFile = join(here, '.state', 'lab.json')
// SST escribe aquí las salidas del despliegue; LAB_OUTPUTS_FILE permite apuntar a otro archivo (p. ej. un despliegue hecho en otra máquina).
const outputsFile = process.env.LAB_OUTPUTS_FILE || join(repoRoot, 'platform', '.sst', 'outputs.json')
const exportDir = join(repoRoot, 'local', '.state', 'knowledge-s3')
const args = process.argv.slice(3)
const confirmed = args.includes('--confirm')

const sts = new STSClient({ region: REGION })
const bedrock = new BedrockClient({ region: REGION })
const runtime = new BedrockRuntimeClient({ region: REGION })
const agent = new BedrockAgentClient({ region: REGION })
const agentRuntime = new BedrockAgentRuntimeClient({ region: REGION })
const cognito = new CognitoIdentityProviderClient({ region: REGION })
// Con un endpoint personalizado (AWS Emulator) S3 necesita direccionamiento por ruta; en AWS real no aplica.
const s3 = new S3Client({ region: REGION, forcePathStyle: Boolean(process.env.AWS_ENDPOINT_URL) })

// ---------- Utilidades ----------

const ok = (text: string) => console.log(`✔ ${text}`)
const warn = (text: string) => console.log(`⚠ ${text}`)
const step = (text: string) => console.log(`\n▶ ${text}`)

class LabError extends Error {}
const fail = (message: string): never => {
  throw new LabError(message)
}

function requireConfirm(action: string): void {
  if (confirmed) return
  console.error(`✖ "${action}" cambia recursos en la nube. Revisa docs/deploy-lab.md y vuelve a ejecutar con --confirm.`)
  process.exit(1)
}

function run(command: string, commandArgs: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): void {
  const result = spawnSync(command, commandArgs, { cwd: options.cwd ?? repoRoot, stdio: 'inherit', env: { ...process.env, ...options.env } })
  if (result.status !== 0) fail(`Falló: ${command} ${commandArgs.join(' ')}`)
}

function readState(): Record<string, unknown> {
  return existsSync(stateFile) ? (JSON.parse(readFileSync(stateFile, 'utf8')) as Record<string, unknown>) : {}
}

function writeState(patch: Record<string, unknown>): void {
  mkdirSync(dirname(stateFile), { recursive: true })
  writeFileSync(stateFile, JSON.stringify({ ...readState(), ...patch }, null, 2) + '\n')
}

interface Outputs {
  apiUrl: string
  siteUrl: string
  cognitoUserPoolId: string
  cognitoWebClientId: string
  documentsBucketName: string
  knowledgeBaseId: string
  knowledgeBaseDataSourceId: string
  conversationsTable: string
  backendFunction: string
}

function outputs(): Outputs {
  if (!existsSync(outputsFile)) fail('No hay salidas de SST (platform/.sst/outputs.json). Ejecuta primero: npm run lab:deploy -- --confirm')
  const data = JSON.parse(readFileSync(outputsFile, 'utf8')) as Partial<Outputs>
  const missing = ['apiUrl', 'siteUrl', 'cognitoUserPoolId', 'cognitoWebClientId', 'documentsBucketName', 'knowledgeBaseId', 'knowledgeBaseDataSourceId'].filter(
    (key) => !data[key as keyof Outputs],
  )
  if (missing.length > 0) fail(`Las salidas de SST están incompletas (${missing.join(', ')}). Vuelve a desplegar: npm run lab:deploy -- --confirm`)
  return data as Outputs
}

const apiBase = (o: Outputs) => o.apiUrl.replace(/\/+$/, '')

// ---------- 1) Credenciales ----------

async function identity(): Promise<{ account: string; arn: string }> {
  try {
    const who = await sts.send(new GetCallerIdentityCommand({}))
    return { account: who.Account ?? '?', arn: who.Arn ?? '?' }
  } catch {
    return fail(
      'No hay credenciales de AWS válidas. Inicia sesión en la cuenta del lab (p. ej. `aws sso login --profile <perfil>` y `export AWS_PROFILE=<perfil>`, ' +
        'o exporta AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN) y vuelve a intentar.',
    )
  }
}

// ---------- 2) Modelo de Bedrock ----------

/** Familias preferidas (rápidas y baratas primero). Se detecta cuál está realmente disponible en la cuenta. */
const MODEL_PREFERENCE = [/anthropic\.claude.*haiku/i, /amazon\.nova.*lite/i, /amazon\.nova.*micro/i, /anthropic\.claude.*sonnet/i, /amazon\.nova.*pro/i]

async function candidateModels(): Promise<string[]> {
  const ids = new Set<string>()
  try {
    const profiles = await bedrock.send(new ListInferenceProfilesCommand({ typeEquals: 'SYSTEM_DEFINED', maxResults: 100 }))
    for (const profile of profiles.inferenceProfileSummaries ?? []) if (profile.inferenceProfileId?.startsWith('us.')) ids.add(profile.inferenceProfileId)
  } catch {
    // Sin permiso para listar perfiles: se usan solo los modelos base.
  }
  try {
    const models = await bedrock.send(new ListFoundationModelsCommand({ byOutputModality: 'TEXT', byInferenceType: 'ON_DEMAND' }))
    for (const model of models.modelSummaries ?? []) if (model.modelId) ids.add(model.modelId)
  } catch {
    // idem
  }
  const all = [...ids]
  return MODEL_PREFERENCE.flatMap((pattern) => all.filter((id) => pattern.test(id)).sort((a, b) => Number(b.startsWith('us.')) - Number(a.startsWith('us.')))).filter(
    (id, index, list) => list.indexOf(id) === index,
  )
}

async function modelWorks(modelId: string): Promise<boolean> {
  try {
    await runtime.send(new ConverseCommand({ modelId, messages: [{ role: 'user', content: [{ text: 'Responde solo: ok' }] }], inferenceConfig: { maxTokens: 20 } }))
    return true
  } catch {
    return false
  }
}

async function chooseModel(): Promise<string> {
  const forced = process.env.LAB_BEDROCK_MODEL_ID?.trim()
  if (forced) {
    if (!(await modelWorks(forced))) fail(`El modelo LAB_BEDROCK_MODEL_ID (${forced}) no responde en esta cuenta. Revisa el acceso en la consola de Bedrock o déjalo vacío.`)
    return forced
  }
  const candidates = await candidateModels()
  if (candidates.length === 0) fail('No se encontraron modelos de texto de Bedrock en la cuenta.')
  for (const id of candidates) {
    process.stdout.write(`  · probando ${id} … `)
    if (await modelWorks(id)) {
      console.log('responde')
      return id
    }
    console.log('sin acceso')
  }
  return fail(
    'Ningún modelo de Bedrock respondió. Habilita el acceso a un modelo (p. ej. Claude Haiku o Amazon Nova Lite) en la consola de Amazon Bedrock → Model access, ' +
      'o fija LAB_BEDROCK_MODEL_ID en lab/.env, y vuelve a intentar.',
  )
}

async function embeddingsWork(): Promise<boolean> {
  try {
    await runtime.send(
      new InvokeModelCommand({ modelId: 'amazon.titan-embed-text-v2:0', contentType: 'application/json', accept: 'application/json', body: JSON.stringify({ inputText: 'hola' }) }),
    )
    return true
  } catch {
    return false
  }
}

// ---------- Comandos ----------

async function check(): Promise<void> {
  step('Revisión previa (solo lectura)')
  const major = Number(process.versions.node.split('.')[0])
  major === 22 ? ok(`Node ${process.versions.node}`) : fail(`Se requiere Node 22 (tienes ${process.versions.node}).`)

  const who = await identity()
  ok(`Credenciales de AWS · cuenta ${who.account} · ${who.arn}`)
  ok(`Región ${REGION} · stage "${stage}"`)

  existsSync(join(repoRoot, 'platform', 'node_modules')) ? ok('Dependencias de platform/ instaladas') : warn('platform/ sin dependencias (el despliegue las instala solo).')

  console.log('  Buscando un modelo de Bedrock disponible…')
  const modelId = await chooseModel()
  ok(`Modelo de chat: ${modelId}`)
  ;(await embeddingsWork()) ? ok('Titan Text Embeddings V2 disponible (lo usa la Knowledge Base)') : warn('Titan Text Embeddings V2 no responde: habilítalo en Bedrock → Model access antes de sincronizar el conocimiento.')

  writeState({ account: who.account, stage, modelId })
  console.log('\nTodo listo para desplegar: npm run lab:deploy -- --confirm')
}

function exportKnowledge(): string[] {
  if (!existsSync(join(repoRoot, 'local', 'node_modules'))) run('npm', ['--prefix', 'local', 'install', '--no-audit', '--no-fund'])
  run('npm', ['--prefix', 'local', 'run', '-s', 'kb:export'])
  return readdirSync(exportDir)
}

async function knowledge(): Promise<void> {
  requireConfirm('lab:knowledge')
  const o = outputs()
  step('Conocimiento: exportar, subir y sincronizar la Knowledge Base')
  const files = exportKnowledge()

  // Sincroniza el bucket con el export (sube lo actual y retira lo que ya no existe).
  for (const file of files) {
    await s3.send(
      new PutObjectCommand({ Bucket: o.documentsBucketName, Key: file, Body: readFileSync(join(exportDir, file)), ContentType: file.endsWith('.json') ? 'application/json' : 'text/markdown' }),
    )
  }
  const existing = await s3.send(new ListObjectsV2Command({ Bucket: o.documentsBucketName }))
  const stale = (existing.Contents ?? []).map((object) => object.Key!).filter((key) => !files.includes(key))
  if (stale.length > 0) await s3.send(new DeleteObjectsCommand({ Bucket: o.documentsBucketName, Delete: { Objects: stale.map((Key) => ({ Key })) } }))
  ok(`${files.length} archivos en s3://${o.documentsBucketName}${stale.length ? ` (${stale.length} obsoletos eliminados)` : ''}`)

  const started = await agent.send(new StartIngestionJobCommand({ knowledgeBaseId: o.knowledgeBaseId, dataSourceId: o.knowledgeBaseDataSourceId }))
  const jobId = started.ingestionJob?.ingestionJobId
  if (!jobId) fail('La Knowledge Base no devolvió un identificador de sincronización.')
  process.stdout.write('  Sincronizando')
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5000))
    const job = (await agent.send(new GetIngestionJobCommand({ knowledgeBaseId: o.knowledgeBaseId, dataSourceId: o.knowledgeBaseDataSourceId, ingestionJobId: jobId! }))).ingestionJob
    process.stdout.write('.')
    if (job?.status === 'COMPLETE') {
      const stats = job.statistics
      console.log(`\n✔ Sincronización completa: ${stats?.numberOfNewDocumentsIndexed ?? 0} nuevos, ${stats?.numberOfModifiedDocumentsIndexed ?? 0} modificados, ${stats?.numberOfDocumentsFailed ?? 0} con error`)
      if ((stats?.numberOfDocumentsFailed ?? 0) > 0) fail(`Hubo documentos con error: ${(job.failureReasons ?? []).join('; ')}`)
      return verifyKnowledge(o)
    }
    if (job?.status === 'FAILED') fail(`La sincronización falló: ${(job.failureReasons ?? []).join('; ')}`)
  }
  fail('La sincronización tardó más de 10 minutos.')
}

/** Mismas preguntas doradas que `npm run kb:verify` en local (5 ES + 5 EN), ahora contra la Knowledge Base real. */
async function verifyKnowledge(o: Outputs): Promise<void> {
  const golden = JSON.parse(readFileSync(join(repoRoot, 'knowledge', 'golden-questions.json'), 'utf8')) as { questions: { question: string; language: string; expect: string }[] }
  let passed = 0
  for (const item of golden.questions) {
    const result = await agentRuntime.send(
      new RetrieveCommand({
        knowledgeBaseId: o.knowledgeBaseId,
        retrievalQuery: { text: item.question },
        retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: 3, filter: { equals: { key: 'language', value: item.language } } } },
      }),
    )
    const files = [...new Set((result.retrievalResults ?? []).map((r) => (r.location?.s3Location?.uri ?? '').split('/').pop()))]
    const good = files.includes(item.expect)
    if (good) passed += 1
    console.log(`  ${good ? '✔' : '✖'} [${item.language}] ${item.question} → ${files.join(', ') || '(nada)'}`)
  }
  const ratio = passed / golden.questions.length
  console.log(`  ${passed}/${golden.questions.length} (${Math.round(ratio * 100)}%) · umbral 90%`)
  if (ratio < 0.9) fail('La recuperación de la Knowledge Base quedó por debajo del 90%.')
  ok('La Knowledge Base recupera los documentos esperados')
}

function demoPassword(): string {
  return `${randomBytes(12).toString('base64url')}Aa1!`
}

async function ensureUser(o: Outputs, email: string, password: string): Promise<void> {
  try {
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: o.cognitoUserPoolId,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
        ],
        MessageAction: 'SUPPRESS',
      }),
    )
  } catch (error) {
    if ((error as { name?: string }).name !== 'UsernameExistsException') throw error
  }
  await cognito.send(new AdminSetUserPasswordCommand({ UserPoolId: o.cognitoUserPoolId, Username: email, Password: password, Permanent: true }))
}

async function user(): Promise<void> {
  requireConfirm('lab:user')
  const o = outputs()
  const email = args.find((arg) => arg.includes('@')) ?? process.env.LAB_DEMO_EMAIL ?? 'demo@ebc-compass.example'
  const password = demoPassword()
  await ensureUser(o, email, password)
  console.log('\nUsuario de demostración listo (la contraseña solo se muestra ahora; si la pierdes, vuelve a ejecutar este comando):')
  console.log(`  Sitio:      ${o.siteUrl}`)
  console.log(`  Correo:     ${email}`)
  console.log(`  Contraseña: ${password}`)
}

async function smoke(): Promise<void> {
  requireConfirm('lab:smoke')
  const o = outputs()
  step('Prueba de humo (usa un usuario temporal que se borra al terminar)')
  let failures = 0
  const check = (good: boolean, label: string, detail = '') => {
    if (!good) failures += 1
    console.log(`${good ? '✔' : '✖'} ${label}${detail ? ` — ${detail}` : ''}`)
  }

  const email = `smoke-${Date.now()}@ebc-compass.example`
  const password = demoPassword()
  await ensureUser(o, email, password)
  try {
    const auth = await cognito.send(
      new AdminInitiateAuthCommand({
        UserPoolId: o.cognitoUserPoolId,
        ClientId: o.cognitoWebClientId,
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        AuthParameters: { USERNAME: email, PASSWORD: password },
      }),
    )
    const token = auth.AuthenticationResult?.IdToken
    check(Boolean(token), 'Inicio de sesión en Cognito (token JWT)')
    if (!token) fail('No se obtuvo token de Cognito.')

    const call = async (method: string, path: string, body?: unknown, withToken = true) => {
      const started = performance.now()
      const response = await fetch(`${apiBase(o)}${path}`, {
        method,
        headers: { 'content-type': 'application/json', ...(withToken ? { authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const text = await response.text()
      return { status: response.status, data: text ? JSON.parse(text) : undefined, ms: Math.round(performance.now() - started) }
    }

    check((await call('GET', '/api/health', undefined, false)).status === 401, 'Sin token el API responde 401 (el authorizer JWT funciona)')
    const health = await call('GET', '/api/health')
    check(health.status === 200, 'GET /api/health con token', `${health.ms} ms (incluye arranque en frío)`)
    const catalog = await call('GET', '/api/opportunities?career=finance')
    check(catalog.status === 200 && catalog.data.length > 0, 'GET /api/opportunities', `${catalog.data?.length} oportunidades`)

    // En el lab la identidad sale del token (sub); el studentId solo lo usa el backend local, así la misma prueba sirve en ambos.
    const studentId = randomUUID()
    const profile = { name: 'María', campus: 'CMS', career: 'finance', currentSemester: 5 }
    const first = await call('POST', '/api/assistant/messages', { studentId, message: '¿Qué becas hay para mi carrera?', profile })
    check(first.status === 200 && first.data.message.intent === 'scholarship-info', 'Asistente (ES) con Bedrock', `${first.data?.meta?.mode}, ${first.data?.meta?.latencyMs} ms${first.data?.meta?.degraded ? ', DEGRADADO' : ''}`)
    check(first.data?.meta?.mode === 'llm' && first.data?.meta?.degraded === false, 'La respuesta la redactó el modelo (no el respaldo por reglas)')
    const conversationId = first.data?.conversationId as string
    const followUp = await call('POST', '/api/assistant/messages', { studentId, conversationId, message: '¿y la fecha límite?', profile })
    check(followUp.status === 200 && followUp.data.message.intent === 'scholarship-info', 'El seguimiento conserva el tema (conversación en DynamoDB)', `${followUp.data?.meta?.latencyMs} ms`)
    const english = await call('POST', '/api/assistant/messages', { studentId, message: 'Which certifications do you recommend?', profile })
    check(english.status === 200 && english.data.message.language === 'en', 'Asistente (EN)', `${english.data?.meta?.mode}, ${english.data?.meta?.latencyMs} ms`)
    const history = await call('GET', `/api/assistant/conversations/${conversationId}?studentId=${studentId}`)
    check(history.status === 200 && history.data.messages.length === 4, 'El historial se guardó', `${history.data?.messages?.length} mensajes`)
    check((await call('DELETE', `/api/assistant/conversations/${conversationId}?studentId=${studentId}`)).status === 204, 'Borrar la conversación')
    check((await call('GET', `/api/assistant/conversations/${conversationId}?studentId=${studentId}`)).status === 404, 'La conversación borrada ya no existe')
    await call('DELETE', `/api/assistant/conversations/${english.data?.conversationId}?studentId=${studentId}`)

    const site = await fetch(o.siteUrl)
    const html = await site.text()
    check(site.status === 200 && html.includes('id="root"'), 'El sitio (CloudFront) responde', o.siteUrl)
  } finally {
    await cognito.send(new AdminDeleteUserCommand({ UserPoolId: o.cognitoUserPoolId, Username: email })).catch(() => undefined)
  }
  if (failures > 0) fail(`${failures} verificación(es) de la prueba de humo fallaron.`)
  ok('Prueba de humo completa')
}

function status(): void {
  const state = readState()
  console.log(`Stage: ${stage} · Región: ${REGION}${state.account ? ` · Cuenta: ${state.account}` : ''}${state.modelId ? ` · Modelo: ${state.modelId}` : ''}`)
  if (!existsSync(outputsFile)) {
    console.log('Aún no hay un despliegue. Ejecuta: npm run lab:deploy -- --confirm')
    return
  }
  const o = outputs()
  console.log(`Sitio:        ${o.siteUrl}\nAPI:          ${o.apiUrl}\nCognito pool: ${o.cognitoUserPoolId}\nKnowledge Base: ${o.knowledgeBaseId}\nBucket de documentos: ${o.documentsBucketName}\nTabla de conversaciones: ${o.conversationsTable ?? '(no disponible)'}`)
}

async function deploy(): Promise<void> {
  requireConfirm('lab:deploy')
  const skipKnowledge = args.includes('--skip-knowledge')
  const skipSmoke = args.includes('--skip-smoke')

  step('1/5 Cuenta de AWS')
  const who = await identity()
  ok(`Cuenta ${who.account} · ${who.arn} · región ${REGION} · stage "${stage}"`)

  step('2/5 Modelo de Bedrock')
  const modelId = await chooseModel()
  ok(`Modelo: ${modelId}`)
  writeState({ account: who.account, stage, modelId })

  step('3/5 Despliegue con SST (infraestructura, backend y frontend; la primera vez tarda varios minutos)')
  for (const pkg of ['platform', 'backend']) {
    if (!existsSync(join(repoRoot, pkg, 'node_modules'))) run('npm', ['--prefix', pkg, 'install', '--no-audit', '--no-fund'])
  }
  run('npx', ['sst', 'deploy', '--stage', stage], { cwd: join(repoRoot, 'platform'), env: { BEDROCK_MODEL_ID: modelId } })
  outputs()
  writeState({ deployedAt: new Date().toISOString() })

  if (skipKnowledge) warn('Conocimiento omitido (--skip-knowledge). Ejecuta después: npm run lab:knowledge -- --confirm')
  else {
    step('4/5 Base de conocimiento')
    await knowledge()
  }

  if (skipSmoke) warn('Prueba de humo omitida (--skip-smoke).')
  else {
    step('5/5 Prueba de humo')
    await smoke()
  }

  console.log('\n✔ Despliegue completo.')
  status()
  console.log('\nPara entrar al sitio crea un usuario de demostración: npm run lab:user -- --confirm')
}

async function destroy(): Promise<void> {
  requireConfirm('lab:destroy')
  await identity()
  step('Eliminando el despliegue')
  if (existsSync(outputsFile)) {
    const o = outputs()
    // SST no puede borrar un bucket con objetos: se vacía antes.
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: o.documentsBucketName })).catch(() => undefined)
    const keys = (listed?.Contents ?? []).map((object) => object.Key!)
    if (keys.length > 0) await s3.send(new DeleteObjectsCommand({ Bucket: o.documentsBucketName, Delete: { Objects: keys.map((Key) => ({ Key })) } }))
    ok(`Bucket de documentos vaciado (${keys.length} objetos)`)
  }
  run('npx', ['sst', 'remove', '--stage', stage], { cwd: join(repoRoot, 'platform'), env: { BEDROCK_MODEL_ID: process.env.LAB_BEDROCK_MODEL_ID || (readState().modelId as string) || 'unused' } })
  ok('Despliegue eliminado')
}

const commands: Record<string, () => Promise<void> | void> = { check, deploy, knowledge, smoke, user, status, destroy }
const command = commands[process.argv[2] ?? '']
if (!command) {
  console.error(`Uso: lab <${Object.keys(commands).join('|')}>`)
  process.exit(2)
}
try {
  await command()
} catch (error) {
  console.error(`\n✖ ${(error as Error).message}`)
  process.exit(1)
}
