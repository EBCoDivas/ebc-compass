import { Conflict, type DocumentStore } from '../assistant/conversations/store.js'
import type { StoredProactiveNotices } from './types.js'

const key = 'PROACTIVE#NOTICES'
const lockKey = 'PROACTIVE#LOCK'

interface GenerationLock { token: string; until: number; version: number }

export class ProactiveNoticeRepository {
  constructor(private readonly store: DocumentStore) {}
  async get(owner: string) { return await this.store.get(owner, key) as unknown as StoredProactiveNotices | undefined }
  async save(owner: string, value: Omit<StoredProactiveNotices, 'version'>) {
    const current = await this.get(owner)
    const next = { ...value, version: (current?.version ?? -1) + 1 }
    await this.store.write(owner, [{ key, value: next, version: current?.version }])
    return next
  }
  async acquire(owner: string, token: string, now = Date.now()) {
    const current = await this.store.get(owner, lockKey) as unknown as GenerationLock | undefined
    if (current && current.until > now) return false
    try {
      await this.store.write(owner, [{ key: lockKey, value: { token, until: now + 15_000, version: (current?.version ?? -1) + 1 }, version: current?.version }])
      return true
    } catch (error) {
      if (error instanceof Conflict) return false
      throw error
    }
  }
  async release(owner: string, token: string) {
    const current = await this.store.get(owner, lockKey) as unknown as GenerationLock | undefined
    if (!current || current.token !== token) return
    try { await this.store.write(owner, [{ key: lockKey, value: { ...current, until: 0, version: current.version + 1 }, version: current.version }]) }
    catch (error) { if (!(error instanceof Conflict)) throw error }
  }
}
