import { sessionFetch, sessionSubject } from './session'
import { personaStorageKey, seedProfile } from './personaService'
import { emptyProfile, type StudentProfile } from '../types/profile'

export const PROFILE_STORAGE_KEY = 'ebc_compass_profile'
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const cache = new Map<string, StudentProfile>()

function cachedProfile(): StudentProfile | null {
  const key = personaStorageKey(PROFILE_STORAGE_KEY)
  if (cache.has(key)) return cache.get(key)!
  try {
    const stored = window.localStorage.getItem(key)
    if (!stored) return null
    const parsed = JSON.parse(stored) as Partial<StudentProfile>
    const subject = sessionSubject()
    if (subject && parsed.id !== subject) return null
    return { ...emptyProfile, ...parsed,
      interests: Array.isArray(parsed.interests) ? parsed.interests : [],
      preferences: Array.isArray(parsed.preferences) ? parsed.preferences : [],
      completedCourses: Array.isArray(parsed.completedCourses) ? parsed.completedCourses : [],
    }
  } catch { return null }
}

export function loadProfile(): StudentProfile | null {
  return cachedProfile() ?? seedProfile()
}

/** Caché de la cuenta actual. El guardado durable se confirma antes en saveProfileRemote. */
export function saveProfile(profile: StudentProfile): void {
  const key = personaStorageKey(PROFILE_STORAGE_KEY)
  cache.set(key, profile)
  try { window.localStorage.setItem(key, JSON.stringify(profile)) } catch { /* DynamoDB conserva el perfil. */ }
}

export async function saveProfileRemote(profile: StudentProfile, options: { completeOnboarding?: boolean } = {}): Promise<StudentProfile> {
  const subject = sessionSubject()
  if (!subject) throw new Error('Inicia sesión para guardar tu perfil.')
  const response = await sessionFetch(API_URL + '/api/profiles', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...profile, completeOnboarding: options.completeOnboarding }),
  })
  if (!response.ok) throw new Error('No se guardó tu perfil. Inténtalo de nuevo.')
  const saved = await response.json() as StudentProfile
  if (sessionSubject() !== subject || saved.id !== subject) throw new Error('La sesión cambió. Inicia sesión nuevamente.')
  saveProfile(saved)
  return saved
}

/** Se ejecuta antes de montar las pantallas que consumen el perfil. */
export async function synchronizeProfile(): Promise<void> {
  const subject = sessionSubject()
  if (!subject) return
  const response = await sessionFetch(API_URL + '/api/profiles')
  if (!response.ok) throw new Error('No fue posible cargar tu perfil.')
  const profiles = await response.json() as StudentProfile[]
  if (sessionSubject() !== subject) return
  if (!Array.isArray(profiles) || profiles.length > 1 || profiles.some(profile => profile.id !== subject)) throw new Error('La respuesta del perfil no es válida.')
  if (profiles[0]) {
    saveProfile({ ...emptyProfile, ...profiles[0] })
  } else {
    // Migra ajustes previamente guardados en este navegador para la misma cuenta.
    const previous = cachedProfile()
    if (previous?.id === subject) await saveProfileRemote(previous)
    // Las personas sin personalización durable conservan su perfil demo inicial.
  }
}

export function profileCompleteness(profile: StudentProfile): number {
  const required = [profile.name.trim(), profile.campus, profile.career, profile.currentSemester]
  return Math.round((required.filter(Boolean).length / required.length) * 100)
}

/** Los datos académicos precargados no confirman la configuración personal. */
export function needsProfileSetup(profile: StudentProfile | null): boolean {
  return !profile?.onboardingCompletedAt
}
