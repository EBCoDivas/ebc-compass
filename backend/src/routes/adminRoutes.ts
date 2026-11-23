import { Router } from 'express'
import { identityClaims } from '../auth/identity.js'
import { listAudit } from '../admin/audit.js'
export function adminRoutes() {
  const router = Router()
  router.use((request, response, next) => {
    const claims = identityClaims(request)
    const groups = Array.isArray(claims?.['cognito:groups']) ? claims['cognito:groups'].map(String) : []
    if (!groups.includes('admin') && claims?.['custom:role'] !== 'admin') { response.status(403).json({ code: 'FORBIDDEN', message: 'Se requiere el rol admin.' }); return }
    next()
  })
  router.get('/audit', (_request, response) => response.json({ records: listAudit() }))
  return router
}
