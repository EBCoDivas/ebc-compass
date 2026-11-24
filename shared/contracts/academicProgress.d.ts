/** Contrato de lectura estable para HTTP y la futura herramienta MCP de Banner. */
export interface AcademicProgress {
  studentId: string
  /** Datos personales del expediente en Banner. */
  student?: { enrollment: string; fullName: string }
  source: 'demo' | 'banner'
  asOf: string
  program: { id: string; name: string }
  campus: { id: string; name: string }
  currentPeriod: { number: number; type: 'semestre' | 'periodo' | 'trimestre' }
  courses?: { completed: number; total: number }
  /** Materias aprobadas, con su clave y el semestre en que se cursaron. */
  completedCourses?: { code: string; name: string; period: number }[]
  credits?: { earned: number; total: number }
  gpa?: { value: number; scale: number }
}
export interface AcademicProgressResponse { progress: AcademicProgress | null }
