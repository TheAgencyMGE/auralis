// Remembered per-origin permission decisions.
import type { Db } from './db'

export type Decision = 'allow' | 'deny'

export class PermissionStore {
  constructor(private readonly db: Db) {}

  get(origin: string, permission: string): Decision | null {
    const r = this.db.prepare('SELECT decision FROM permissions WHERE origin = ? AND permission = ?').get(origin, permission) as
      | { decision: Decision }
      | undefined
    return r?.decision ?? null
  }

  set(origin: string, permission: string, decision: Decision): void {
    this.db
      .prepare(
        `INSERT INTO permissions (origin, permission, decision, updated) VALUES (?, ?, ?, ?)
         ON CONFLICT(origin, permission) DO UPDATE SET decision = excluded.decision, updated = excluded.updated`
      )
      .run(origin, permission, decision, Date.now())
  }

  forOrigin(origin: string): { permission: string; decision: Decision }[] {
    return this.db.prepare('SELECT permission, decision FROM permissions WHERE origin = ? ORDER BY permission').all(origin) as unknown as {
      permission: string
      decision: Decision
    }[]
  }

  all(): { origin: string; permission: string; decision: Decision; updated: number }[] {
    return this.db.prepare('SELECT origin, permission, decision, updated FROM permissions ORDER BY origin, permission').all() as unknown as {
      origin: string
      permission: string
      decision: Decision
      updated: number
    }[]
  }

  remove(origin: string, permission?: string): void {
    if (permission) this.db.prepare('DELETE FROM permissions WHERE origin = ? AND permission = ?').run(origin, permission)
    else this.db.prepare('DELETE FROM permissions WHERE origin = ?').run(origin)
  }

  clear(): void {
    this.db.exec('DELETE FROM permissions')
  }
}
