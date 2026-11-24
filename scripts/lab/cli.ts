// Despliegue de EBC Compass al lab de AWS con el mínimo de pasos manuales. Guía: docs/deploy-lab.md
//
//   npm run lab:check                   revisa credenciales, modelo de Bedrock y herramientas (solo lectura)
//   npm run lab:models [-- --all]       prueba qué modelos de Bedrock responden en la cuenta y sugiere Lunna/Terra (solo lectura)
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
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BedrockClient, ListFoundationModelsCommand, ListInferenceProfilesCommand } from '@aws-sdk/client-bedrock'
import { StartIngestionJobCommand, GetIngestionJobCommand, BedrockAgentClient } from '@aws-sdk/client-bedrock-agent'
import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime'
import { BedrockRuntimeClient, ConverseCommand, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminDeleteUserCommand,
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  CreateGroupCommand,
  GetGroupCommand,
  CognitoIdentityProviderClient,
  paginateListUsers,
  type AttributeType,
} from '@aws-sdk/client-cognito-identity-provider'
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts'
import { demoAccessConfig, demoUsername, managedDemoPersona, obsoleteDemoUsers } from '../../shared/demoAccounts.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
/**
 * La región es la del lab: LAB_REGION, o la que resuelva el SDK (AWS_REGION o la región del perfil en uso).
 * Así el mismo comando sirve para cualquier lab. Por omisión, us-east-1.
 */
async function resolveRegion(): Promise<string> {
  const fixed = process.env.LAB_REGION
  if (fixed) {
    if (!/^[a-z]{2,3}(-[a-z]+)+-\d$/.test(fixed)) throw new Error(`LAB_REGION no es una región válida: «${fixed}».`)
    return fixed
  }
  try {
    return await new STSClient({}).config.region()
  } catch (error) {
    // Una región mal escrita (por ejemplo con una comilla de más) no debe pasar en silencio a otra región.
    if (/Region not accepted|valid hostname/i.test((error as Error).message)) {
      throw new Error(`La región configurada en tu perfil o en AWS_REGION no es válida (${(error as Error).message}). Corrígela, por ejemplo: aws configure set region us-west-2 --profile <perfil>`)
    }
    return 'us-east-1' // sin región configurada
  }
}
const REGION = await resolveRegion()
/** Los perfiles de inferencia de Bedrock se agrupan por geografía: us.*, eu.*, apac.*… */
const GEO = REGION.startsWith('eu-') ? 'eu' : REGION.startsWith('ap-') ? 'apac' : 'us'
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
  stage?: string
  apiUrl: string
  siteUrl: string
  mcpGatewayUrl?: string
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
const MODEL_PREFERENCE = [/amazon\.nova.*lite/i, /amazon\.nova.*micro/i, /anthropic\.claude.*haiku/i, /anthropic\.claude.*sonnet/i, /amazon\.nova.*pro/i]

