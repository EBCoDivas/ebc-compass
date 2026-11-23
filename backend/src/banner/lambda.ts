import { fixtureByEnrollment } from './fixtures.js'

export async function handler(event: unknown) {
  if (!event || typeof event !== 'object') throw new Error('INVALID_BANNER_REQUEST')
  const request = event as Record<string, unknown>
  if (request.version !== 1 || request.operation !== 'getStudentRecord' || typeof request.enrollment !== 'string' ||
      !/^M\d{7}$/.test(request.enrollment) || Object.keys(request).length !== 3) throw new Error('INVALID_BANNER_REQUEST')
  return { record: fixtureByEnrollment(request.enrollment) }
}
