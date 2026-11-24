import { Router } from 'express'
import { identityClaims } from '../auth/identity.js'
import { auditLogFor } from '../admin/audit.js'
import type { DocumentStore } from '../assistant/conversations/store.js'

export function adminRoutes(store?: DocumentStore) {
  const router = Router()
  router.use((request, response, next) => {
    const claims = identityClaims(request)
    const groups = Array.isArray(claims?.['cognito:groups']) ? claims['cognito:groups'].map(String) : []
    if (!groups.includes('admin') && claims?.['custom:role'] !== 'admin') { response.status(403).json({ code: 'FORBIDDEN', message: 'Se requiere el rol admin.' }); return }
    next()
  })
  router.get('/audit', async (_request, response) => response.set('Cache-Control', 'no-store').json({ records: await auditLogFor(store).list() }))
  return router
}
