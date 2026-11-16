import { describe, expect, it } from 'vitest'
import { profileCompleteness } from './profileService'
import { emptyProfile } from '../types/profile'

describe('profileCompleteness', () => {
  it('uses the four required profile fields', () => {
    expect(profileCompleteness({ ...emptyProfile, name: 'Valerie', campus: 'CMS', career: 'banking', currentSemester: 2 })).toBe(100)
    expect(profileCompleteness({ ...emptyProfile, name: 'Valerie', campus: 'CMS' })).toBe(50)
  })
})