async function candidateModels(): Promise<string[]> {
  const ids = new Set<string>()
  try {
    const profiles = await bedrock.send(new ListInferenceProfilesCommand({ typeEquals: 'SYSTEM_DEFINED', maxResults: 100 }))
    for (const profile of profiles.inferenceProfileSummaries ?? []) if (profile.inferenceProfileId?.startsWith(GEO + '.')) ids.add(profile.inferenceProfileId)
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
  return MODEL_PREFERENCE.flatMap((pattern) => all.filter((id) => pattern.test(id)).sort((a, b) => Number(b.startsWith(GEO + '.')) - Number(a.startsWith(GEO + '.')))).filter(
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
      'o fija LAB_BEDROCK_MODEL_ID en scripts/lab/.env, y vuelve a intentar.',
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

/** Modelos de texto que Bedrock lista en la cuenta (perfiles de inferencia de la región y modelos base). */
async function listTextModels(): Promise<string[]> {
  const ids = new Set<string>()
  try {
    const profiles = await bedrock.send(new ListInferenceProfilesCommand({ typeEquals: 'SYSTEM_DEFINED', maxResults: 1000 }))
    for (const profile of profiles.inferenceProfileSummaries ?? []) if (profile.inferenceProfileId?.startsWith(GEO + '.')) ids.add(profile.inferenceProfileId)
  } catch { /* sin permiso para listar perfiles */ }
  try {
    const models = await bedrock.send(new ListFoundationModelsCommand({ byOutputModality: 'TEXT', byInferenceType: 'ON_DEMAND' }))
    for (const model of models.modelSummaries ?? []) if (model.modelId) ids.add(model.modelId)
  } catch { /* idem */ }
  return [...ids].filter((id) => !/embed|image|rerank|canvas|reel|sonic|speech|safeguard/i.test(id)).sort()
}

async function probeModel(modelId: string): Promise<{ id: string; ok: boolean; ms: number; reason?: string }> {
  const started = Date.now()
  try {
    await runtime.send(new ConverseCommand({ modelId, messages: [{ role: 'user', content: [{ text: 'Responde solo: ok' }] }], inferenceConfig: { maxTokens: 200 } }))
    return { id: modelId, ok: true, ms: Date.now() - started }
  } catch (error) {
    const message = (error as Error).message ?? ''
    const reason = /marketplace/i.test(message) ? 'bloqueado por AWS Marketplace' : /AccessDenied/i.test(message) ? 'sin permiso' : (error as Error).name || 'error'
    return { id: modelId, ok: false, ms: Date.now() - started, reason }
  }
}

/** Solo lectura: qué modelos responden en esta cuenta y qué ids fijar para Lunna y Terra. */
async function models(): Promise<void> {
  step('Modelos de Bedrock en esta cuenta (solo lectura)')
  const who = await identity()
  ok(`Cuenta ${who.account} · región ${REGION}`)
  const all = await listTextModels()
  const filter = args.find((arg) => !arg.startsWith('--'))
  const candidates = filter ? all.filter((id) => id.toLowerCase().includes(filter.toLowerCase())) : all
  console.log(`  Probando ${candidates.length} modelos (Converse)…`)
  const results: Awaited<ReturnType<typeof probeModel>>[] = []
  for (let index = 0; index < candidates.length; index += 6) results.push(...(await Promise.all(candidates.slice(index, index + 6).map(probeModel))))
  // Algunos modelos (los de Marketplace) responden la primera vez y luego se bloquean: se confirma con una segunda llamada.
  for (const item of results.filter((entry) => entry.ok)) {
    const again = await probeModel(item.id)
    if (!again.ok) Object.assign(item, { ok: false, reason: 'respondió una vez y luego se bloqueó (' + again.reason + ')' })
  }
  const usable = results.filter((item) => item.ok).sort((a, b) => a.ms - b.ms)
  for (const item of usable) ok(`${item.id}  (${item.ms} ms)`)
  const blocked = results.filter((item) => !item.ok)
  if (args.includes('--all')) for (const item of blocked) warn(`${item.id}: ${item.reason}`)
  else if (blocked.length) console.log(`  · ${blocked.length} modelos sin acceso (usa --all para verlos con el motivo)`)
  if (usable.length === 0) fail('Ningún modelo respondió en esta cuenta.')
  const preferred = MODEL_PREFERENCE.flatMap((pattern) => usable.filter((item) => pattern.test(item.id))).map((item) => item.id)
  const lunna = process.env.BEDROCK_LUNNA_MODEL_ID?.trim() || preferred[0] || usable[0].id
  const terra = process.env.BEDROCK_TERRA_MODEL_ID?.trim() || lunna
  console.log('\nPara fijar los modelos del chat, agrega a scripts/lab/.env y vuelve a desplegar:')
  console.log(`  BEDROCK_LUNNA_MODEL_ID=${lunna}`)
  console.log(`  BEDROCK_TERRA_MODEL_ID=${terra}`)
  console.log('Si omites estas variables, el despliegue elige solo uno (el primero que responda) para ambos.')
}

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

async function personas(): Promise<void> {
  requireConfirm('lab:personas')
  const { enabled, password: sharedPassword } = demoAccessConfig(process.env)
  const o = outputs()
  if (o.stage && o.stage !== stage) fail('El stage de LAB_OUTPUTS_FILE no coincide con LAB_STAGE.')
  const registryFile = join(here, '.state', 'personas.json')
  const registry = existsSync(registryFile) ? JSON.parse(readFileSync(registryFile, 'utf8')) as Record<string, { username: string; password: string; ready?: boolean; sub?: string; shared?: boolean }> : {}
  const seeds = JSON.parse(readFileSync(join(repoRoot, 'shared', 'personas.json'), 'utf8')) as { id: string; hasProfile: boolean; name: string; enrollment: string; campus: string; campusName: string; career: string; program: string; period: number; periodType: string; role?: string }[]
  try { await cognito.send(new GetGroupCommand({ UserPoolId: o.cognitoUserPoolId, GroupName: 'admin' })) }
  catch (error) { if ((error as { name?: string }).name !== 'ResourceNotFoundException') throw error; await cognito.send(new CreateGroupCommand({ UserPoolId: o.cognitoUserPoolId, GroupName: 'admin', Description: 'Administración de la demo' })) }
  mkdirSync(dirname(registryFile), { recursive: true })
  const save = () => { writeFileSync(registryFile, JSON.stringify(registry, null, 2) + '\n', { mode: 0o600 }); chmodSync(registryFile, 0o600) }
  for (const seed of seeds) {
    const previous = registry[seed.id]
    const username = demoUsername(seed.id)
    const password = sharedPassword ?? (previous?.shared ? undefined : previous?.password) ?? demoPassword()
    const attributes: Record<string, string> = { email: username, email_verified: 'true', 'custom:personaId': seed.id }
    if (seed.hasProfile) Object.assign(attributes, { name: seed.name, 'custom:matricula': seed.enrollment, 'custom:campus': seed.campusName,
      'custom:campusCode': seed.campus, 'custom:programa': seed.program, 'custom:career': seed.career,
      'custom:semestre': String(seed.period), 'custom:periodo': seed.periodType })
    const target = { UserPoolId: o.cognitoUserPoolId, Username: username }
    let existing: AttributeType[] | undefined
    try {
      const result = await cognito.send(new AdminGetUserCommand(target))
      existing = result.UserAttributes ?? []
      if (managedDemoPersona(existing) !== seed.id) throw new Error('La identidad de la cuenta no coincide: ' + seed.id)
    } catch (error) { if ((error as Error).name !== 'UserNotFoundException') throw error }
    const UserAttributes = Object.entries(attributes).map(([Name, Value]) => ({ Name, Value }))
    const sub = existing?.find(item => item.Name === 'sub')?.Value
    let savedSub = sub
    if (!existing) {
      const created = await cognito.send(new AdminCreateUserCommand({ ...target, MessageAction: 'SUPPRESS', UserAttributes }))
      savedSub = created.User?.Attributes?.find(item => item.Name === 'sub')?.Value
    } else {
      const current = new Map(existing.map(item => [item.Name, item.Value]))
      const changes = UserAttributes.filter(({ Name, Value }) => current.get(Name) !== Value)
      if (changes.length > 0) await cognito.send(new AdminUpdateUserAttributesCommand({ ...target, UserAttributes: changes }))
    }
    if (!existing || !previous?.ready || previous.password !== password || previous.sub !== sub) {
      await cognito.send(new AdminSetUserPasswordCommand({ ...target, Password: password, Permanent: true }))
    }
    if (seed.role === 'admin') await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId: o.cognitoUserPoolId, Username: username, GroupName: 'admin' }))
    registry[seed.id] = { username, password, ready: true, sub: savedSub, shared: Boolean(sharedPassword) }
    save()
  }
  const current = new Set(seeds.map(seed => seed.id))
  const obsolete: string[] = []
  for await (const page of paginateListUsers({ client: cognito }, { UserPoolId: o.cognitoUserPoolId })) {
    obsolete.push(...obsoleteDemoUsers(page.Users ?? [], current))
  }
  for (const Username of obsolete) {
    await cognito.send(new AdminDeleteUserCommand({ UserPoolId: o.cognitoUserPoolId, Username }))
      .catch(error => { if ((error as Error).name !== 'UserNotFoundException') throw error })
  }
  for (const id of Object.keys(registry)) if (!current.has(id)) delete registry[id]
  save()
  ok(`${seeds.length} cuentas demo preparadas. Cuentas obsoletas retiradas: ${obsolete.length}.`)
  console.log(enabled ? 'Las cuentas están listas para el panel de acceso.' : 'Registro local: scripts/lab/.state/personas.json')
}

