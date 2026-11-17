// Verificación local, sin LLM: todas las personas recorren el grafo con su propio hilo.
import { readFileSync } from 'node:fs'
import { MemorySaver } from '@langchain/langgraph'
import { CatalogDates, InMemoryCatalog, ProfileRecommendations } from '../src/assistant/adapters/catalog.js'
import { buildAssistantGraph, runTurn } from '../src/assistant/graph/assistantGraph.js'
import { opportunities } from '../src/data/opportunities.js'
import { recommend } from '../src/data/recommendations.js'
import type { AssistantProfile } from '../src/assistant/types.js'
const personas = JSON.parse(readFileSync(new URL('../../shared/personas.json', import.meta.url), 'utf8')) as {
  id: string; studentId: string; name: string; campus: string; career: AssistantProfile['career'];
  period: number; interests: string[]; completedCourses: string[]; hasProfile: boolean
}[]
const catalog = new InMemoryCatalog()
const now = () => new Date('2026-11-16T12:00:00Z')
const graph = buildAssistantGraph({ catalog, recommendations: new ProfileRecommendations(catalog, now), dates: new CatalogDates(catalog), now }, new MemorySaver())
for (const persona of personas) {
  const profile: AssistantProfile | undefined = persona.hasProfile ? { name: persona.name, campus: persona.campus,
    career: persona.career, currentSemester: persona.period, interests: persona.interests, completedCourses: persona.completedCourses } : undefined
  const reply = await runTurn(graph, { threadId: persona.studentId, message: 'Hola', profile })
  if (reply.language !== 'es' || (persona.hasProfile && !reply.content.includes(persona.name))) throw new Error(persona.id + ': identidad incorrecta')
  if (profile) {
    const recommendations = recommend({ ...profile, semester: persona.period, today: now() })
    if (!recommendations.length || recommendations.some(item => !item.opportunity.career.includes(persona.career!))) throw new Error(persona.id + ': recomendaciones fuera de carrera')
    const courses = await runTurn(graph, { threadId: persona.studentId, message: '¿Qué cursos me recomiendas para mi carrera?', profile })
    if (courses.intent !== 'course-info') throw new Error(persona.id + ': intent de cursos')
    if (!courses.sources.some(source => opportunities.some(item => item.id === source.id && item.career.includes(persona.career!)))) throw new Error(persona.id + ': sin cursos adecuados')
  }
  console.log('✔ ' + persona.id + ': identidad, cursos y recomendaciones por alcance académico')
}
