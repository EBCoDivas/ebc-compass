import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { createBannerHandler, handler as bannerLambda } from '../banner/lambda.js'
import { createCatalogStore } from '../banner/catalog/store.js'
import '../testing/seedCatalog.js'
import { createBannerActionHandler } from '../banner/actions.js'
import { createBannerReader } from '../banner/reader.js'
import { ConversationRepository } from '../assistant/conversations/repository.js'
import { MemoryDocumentStore } from '../assistant/conversations/store.js'
import { KeywordRetriever } from '../assistant/adapters/retrievers.js'
import { forgetMemory } from '../assistant/conversations/memory.js'
import { academicProgressReader } from '../data/studentAcademicProgress.js'
import { asObject, encodeStudentContext, STUDENT_CONTEXT_HEADER, TARGET_NAME, toolList } from './contract.js'
import { localMcpClient, gatewayMcpClient } from './client.js'
import { makeGatewayHandler } from './lambda.js'
import { makeToolHandler } from './tools.js'
import type { StudentContext } from '../planning/readStudentJourney.js'
import { LambdaClient } from '@aws-sdk/client-lambda'

const personas = JSON.parse(readFileSync(new URL('../../../shared/personas.json', import.meta.url), 'utf8')) as {
  id: string; studentId: string; enrollment: string; career: string; campus: string; period: number
}[]
const students = Object.fromEntries(personas.map(item => [item.id, {
  subject: item.studentId, personaId: item.id, enrollment: item.enrollment || undefined,
  career: item.career || undefined, campus: item.campus || undefined, semester: item.period || undefined,
} satisfies StudentContext]))

function setup(fail = false) {
  const store = new MemoryDocumentStore()
  const repo = new ConversationRepository(store)
  const lambda = new LambdaClient({})
  const privateApi = createBannerHandler(createBannerActionHandler(new MemoryDocumentStore()), () => createCatalogStore(new MemoryDocumentStore()).list())
  const requests: unknown[] = []
  lambda.middlewareStack.add(() => async args => {
    const input = args.input as { Payload: Uint8Array }
    const payload = JSON.parse(Buffer.from(input.Payload).toString('utf8'))
    requests.push(payload)
    const result = fail ? { FunctionError: 'Unhandled' } : { Payload: Buffer.from(JSON.stringify(await privateApi(payload))) }
    return { response: {}, output: { $metadata: {}, StatusCode: 200, ...result } }
  }, { step: 'initialize' })
  const banner = createBannerReader({ BANNER_FUNCTION_NAME: 'banner-test' }, lambda)
  const tools = makeToolHandler({
    banner, store, memories: repo,
    today: () => '2026-11-22',
    knowledge: new KeywordRetriever(fileURLToPath(new URL('../../../knowledge', import.meta.url))),
  })
  return { repo, banner, tools, requests }
}

test('all demo personas get scoped tools through MCP and the same academic contract as HTTP', async () => {
  const { tools, banner, requests } = setup()
  const distinct = new Map<string, unknown>()
  for (const [id, student] of Object.entries(students)) {
    const client = localMcpClient(student, tools)
    assert.deepEqual(await client.list(), toolList.map(tool => TARGET_NAME + '___' + tool.name))
    const context = await client.call('get_student_context')
    const progress = await client.call('get_academic_progress')
    assert.ok(context.ok && progress.ok)
    assert.deepEqual(progress.data, { progress: await academicProgressReader(banner).read({ ...student, id: student.subject }) })
    const planning = asObject(context.data)!
    const opportunities = await client.call('list_opportunities')
    assert.ok(opportunities.ok)
    const scoped = asObject(opportunities.data)?.opportunities
    assert.ok(Array.isArray(scoped) && scoped.length)
    assert.ok(Array.isArray(planning.pending) && planning.pending.every(item => scoped.some(entry => entry.id === item.opportunityId)))
    const requirements = await client.call('get_requirements', { opportunityId: scoped[0].id })
    assert.ok(requirements.ok)
    assert.ok((await client.call('search_knowledge', { query: '¿Qué es la Beca de Excelencia Académica BEA?', language: 'es' })).ok)
    distinct.set(id, { stage: planning.stage, ...progress.data })
    if (id === 'sin-perfil') assert.deepEqual(progress.data, { progress: null })
  }
  assert.notDeepEqual(distinct.get('ana'), distinct.get('ana-ingreso'))
  assert.ok(requests.length)
  assert.ok(requests.every(item => {
    const request = asObject(item)!
    return request.operation === 'getStudentRecord' ? Object.keys(request).sort().join(',') === 'enrollment,operation,semester,version'
      : request.operation === 'getEnrollmentActions' && Object.keys(request).sort().join(',') === 'identity,operation,version'
  }))
})

