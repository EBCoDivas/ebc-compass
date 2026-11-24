/** Plan de estudios que Banner simula: seis materias por semestre. Solo incluye los semestres que ya cursan las cuentas de demostración. */
const plan: Record<string, { prefix: string; semesters: string[][] }> = {
  accounting: { prefix: 'CON', semesters: [
    ['Fundamentos de contabilidad', 'Matemáticas financieras', 'Introducción al derecho', 'Economía', 'Informática aplicada', 'Comunicación profesional'],
    ['Contabilidad intermedia', 'Estadística descriptiva', 'Derecho mercantil', 'Microeconomía', 'Costos I', 'Administración'],
    ['Contabilidad avanzada', 'Estadística inferencial', 'Derecho laboral', 'Macroeconomía', 'Costos II', 'Finanzas corporativas I'],
    ['Contabilidad de sociedades', 'Impuestos I', 'Presupuestos', 'Análisis de datos para negocios', 'Finanzas corporativas II', 'Ética profesional'],
    ['Impuestos II', 'Auditoría I', 'Contabilidad gubernamental', 'Sistemas de información contable', 'Mercado de valores', 'Seguridad social'],
    ['Auditoría II', 'Impuestos III', 'Costos gerenciales', 'Contabilidad internacional (NIIF)', 'Control interno', 'Metodología de la investigación'],
  ] },
  marketing: { prefix: 'MER', semesters: [
    ['Fundamentos de mercadotecnia', 'Comunicación efectiva', 'Matemáticas para negocios', 'Introducción a la administración', 'Psicología del consumidor', 'Informática aplicada'],
    ['Comportamiento del consumidor', 'Investigación de mercados', 'Contabilidad básica', 'Estadística descriptiva', 'Redacción publicitaria', 'Economía'],
    ['Estrategia de marca', 'Marketing digital', 'Estadística inferencial', 'Derecho mercantil', 'Diseño gráfico aplicado', 'Ventas'],
    ['Publicidad y medios', 'Métricas de marketing', 'Mercadotecnia de servicios', 'Canales de distribución', 'Análisis de datos para negocios', 'Ética profesional'],
  ] },
  law: { prefix: 'DER', semesters: [
    ['Introducción al estudio del derecho', 'Teoría del Estado', 'Derecho romano', 'Metodología jurídica', 'Historia del derecho mexicano', 'Argumentación jurídica'],
    ['Derecho civil: personas', 'Derecho constitucional', 'Derecho penal: parte general', 'Sociología jurídica', 'Derecho internacional público', 'Redacción jurídica'],
    ['Derecho civil: bienes', 'Derechos humanos', 'Derecho penal: parte especial', 'Teoría general del proceso', 'Derecho administrativo I', 'Lógica jurídica'],
    ['Derecho civil: obligaciones', 'Derecho mercantil I', 'Derecho procesal civil', 'Derecho administrativo II', 'Derecho laboral I', 'Garantías individuales'],
    ['Derecho civil: contratos', 'Derecho mercantil II', 'Derecho procesal penal', 'Derecho laboral II', 'Derecho fiscal I', 'Amparo'],
    ['Derecho civil: sucesiones', 'Títulos y operaciones de crédito', 'Derecho procesal mercantil', 'Seguridad social', 'Derecho fiscal II', 'Derecho corporativo'],
    ['Derecho notarial y registral', 'Derecho agrario', 'Derecho ambiental', 'Medios alternativos de solución de controversias', 'Derecho de la propiedad intelectual', 'Litigación oral'],
    ['Derecho familiar', 'Derecho internacional privado', 'Derecho de la competencia', 'Práctica forense', 'Derecho electoral', 'Seminario de titulación I'],
  ] },
}

export interface CompletedCourse { code: string; name: string; period: number }

/** Las materias de los primeros `semesters` semestres de la carrera: lo que Banner registra como cursado. */
export function completedCourses(career: string, semesters: number): CompletedCourse[] {
  const curriculum = plan[career]
  if (!curriculum) return []
  return curriculum.semesters.slice(0, semesters).flatMap((names, index) =>
    names.map((name, position) => ({ code: `${curriculum.prefix}-${index + 1}${String(position + 1).padStart(2, '0')}`, name, period: index + 1 })))
}
