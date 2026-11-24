import type { StudentContext } from '../planning/readStudentJourney.js'

export const STUDENT_CONTEXT_HEADER = 'x-compass-student-context'
export const MCP_VERSION = '2025-06-18'
export const TARGET_NAME = 'compass'
export const opportunityTypes = ['course', 'scholarship', 'professional-development', 'event', 'procedure', 'career-opportunity'] as const

export const toolList = [
  { name: 'get_student_context', description: 'Consulta etapa, ruta, pendientes y memoria del alumno autenticado.', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_requirements', description: 'Consulta requisitos de una oportunidad del catálogo del alumno.',
    inputSchema: { type: 'object', properties: { opportunityId: { type: 'string' } }, required: ['opportunityId'] } },
  { name: 'list_opportunities', description: 'Lista las oportunidades de la etapa, carrera y campus del alumno.',
    inputSchema: { type: 'object', properties: { type: { type: 'string', description: opportunityTypes.join(', ') } } } },
  { name: 'get_student_requests', description: 'Consulta las solicitudes del alumno autenticado (beca, pago de inscripción) con folio, estado y fechas.', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_academic_progress', description: 'Consulta el expediente académico de la cuenta autenticada.', inputSchema: { type: 'object', properties: {} } },
  { name: 'search_knowledge', description: 'Busca orientación general en los documentos de EBC, sin datos personales.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, language: { type: 'string', description: 'es o en' } }, required: ['query', 'language'] } },
] satisfies { name: string; description: string; inputSchema: {
  type: 'object'; properties: Record<string, { type: 'string'; description?: string }>; required?: string[]
} }[]
// Literal union shared by clients and the dispatcher.
export type ToolName = 'get_student_context' | 'get_requirements' | 'list_opportunities' | 'get_academic_progress' | 'get_student_requests' | 'search_knowledge'
export type ToolReply = { ok: true; data: object } | { ok: false; code: 'UNAUTHORIZED' | 'INVALID_INPUT' | 'NOT_FOUND' | 'UNAVAILABLE' }

export function asObject(input: unknown): Record<string, unknown> | undefined {
  return input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : undefined
}

export function encodeStudentContext(student: StudentContext): string {
  const { subject, enrollment, personaId, campus, career, semester } = student
  return Buffer.from(JSON.stringify({ subject, enrollment, personaId, campus, career, semester })).toString('base64url')
}

export function decodeStudentContext(value: unknown): StudentContext | undefined {
  if (typeof value !== 'string' || value.length > 512 || !/^[a-zA-Z0-9_-]+$/.test(value)) return undefined
  try {
    const raw = asObject(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')))
    if (!raw || typeof raw.subject !== 'string' || !/^[a-z0-9-]{1,128}$/i.test(raw.subject)) return undefined
    const fields = ['enrollment', 'personaId', 'career', 'campus'] as const
    for (const field of fields) if (raw[field] !== undefined && (typeof raw[field] !== 'string' ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(raw[field] as string))) return undefined
    if (raw.semester !== undefined && (typeof raw.semester !== 'number' || !Number.isInteger(raw.semester) ||
      raw.semester < 1 || raw.semester > 20)) return undefined
    if (Object.keys(raw).some(key => !['subject', ...fields, 'semester'].includes(key))) return undefined
    return raw as unknown as StudentContext
  } catch { return undefined }
}