async function mcp(): Promise<void> {
  if (process.env.AWS_ENDPOINT_URL || process.env.AWS_ENDPOINT_URL_BEDROCK_AGENTCORE) fail('lab:mcp requiere el Gateway de AWS, sin endpoint del emulador.')
  const o = outputs()
  if (o.stage && o.stage !== stage) fail('El stage de LAB_OUTPUTS_FILE no coincide con LAB_STAGE.')
  const gatewayUrl = o.mcpGatewayUrl
  if (!gatewayUrl) return fail('Falta mcpGatewayUrl en las salidas del lab. Despliega primero la infraestructura de la tarea 3.')
  const { gatewayMcpClient } = await import('../../backend/src/mcp/client.js')
  const { smokeStudent, verifyMcpStudent } = await import('../../backend/src/mcp/smoke.js')
  const registryFile = join(here, '.state', 'personas.json')
  if (!existsSync(registryFile)) fail('Registra las cuentas con npm run lab:personas -- --confirm.')
  const accounts = JSON.parse(readFileSync(registryFile, 'utf8')) as Record<string, { username: string; password: string }>
  for (const persona of ['ana-ingreso', 'ana']) {
    const account = accounts[persona]
    if (!account) fail('Falta aprovisionar la cuenta de ' + persona)
    const auth = await cognito.send(new AdminInitiateAuthCommand({
      UserPoolId: o.cognitoUserPoolId, ClientId: o.cognitoWebClientId, AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
      AuthParameters: { USERNAME: account.username, PASSWORD: account.password },
    }))
    const token = auth.AuthenticationResult?.IdToken
    if (!token) return fail('Cognito no entregó un ID token para ' + persona)
    const student = smokeStudent(token, persona)
    await verifyMcpStudent(gatewayMcpClient(student, gatewayUrl), student, o.apiUrl, token, { search: persona === 'ana-ingreso' })
    ok('MCP Gateway: ' + persona)
  }
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

    const streamResponse = await fetch(apiBase(o) + '/api/assistant/messages/stream', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ studentId, message: '¿Qué becas hay disponibles?' }),
    })
    const streamText = await streamResponse.text()
    check(streamResponse.ok && Boolean(streamResponse.headers.get('content-type')?.includes('text/event-stream')), 'Streaming devuelve SSE')
    check(streamText.includes('event: token') && streamText.includes('event: done') && !streamText.includes('event: error'), 'Streaming produce fragmentos y respuesta final')
    const frame = streamText.split(/\r?\n\r?\n/).find(value => value.startsWith('event: done'))
    if (frame) {
      const final = JSON.parse(frame.split('data: ')[1]) as { conversationId: string }
      await call('DELETE', '/api/assistant/conversations/' + final.conversationId)
    }

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
  const jury = demoAccessConfig(process.env)
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
  run('npx', ['sst', 'install'], { cwd: join(repoRoot, 'platform') })
  run('npx', ['sst', 'deploy', '--stage', stage], { cwd: join(repoRoot, 'platform'), env: { BEDROCK_MODEL_ID: modelId, AWS_REGION: REGION } })
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

  if (args.includes('--verify-mcp')) {
    step('AgentCore MCP: registro y verificación sin chat')
    await personas()
    await mcp()
  }

  console.log('\n✔ Despliegue completo.')
  status()
  console.log(jury.enabled
    ? '\nPara habilitar las cuentas del panel: npm run lab:personas -- --confirm'
    : '\nPara entrar al sitio crea un usuario de demostración: npm run lab:user -- --confirm')
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
  run('npx', ['sst', 'remove', '--stage', stage], { cwd: join(repoRoot, 'platform'), env: { BEDROCK_MODEL_ID: process.env.LAB_BEDROCK_MODEL_ID || (readState().modelId as string) || 'unused', AWS_REGION: REGION } })
  ok('Despliegue eliminado')
}

const commands: Record<string, () => Promise<void> | void> = { check, models, deploy, knowledge, smoke, user, personas, mcp, status, destroy }
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
