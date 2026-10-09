// Persisted download list (the live DownloadItems live in the download manager).
import type { Db } from './db'
import type { DownloadItemState } from '../../shared/types'

interface Row {
  id: string
  url: string
  filename: string
  path: string
  state: DownloadItemState['state']
  received: number
  total: number
  start_time: number
  end_time: number | null
}

export class DownloadStore {
  constructor(private readonly db: Db) {}

  upsert(d: DownloadItemState): void {
    this.db
      .prepare(
        `INSERT INTO downloads (id, url, filename, path, state, received, total, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET filename = excluded.filename, path = excluded.path, state = excluded.state,
           received = excluded.received, total = excluded.total, end_time = excluded.end_time`
      )
      .run(d.id, d.url, d.filename, d.path, d.state, d.received, d.total, d.startTime, d.endTime)
  }

  list(limit = 500): DownloadItemState[] {
    return (this.db.prepare('SELECT * FROM downloads ORDER BY start_time DESC LIMIT ?').all(limit) as unknown as Row[]).map((r) => ({
      id: r.id,
      url: r.url,
      filename: r.filename,
      path: r.path,
      // Anything still "in progress" from a previous run was cut off by the exit.
      state: r.state === 'progressing' || r.state === 'paused' ? 'interrupted' : r.state,
      received: r.received,
      total: r.total,
      speed: 0,
      startTime: r.start_time,
      endTime: r.end_time
    }))
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM downloads WHERE id = ?').run(id)
  }

  clearFinished(): void {
    this.db.exec("DELETE FROM downloads WHERE state IN ('completed', 'cancelled', 'interrupted')")
  }
}
