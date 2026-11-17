/** Contrato de lectura estable para HTTP y la futura herramienta MCP de Banner. */
export interface AcademicProgress {
  studentId: string
  source: 'demo' | 'banner'
  asOf: string
  program: { id: string; name: string }
  campus: { id: string; name: string }
  currentPeriod: { number: number; type: 'semestre' | 'periodo' | 'trimestre' }
  courses?: { completed: number; total: number }
  credits?: { earned: number; total: number }
  gpa?: { value: number; scale: number }
}
export interface AcademicProgressResponse { progress: AcademicProgress | null }
