export type Campus =
  | 'CMS'
  | 'GDL'
  | 'CNC'
  | 'QRO'
  | 'CHI'
  | 'PCH'

export type Career =
  | 'banking'
  | 'finance'
  | 'marketing'
  | 'business-administration'

export interface StudentProfile {
  id: string
  name: string
  campus: Campus | ''
  career: Career | ''
  currentSemester: number | 'na' | ''
  interests: string[]
  preferences: string[]
  updatedAt: string
}

export const emptyProfile: StudentProfile = {
  id: '',
  name: '',
  campus: '',
  career: '',
  currentSemester: '',
  interests: [],
  preferences: [],
  updatedAt: '',
}

export const simulatedAcademicData = {
  enrollment: 'M0100010',
  campus: 'Ciudad de México',
  fullName: 'Valerie Martínez',
  career: 'Banca y Finanzas',
  semester: '2° semestre',
}

export const campusOptions: { value: Campus; label: string }[] = [
  { value: 'CNC', label: 'Cancún' },
  { value: 'CMS', label: 'Ciudad de México Sur' },
  { value: 'CHI', label: 'Chiapas' },
  { value: 'GDL', label: 'Guadalajara' },
  { value: 'PCH', label: 'Pachuca' },
  { value: 'QRO', label: 'Querétaro' },
]

export const careerOptions: { value: Career; label: string }[] = [
  { value: 'banking', label: 'Banca y Finanzas' },
  { value: 'finance', label: 'Finanzas' },
  { value: 'marketing', label: 'Mercadotecnia' },
  { value: 'business-administration', label: 'Administración de Empresas' },
]
