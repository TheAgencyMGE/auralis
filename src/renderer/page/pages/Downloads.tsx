import { useEffect, useMemo, useState } from 'react'
import type { DownloadItemState } from '@shared/types'
import { bridge, call, formatBytes, relativeTime } from '@ui/api'
import { Icon } from '@ui/icons'
import { Shell } from '../Shell'

export default function Downloads() {
  const [items, setItems] = useState<DownloadItemState[] | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => {
    document.title = 'Downloads'
    void call<DownloadItemState[]>('downloads.list').then(setItems)
    return bridge().on('downloads', (d) => setItems(d as DownloadItemState[]))
  }, [])
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    return (items ?? []).filter((d) => !n || d.filename.toLowerCase().includes(n) || d.url.toLowerCase().includes(n))
  }, [items, q])
  const act = (id: string, a: string) => void call('downloads.action', id, a)
  const tools = (
    <>
      <div className="search-field">
        <Icon name="search" size={14} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search downloads" aria-label="Search downloads" />
      </div>
      <button className="btn" onClick={() => void call('downloads.clear')}>
        Clear list
      </button>
    </>
  )
  return (
    <Shell icon="download" title="Downloads" subtitle="Clearing the list keeps the files on your computer." tools={tools}>
      {items && shown.length === 0 && (
        <div className="cp-empty">
          <strong>{q ? 'No downloads match' : 'No downloads yet'}</strong>
          {q ? 'Try a different name.' : 'Files you download will be listed here.'}
        </div>
      )}
      <div className="list">
        {shown.map((d) => {
          const live = d.state === 'progressing' || d.state === 'paused'
          return (
            <div key={d.id} className="row sel" style={{ minHeight: 52, alignItems: 'center' }}>
              <Icon name="page" size={26} style={{ color: 'var(--aqua-deep)', flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <button className="row-title link-like" disabled={d.state !== 'completed'} onClick={() => act(d.id, 'open')} title={d.path} style={{ display: 'block', maxWidth: '100%' }}>
                  {d.filename}
                </button>
                <div className="row-sub" style={{ fontSize: 11 }}>
                  {live
                    ? `${d.state === 'paused' ? 'Paused, ' : ''}${formatBytes(d.received)}${d.total ? ` of ${formatBytes(d.total)}` : ''}${d.speed ? `, ${formatBytes(d.speed)}/s` : ''}`
                    : d.state === 'completed'
                      ? `${formatBytes(d.total || d.received)}, ${d.url.replace(/^https?:\/\//, '').split('/')[0]}`
                      : d.state === 'cancelled'
                        ? 'Canceled'
                        : 'Failed. The connection was interrupted.'}
                </div>
                {live && (
                  <div className="dl-bar-page">
                    <span style={{ width: `${d.total ? (d.received / d.total) * 100 : 0}%` }} />
                  </div>
                )}
              </div>
              <span className="row-time">{relativeTime(d.startTime)}</span>
              <span className="row-actions" style={{ opacity: 1 }}>
                {d.state === 'progressing' && <button className="btn" onClick={() => act(d.id, 'pause')}>Pause</button>}
                {d.state === 'paused' && <button className="btn" onClick={() => act(d.id, 'resume')}>Resume</button>}
                {live && <button className="btn" onClick={() => act(d.id, 'cancel')}>Cancel</button>}
                {d.state === 'interrupted' && <button className="btn" onClick={() => act(d.id, 'retry')}>Retry</button>}
                {d.state === 'completed' && (
                  <button className="icon-btn" title="Show in folder" aria-label="Show in folder" onClick={() => act(d.id, 'show')}>
                    <Icon name="folder" />
                  </button>
                )}
                <button className="icon-btn is-danger" title="Remove from list" aria-label="Remove from list" onClick={() => act(d.id, 'remove')}>
                  <Icon name="close" size={11} />
                </button>
              </span>
            </div>
          )
        })}
      </div>
    </Shell>
  )
}
