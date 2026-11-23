// Catálogo académico público; ofertas y fechas de la demo se definen aparte.
export type AcademicLevel = 'licenciatura' | 'ejecutiva' | 'posgrado'
export const campuses = [
  {
    "value": "AGS",
    "label": "Aguascalientes"
  },
  {
    "value": "CNC",
    "label": "Cancún"
  },
  {
    "value": "CHI",
    "label": "Chiapas"
  },
  {
    "value": "CDMX",
    "label": "Ciudad de México"
  },
  {
    "value": "CMS",
    "label": "Ciudad de México Sur"
  },
  {
    "value": "GDL",
    "label": "Guadalajara"
  },
  {
    "value": "HMO",
    "label": "Hermosillo"
  },
  {
    "value": "LEO",
    "label": "León"
  },
  {
    "value": "MID",
    "label": "Mérida"
  },
  {
    "value": "PCH",
    "label": "Pachuca"
  },
  {
    "value": "QRO",
    "label": "Querétaro"
  },
  {
    "value": "SLP",
    "label": "San Luis Potosí"
  },
  {
    "value": "TLA",
    "label": "Tlalnepantla"
  },
  {
    "value": "TLC",
    "label": "Toluca"
  }
] as const
export const programs = [
  {
    "value": "business-administration",
    "label": "Administración de Negocios",
    "level": "licenciatura"
  },
  {
    "value": "communication-entertainment",
    "label": "Administración de Negocios de la Comunicación y el Entretenimiento",
    "level": "licenciatura"
  },
  {
    "value": "tourism",
    "label": "Administración de Negocios Turísticos",
    "level": "licenciatura"
  },
  {
    "value": "international-business",
    "label": "Comercio y Negocios Internacionales",
    "level": "licenciatura"
  },
  {
    "value": "accounting",
    "label": "Contaduría",
    "level": "licenciatura"
  },
  {
    "value": "law",
    "label": "Derecho",
    "level": "licenciatura"
  },
  {
    "value": "finance",
    "label": "Finanzas y Banca",
    "level": "licenciatura"
  },
  {
    "value": "marketing",
    "label": "Mercadotecnia",
    "level": "licenciatura"
  },
  {
    "value": "executive-administration",
    "label": "Licenciatura Ejecutiva en Administración y Comercialización",
    "level": "ejecutiva"
  },
  {
    "value": "executive-accounting",
    "label": "Licenciatura Ejecutiva en Contabilidad y Finanzas",
    "level": "ejecutiva"
  },
  {
    "value": "executive-business",
    "label": "Licenciatura Ejecutiva en Negocios",
    "level": "ejecutiva"
  },
  {
    "value": "digital-transformation",
    "label": "Licenciatura Ejecutiva en Programación y Transformación Digital",
    "level": "ejecutiva"
  },
  {
    "value": "senior-management",
    "label": "Maestría en Alta Dirección",
    "level": "posgrado"
  },
  {
    "value": "financial-management",
    "label": "Maestría en Dirección Financiera",
    "level": "posgrado"
  },
  {
    "value": "tax-specialty",
    "label": "Especialidad en Impuestos",
    "level": "posgrado"
  }
] as const
export const allCareers = [...programs.map(program => program.value), 'banking']
export const allCampuses = campuses.map(campus => campus.value)
export const allLevels: AcademicLevel[] = ['licenciatura', 'ejecutiva', 'posgrado']

export function levelForCareer(career: string | undefined): AcademicLevel | undefined {
  return career === 'banking' ? 'licenciatura' : programs.find(program => program.value === career)?.level
}

export function matchesAcademicScope(item: { campus?: readonly string[]; level?: readonly string[] }, profile: { campus?: string; career?: string; level?: string }) {
  const level = profile.level ?? levelForCareer(profile.career)
  return (!profile.campus || !item.campus || item.campus.includes(profile.campus)) &&
    (!level || !item.level || item.level.includes(level))
}