test('the tool target requires gateway context and rejects model-supplied identities and wrong scope', async () => {
  const { tools, requests } = setup()
  const handler = makeGatewayHandler(tools)
  const headers = (student: StudentContext) => ({ [STUDENT_CONTEXT_HEADER.toUpperCase()]: [encodeStudentContext(student)] })
  const context = (name: string, student?: StudentContext) => ({
    clientContext: { custom: { bedrockAgentCoreToolName: 'compass___' + name, bedrockAgentCorePropagatedHeaders: student && headers(student) } },
  })
  const ana = students['ana-ingreso']
  assert.deepEqual(await handler({}, context('get_academic_progress')), { ok: false, code: 'UNAUTHORIZED' })
  assert.deepEqual(await handler({ studentId: students.ana.subject }, context('get_academic_progress', ana)), { ok: false, code: 'INVALID_INPUT' })
  assert.deepEqual(await handler({ opportunityId: 'accounting-graduation' }, context('get_requirements', ana)), { ok: false, code: 'NOT_FOUND' })
  assert.deepEqual(await handler({ query: 'Calificaciones M0100012', language: 'es' }, context('search_knowledge', ana)), { ok: false, code: 'INVALID_INPUT' })
  assert.equal(requests.length, 0)
  assert.deepEqual(await handler({}, context('get_academic_progress', { ...ana, enrollment: students.diego.enrollment })), { ok: true, data: { progress: null } })
  const result = await handler({}, context('get_academic_progress', ana))
  assert.ok(result.ok)
  assert.equal(asObject(asObject(result.data)?.progress)?.studentId, ana.subject)
})

test('forgetting a memory is respected and Banner failure does not silently return fixtures', async () => {
  const { repo, tools } = setup()
  const read = () => tools('get_student_context', {}, students.ana)
  const initial = await read()
  assert.ok(initial.ok && JSON.stringify(initial.data).includes('works-afternoons'))
  await forgetMemory(repo, students.ana.subject, 'workSchedule')
  const forgotten = await read()
  assert.ok(forgotten.ok && !JSON.stringify(forgotten.data).includes('works-afternoons'))
  const failure = setup(true).tools
  assert.deepEqual(await failure('get_student_context', {}, students.ana), { ok: false, code: 'UNAVAILABLE' })
  assert.deepEqual(await failure('get_academic_progress', {}, students.ana), { ok: false, code: 'UNAVAILABLE' })
  await assert.rejects(bannerLambda({ version: 1, operation: 'listStudents', enrollment: students.ana.enrollment }), /INVALID_BANNER_REQUEST/)
})

test('the knowledge fallback still finds the expected source for every reference question offline', async () => {
  const questions = JSON.parse(readFileSync(new URL('../../../knowledge/golden-questions.json', import.meta.url), 'utf8')).questions as
    { question: string; language: 'es' | 'en'; expect: string }[]
  const knowledge = new KeywordRetriever(fileURLToPath(new URL('../../../knowledge', import.meta.url)))
  for (const input of questions) assert.ok(
    (await knowledge.retrieve(input.question, { language: input.language })).some(item => item.source === input.expect), input.question,
  )
})

test('gateway client negotiates MCP, signs the trusted context, and decodes JSON and SSE', async t => {
  const profile = process.env.AWS_PROFILE
  delete process.env.AWS_PROFILE
  t.after(() => { if (profile !== undefined) process.env.AWS_PROFILE = profile })
  for (const [key, value] of Object.entries({ AWS_ACCESS_KEY_ID: 'fixture-access', AWS_SECRET_ACCESS_KEY: 'fixture-signing-input', AWS_REGION: 'us-west-2' })) {
    const before = process.env[key]
    process.env[key] = value
    t.after(() => { if (before === undefined) delete process.env[key]; else process.env[key] = before })
  }
  const student = students.ana
  const seen: string[] = []
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    const request = JSON.parse(String(init.body))
    const headers = new Headers(init.headers)
    assert.ok(headers.get('authorization')?.includes('x-compass-student-context'))
    assert.ok(headers.get('authorization')?.includes('/us-east-1/bedrock-agentcore/aws4_request'))
    assert.equal(headers.get(STUDENT_CONTEXT_HEADER), encodeStudentContext(student))
    seen.push(request.method)
    const reply = (result: object, extra?: HeadersInit) => Response.json({ jsonrpc: '2.0', id: request.id, result }, { headers: extra })
    if (request.method === 'initialize') return reply({ protocolVersion: '2025-06-18', capabilities: { tools: {} } }, { 'Mcp-Session-Id': 'fixture' })
    assert.equal(headers.get('mcp-session-id'), 'fixture')
    assert.equal(headers.get('mcp-protocol-version'), '2025-06-18')
    if (request.method === 'notifications/initialized') return new Response(null, { status: 202 })
    if (request.method === 'tools/list') return reply({ tools: [{ name: 'compass___get_academic_progress' }] })
    const answer = { jsonrpc: '2.0', id: request.id, result: { content: [{ type: 'text', text: '{"ok":true,"data":{"progress":null}}' }] } }
    return new Response('event: message\ndata: ' + JSON.stringify(answer) + '\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
  })
  const client = gatewayMcpClient(student, 'https://fixture.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp')
  assert.deepEqual(await client.list(), ['compass___get_academic_progress'])
  assert.deepEqual(await client.call('get_academic_progress'), { ok: true, data: { progress: null } })
  assert.deepEqual(seen, ['initialize', 'notifications/initialized', 'tools/list', 'tools/call'])
})
