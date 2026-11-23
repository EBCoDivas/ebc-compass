import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'
import { demoAcademicSnapshots, type BannerRecord } from './fixtures.js'

export interface AcademicStudent { id: string; personaId?: string; enrollment?: string; career?: string; campus?: string; semester?: number }
export interface BannerReader { readRecord(student: AcademicStudent): Promise<BannerRecord | null> }

export function matchesBannerStudent(record: BannerRecord, student: Omit<AcademicStudent, 'id'>): boolean {
  return record.personaId === student.personaId && record.career === student.career && record.campus === student.campus &&
    (!student.semester || record.currentPeriod.number === student.semester) &&
    (!student.enrollment || record.enrollment === student.enrollment)
}

export const fixedBanner: BannerReader = {
  async readRecord(student) {
    const record = student.personaId && Object.hasOwn(demoAcademicSnapshots, student.personaId) ? demoAcademicSnapshots[student.personaId] : null
    return record && matchesBannerStudent(record, student) ? structuredClone(record) : null
  },
}

export function createBannerReader(env = process.env, client?: Pick<LambdaClient, 'send'>): BannerReader {
  const functionName = env.BANNER_FUNCTION_NAME?.trim()
  if (!functionName) {
    if (env.APP_STAGE || env.MCP_TRANSPORT) throw new Error('Falta BANNER_FUNCTION_NAME.')
    return fixedBanner
  }
  const lambda = client ?? new LambdaClient({ maxAttempts: 1, requestHandler: { requestTimeout: 4000, throwOnRequestTimeout: true } })
  return {
    async readRecord(student) {
      if (!student.enrollment || !student.personaId) return null
      try {
        const result = await lambda.send(new InvokeCommand({
          FunctionName: functionName, InvocationType: 'RequestResponse',
          Payload: Buffer.from(JSON.stringify({ version: 1, operation: 'getStudentRecord', enrollment: student.enrollment })),
        }))
        if (result.FunctionError || !result.Payload || result.StatusCode !== 200) throw new Error()
        const { record } = JSON.parse(Buffer.from(result.Payload).toString('utf8')) as { record?: BannerRecord | null }
        if (record === null) return null
        if (!record || typeof record.asOf !== 'string' || !record.currentPeriod ||
          !Number.isInteger(record.currentPeriod.number)) throw new Error()
        return matchesBannerStudent(record, student) ? record : null
      } catch {
        throw new Error('BANNER_UNAVAILABLE')
      }
    },
  }
}
