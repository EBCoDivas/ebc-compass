import { emptyProfile, type StudentProfile } from '../types/profile'

export const PROFILE_STORAGE_KEY = 'ebc_compass_profile'

export function loadProfile(): StudentProfile | null {
  const stored = window.localStorage.getItem(PROFILE_STORAGE_KEY)
  if (!stored) return null

  try {
    const parsed = JSON.parse(stored) as Partial<StudentProfile>
    return {
      ...emptyProfile,
      ...parsed,
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

export function profileCompleteness(profile: StudentProfile): number {
  const required = [profile.name.trim(), profile.interests?.length, profile.preferences?.length]
  return Math.round((required.filter(Boolean).length / required.length) * 100)
}
