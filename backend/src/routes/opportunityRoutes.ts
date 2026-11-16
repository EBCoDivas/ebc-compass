import { Router } from 'express'
import { opportunities } from '../data/opportunities.js'

export const opportunityRoutes = Router()

opportunityRoutes.get('/', (request, response) => {
  const type = typeof request.query.type === 'string' ? request.query.type : undefined
  const career = typeof request.query.career === 'string' ? request.query.career : undefined
  const semester = typeof request.query.semester === 'string' ? Number(request.query.semester) : undefined
  const search = typeof request.query.search === 'string' ? request.query.search.toLowerCase() : undefined
  const filtered = opportunities.filter((item) =>
    (!type || item.type === type) &&
    (!career || item.career.includes(career)) &&
    (!semester || !item.semester || item.semester.includes(semester)) &&
    (!search || `${item.title} ${item.description}`.toLowerCase().includes(search)),
  )
  response.json(filtered)
})

