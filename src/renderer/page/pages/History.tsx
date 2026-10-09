import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { HistoryEntry } from '@shared/types'
import { call } from '@ui/api'
import { Favicon, Icon } from '@ui/icons'
import { Shell } from '../Shell'

function dayLabel(t: number): string {
  const d = new Date(t)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

export default function History() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<HistoryEntry[] | null>(null)
  const [more, setMore] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmClear, setConfirmClear] = useState(false)
  const timer = useRef<number | null>(null)

  const load = useCallback((query: string, before?: number) => {
    void call<HistoryEntry[]>('history.search', query, before ?? null).then((r) => {
      setRows((prev) => (before && prev ? [...prev, ...r] : r))
      setMore(r.length >= 150)
    })
  }, [])

  useEffect(() => {
    document.title = 'History'
  }, [])
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => load(q), q ? 160 : 0)
    setSelected(new Set())
  }, [q, load])

  const groups = useMemo(() => {
    const out: { label: string; items: HistoryEntry[] }[] = []
    for (const r of rows ?? []) {
      const label = dayLabel(r.lastVisit)
      const g = out[out.length - 1]
      if (g?.label === label) g.items.push(r)
      else out.push({ label, items: [r] })
    }
    return out
  }, [rows])

  const remove = async (urls: string[]) => {
    await call('history.remove', urls)
    setRows((r) => r?.filter((x) => !urls.includes(x.url)) ?? null)
    setSelected(new Set())
  }

  const tools = (
    <>
      <div className="search-field">
        <Icon name="search" size={14} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search history" aria-label="Search history" autoFocus />
      </div>
      {selected.size > 0 ? (
        <button className="btn" onClick={() => void remove([...selected])}>
          Delete {selected.size} selected
        </button>
      ) : (
        <button className="btn" onClick={() => setConfirmClear(true)}>
          Clear history…
        </button>
      )}
    </>
  )

  return (
    <Shell icon="history" title="History" subtitle="Pages you’ve visited, newest first. InPrivate windows are never recorded." tools={tools}>
      {confirmClear && (
        <div className="cp-group">
          <div className="cp-row" style={{ background: '#fff8e5', border: '1px solid #f0d58a' }}>
            <Icon name="warning" />
            <span className="cp-row-text">Delete your entire browsing history? This can’t be undone.</span>
            <button className="btn" onClick={() => setConfirmClear(false)}>
              Cancel
            </button>
            <button
              className="btn is-danger"
              onClick={async () => {
                await call('history.clear', null)
                setRows([])
                setConfirmClear(false)
              }}
            >
              Delete all
            </button>
          </div>
        </div>
      )}
      {rows && rows.length === 0 && (
        <div className="cp-empty">
          <strong>{q ? `Nothing in your history matches “${q}”` : 'No history yet'}</strong>
          {q ? 'Try fewer or different words.' : 'Pages you visit will be listed here.'}
        </div>
      )}
      <div className="list">
        {groups.map((g) => (
          <section key={g.label}>
            <h2 className="list-day">{g.label}</h2>
            {g.items.map((r) => (
              <div key={r.url} className={`row sel${selected.has(r.url) ? ' is-selected' : ''}`}>
                <input
                  type="checkbox"
                  className="check"
                  aria-label={`Select ${r.title || r.url}`}
                  checked={selected.has(r.url)}
                  onChange={(e) => {
                    const next = new Set(selected)
                    if (e.target.checked) next.add(r.url)
                    else next.delete(r.url)
                    setSelected(next)
                  }}
                />
                <span className="row-time">{new Date(r.lastVisit).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                <Favicon src={r.favicon} />
                <a
                  className="row-title"
                  href={r.url}
                  onClick={(e) => {
                    e.preventDefault()
                    void call('nav.go', r.url, e.ctrlKey ? 'background' : 'current')
                  }}
                  onAuxClick={(e) => e.button === 1 && (e.preventDefault(), void call('nav.go', r.url, 'background'))}
                  title={r.url}
                >
                  {r.title || r.url}
                </a>
                <span className="row-sub">{r.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</span>
                <span className="row-actions">
                  <button className="icon-btn is-danger" title="Remove from history" aria-label="Remove from history" onClick={() => void remove([r.url])}>
                    <Icon name="trash" size={14} />
                  </button>
                </span>
              </div>
            ))}
          </section>
        ))}
        {more && rows && rows.length > 0 && (
          <div className="cp-footer" style={{ justifyContent: 'center', borderTop: 0 }}>
            <button className="btn" onClick={() => load(q, rows[rows.length - 1].lastVisit)}>
              Show older
            </button>
          </div>
        )}
      </div>
    </Shell>
  )
}
