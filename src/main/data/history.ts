// Browsing history: visits, frecency ranking, full-text search (FTS5).
import type { Db } from './db'
import { transaction } from './db'
import type { HistoryEntry } from '../../shared/types'

const DAY = 86_400_000

interface UrlRow {
  id: number
  url: string
  title: string
  visit_count: number
  typed_count: number
  last_visit: number
}

/** Build a safe FTS5 prefix query: every token becomes "token"* (AND-ed). */
export function ftsQuery(text: string): string | null {
  const tokens = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 8)
  if (!tokens.length) return null
  return tokens.map((t) => `"${t.replace(/"/g, '')}"*`).join(' ')
}

export function frecency(r: Pick<UrlRow, 'visit_count' | 'typed_count' | 'last_visit'>, now = Date.now()): number {
  const days = Math.max(0, (now - r.last_visit) / DAY)
  const recency = days < 1 ? 1 : days < 4 ? 0.8 : days < 14 ? 0.55 : days < 31 ? 0.35 : days < 90 ? 0.18 : 0.08
  return (r.visit_count + r.typed_count * 2.5) * recency
}

const RECORDABLE = /^(https?|file):/i

export class HistoryStore {
  constructor(private readonly db: Db) {}

  addVisit(url: string, title: string, typed = false, now = Date.now()): void {
    if (!RECORDABLE.test(url) || url.length > 8192) return
    transaction(this.db, () => {
      this.db
        .prepare(
          `INSERT INTO urls (url, title, visit_count, typed_count, last_visit) VALUES (?, ?, 1, ?, ?)
           ON CONFLICT(url) DO UPDATE SET visit_count = visit_count + 1, typed_count = typed_count + excluded.typed_count,
             last_visit = excluded.last_visit, title = CASE WHEN excluded.title != '' THEN excluded.title ELSE title END`
        )
        .run(url, title.slice(0, 1024), typed ? 1 : 0, now)
      const { id } = this.db.prepare('SELECT id FROM urls WHERE url = ?').get(url) as { id: number }
      this.db.prepare('INSERT INTO visits (url_id, time, typed) VALUES (?, ?, ?)').run(id, now, typed ? 1 : 0)
    })
  }

  setTitle(url: string, title: string): void {
    if (!title) return
    this.db.prepare('UPDATE urls SET title = ? WHERE url = ?').run(title.slice(0, 1024), url)
  }

  /** History page: visits grouped by URL, newest first, optional full-text filter. */
  search(text: string, limit = 100, before = Number.MAX_SAFE_INTEGER): HistoryEntry[] {
    const q = ftsQuery(text)
    const rows = (
      q
        ? this.db
            .prepare(
              `SELECT u.* FROM urls_fts f JOIN urls u ON u.id = f.rowid
               WHERE urls_fts MATCH ? AND u.last_visit < ? AND u.visit_count > 0
               ORDER BY u.last_visit DESC LIMIT ?`
            )
            .all(q, before, limit)
        : this.db
            .prepare('SELECT * FROM urls WHERE last_visit < ? AND visit_count > 0 ORDER BY last_visit DESC LIMIT ?')
            .all(before, limit)
    ) as unknown as UrlRow[]
    return rows.map(toEntry)
  }

