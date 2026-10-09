// Favicon cache keyed by host. Icons are stored as data: URLs so renderers
// never fetch remote images themselves.
import type { Db } from './db'

export class FaviconStore {
  private mem = new Map<string, { data: string; accent: string | null }>()
  constructor(private readonly db: Db) {}

  get(host: string): { data: string; accent: string | null } | null {
    if (!host) return null
    const hit = this.mem.get(host)
    if (hit) return hit
    const r = this.db.prepare('SELECT data, accent FROM favicons WHERE host = ?').get(host) as { data: string; accent: string | null } | undefined
    if (r) this.mem.set(host, r)
    return r ?? null
  }

  set(host: string, data: string, accent: string | null): void {
    if (!host || data.length > 200_000) return
    this.mem.set(host, { data, accent })
    this.db
      .prepare(
        `INSERT INTO favicons (host, data, accent, updated) VALUES (?, ?, ?, ?)
         ON CONFLICT(host) DO UPDATE SET data = excluded.data, accent = excluded.accent, updated = excluded.updated`
      )
      .run(host, data, accent, Date.now())
  }

  clear(): void {
    this.mem.clear()
    this.db.exec('DELETE FROM favicons')
  }
}
