import { Router } from 'express'
import { identityClaims } from '../auth/identity.js'
import { auditLogFor } from '../admin/audit.js'
import type { DocumentStore } from '../assistant/conversations/store.js'

/** API Gateway REST entrega los grupos de Cognito como texto («[admin]» o «admin students»), no como arreglo. */
function groupsOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  return typeof value === 'string' ? value.replace(/^\[|\]$/g, '').split(/[\s,]+/).filter(Boolean) : []
}

export function adminRoutes(store?: DocumentStore) {
  const router = Router()
  router.use((request, response, next) => {
    const claims = identityClaims(request)
    const groups = groupsOf(claims?.['cognito:groups'])
    if (!groups.includes('admin') && claims?.['custom:role'] !== 'admin') { response.status(403).json({ code: 'FORBIDDEN', message: 'Se requiere el rol admin.' }); return }
    next()
  })
  router.get('/audit', async (_request, response) => response.set('Cache-Control', 'no-store').json({ records: await auditLogFor(store).list() }))
  return router
}