  /** Omnibox: best frecency matches for what the user is typing. */
  suggest(text: string, limit = 6): HistoryEntry[] {
    const q = ftsQuery(text)
    if (!q) return []
    const rows = this.db
      .prepare(
        `SELECT u.* FROM urls_fts f JOIN urls u ON u.id = f.rowid
         WHERE urls_fts MATCH ? AND u.visit_count > 0 ORDER BY u.last_visit DESC LIMIT 200`
      )
      .all(q) as unknown as UrlRow[]
    const needle = text.trim().toLowerCase()
    const now = Date.now()
    return rows
      .map((r) => {
        const bare = r.url.replace(/^https?:\/\/(www\.)?/i, '').toLowerCase()
        // Host-prefix matches are what the user almost always means.
        const boost = bare.startsWith(needle) ? 4 : r.title.toLowerCase().startsWith(needle) ? 1.6 : 1
        return { r, score: frecency(r, now) * boost }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ r }) => toEntry(r))
  }

  /** Best inline completion ("git" → "github.com/") among frequently typed hosts. */
  inlineCompletion(text: string): string | null {
    const needle = text.trim().toLowerCase()
    if (needle.length < 1 || /\s/.test(needle) || needle.includes('://')) return null
    const rows = this.db
      .prepare(
        `SELECT url, visit_count, typed_count, last_visit FROM urls
         WHERE (url LIKE ? OR url LIKE ? OR url LIKE ? OR url LIKE ?) AND visit_count > 0
         ORDER BY typed_count DESC, visit_count DESC LIMIT 40`
      )
      .all(`https://${needle}%`, `https://www.${needle}%`, `http://${needle}%`, `http://www.${needle}%`) as unknown as UrlRow[]
    let best: { host: string; score: number } | null = null
    for (const r of rows) {
      const host = r.url.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0].toLowerCase()
      if (!host.startsWith(needle)) continue
      const score = frecency(r)
      if (!best || score > best.score) best = { host, score }
    }
    return best ? best.host + '/' : null
  }

  topSites(limit = 8, hidden: Set<string> = this.hiddenTopSites()): HistoryEntry[] {
    const rows = this.db
      .prepare(`SELECT * FROM urls WHERE visit_count > 0 AND last_visit > ? ORDER BY visit_count DESC LIMIT 400`)
      .all(Date.now() - 120 * DAY) as unknown as UrlRow[]
    const byHost = new Map<string, { r: UrlRow; score: number }>()
    const now = Date.now()
    for (const r of rows) {
      let u: URL
      try {
        u = new URL(r.url)
      } catch {
        continue
      }
      if (!/^https?:$/.test(u.protocol)) continue
      // Search results and sign-in pages make poor tiles.
      if (/[?&](q|query|search_query)=/.test(u.search) || /\/(login|signin|oauth|auth)\b/i.test(u.pathname)) continue
      const host = u.hostname.replace(/^www\./, '')
      if (hidden.has(host)) continue
      const score = frecency(r, now) * (u.pathname === '/' ? 1.3 : 1)
      const prev = byHost.get(host)
      if (!prev) byHost.set(host, { r: { ...r, visit_count: r.visit_count }, score })
      else {
        prev.score += score
        if (u.pathname === '/' && new URL(prev.r.url).pathname !== '/') prev.r = r
      }
    }
    return [...byHost.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ r }) => toEntry(r))
  }

  hiddenTopSites(): Set<string> {
    const rows = this.db.prepare('SELECT url FROM hidden_top_sites').all() as { url: string }[]
    return new Set(rows.map((r) => r.url))
  }

  hideTopSite(host: string): void {
    this.db.prepare('INSERT OR IGNORE INTO hidden_top_sites (url) VALUES (?)').run(host)
  }

  remove(urls: string[]): void {
    transaction(this.db, () => {
      const del = this.db.prepare('DELETE FROM urls WHERE url = ?')
      for (const u of urls) del.run(u)
    })
  }

  removeSince(since: number): void {
    transaction(this.db, () => {
      this.db.prepare('DELETE FROM visits WHERE time >= ?').run(since)
      this.db.prepare('DELETE FROM urls WHERE id NOT IN (SELECT DISTINCT url_id FROM visits)').run()
      // Recount what survives so frecency stays honest.
      this.db
        .prepare(
          `UPDATE urls SET visit_count = (SELECT COUNT(*) FROM visits v WHERE v.url_id = urls.id),
             typed_count = (SELECT COUNT(*) FROM visits v WHERE v.url_id = urls.id AND v.typed = 1),
             last_visit = (SELECT MAX(time) FROM visits v WHERE v.url_id = urls.id)`
        )
        .run()
    })
  }

  clear(): void {
    transaction(this.db, () => {
      this.db.exec('DELETE FROM visits; DELETE FROM urls; DELETE FROM hidden_top_sites;')
    })
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM urls').get() as { n: number }).n
  }
}

function toEntry(r: UrlRow): HistoryEntry {
  return { id: r.id, url: r.url, title: r.title, lastVisit: r.last_visit, visitCount: r.visit_count }
}
