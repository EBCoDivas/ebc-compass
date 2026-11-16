import { emptyProfile, type StudentProfile } from '../types/profile'

export const PROFILE_STORAGE_KEY = 'ebc_compass_profile'
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export function loadProfile(): StudentProfile | null {
  const stored = window.localStorage.getItem(PROFILE_STORAGE_KEY)
  if (!stored) return null

  try {
    const parsed = JSON.parse(stored) as Partial<StudentProfile>
    return {
      ...emptyProfile,
      ...parsed,
      campus: parsed.campus || 'CMS',
      career: parsed.career || 'banking',
      currentSemester: parsed.currentSemester || 2,
      interests: Array.isArray(parsed.interests) ? parsed.interests : [],
      preferences: Array.isArray(parsed.preferences) ? parsed.preferences : [],
    }
  } catch {
    return null
  }
}

export function saveProfile(profile: StudentProfile): void {
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
}

export async function saveProfileRemote(profile: StudentProfile): Promise<void> {
  const token = getToken()
  const response = await fetch(`${API_URL}/api/profiles`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(profile) })
  if (!response.ok) throw new Error('No fue posible sincronizar el perfil.')
}

export function profileCompleteness(profile: StudentProfile): number {
  const required = [profile.name.trim(), profile.campus, profile.career, profile.currentSemester]
  return Math.round((required.filter(Boolean).length / required.length) * 100)
}
import { getToken } from './authService'
