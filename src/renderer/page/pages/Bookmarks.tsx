import { useEffect, useMemo, useState } from 'react'
import type { BookmarkNode } from '@shared/types'
import { call } from '@ui/api'
import { Favicon, Icon } from '@ui/icons'
import { Shell } from '../Shell'
import { FolderGlyph } from '@ui/FolderGlyph'

interface Tree {
  tree: BookmarkNode[]
  icons: Record<string, string | null>
}

function findNode(nodes: BookmarkNode[], id: number): BookmarkNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const hit = n.children ? findNode(n.children, id) : null
    if (hit) return hit
  }
  return null
}

function flatten(nodes: BookmarkNode[], out: BookmarkNode[] = []): BookmarkNode[] {
  for (const n of nodes) {
    if (n.kind === 'url') out.push(n)
    if (n.children) flatten(n.children, out)
  }
  return out
}

export default function Bookmarks() {
  const [data, setData] = useState<Tree | null>(null)
  const [folder, setFolder] = useState(1)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<number | null>(() => Number(new URLSearchParams(location.search).get('edit')) || null)
  const [dragId, setDragId] = useState<number | null>(null)
  const load = () => void call<Tree>('bookmarks.tree').then(setData)
  useEffect(() => {
    document.title = 'Favorites'
    load()
  }, [])
  useEffect(() => {
    // Opened with ?edit=<id>: show that favorite's folder.
    if (!data || !editing) return
    const n = findNode(data.tree, editing)
    if (n?.parentId) setFolder(n.parentId)
  }, [data, editing])

  const current = data ? findNode(data.tree, folder) : null
  const items = useMemo(() => {
    if (!data) return []
    if (q.trim()) {
      const n = q.toLowerCase()
      return flatten(data.tree).filter((b) => b.title.toLowerCase().includes(n) || (b.url ?? '').toLowerCase().includes(n))
    }
    return current?.children ?? []
  }, [data, current, q])

  const pane = data && (
    <nav className="cp-nav" aria-label="Folders">
      <FolderTree nodes={data.tree} depth={0} current={folder} onPick={(id) => (setFolder(id), setQ(''))} onDrop={(id) => dragId && void call('bookmarks.move', dragId, id, 1e9).then(load)} />
    </nav>
  )

  const tools = (
    <>
      <div className="search-field">
        <Icon name="search" size={14} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search favorites" aria-label="Search favorites" />
      </div>
      <button className="btn" onClick={() => void call<BookmarkNode>('bookmarks.create', { parentId: folder, kind: 'folder', title: 'New folder' }).then((n) => (load(), setEditing(n.id)))}>
        New folder
      </button>
    </>
  )

  return (
    <Shell icon="star" title="Favorites" subtitle={q ? `Results for “${q}”` : current?.title} pane={pane} tools={tools}>
      {data && items.length === 0 && (
        <div className="cp-empty">
          <strong>{q ? 'No favorites match' : 'This folder is empty'}</strong>
          {q ? 'Try a different word.' : 'Press Ctrl+D on any page to add it, or drag favorites here.'}
        </div>
      )}
      <div className="list">
        {items.map((n, i) => (
          <div
            key={n.id}
            className={`row sel${dragId === n.id ? ' is-selected' : ''}`}
            draggable={!q}
            onDragStart={() => setDragId(n.id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => dragId && dragId !== n.id && e.preventDefault()}
            onDrop={() => {
              if (dragId && dragId !== n.id) void call('bookmarks.move', dragId, n.kind === 'folder' ? n.id : folder, n.kind === 'folder' ? 1e9 : i).then(load)
            }}
          >
            {editing === n.id ? (
              <EditRow node={n} onDone={() => (setEditing(null), load())} />
            ) : (
              <>
                {n.kind === 'folder' ? <FolderGlyph /> : <Favicon src={data?.icons[n.url!]} />}
                <button
                  className="row-title link-like"
                  onClick={(e) => (n.kind === 'folder' ? setFolder(n.id) : void call('nav.go', n.url!, e.ctrlKey ? 'background' : 'current'))}
                  onAuxClick={(e) => e.button === 1 && n.url && void call('nav.go', n.url, 'background')}
                  title={n.url ?? n.title}
                >
                  {n.title || n.url}
                </button>
                <span className="row-sub">{n.kind === 'url' ? n.url!.replace(/^https?:\/\/(www\.)?/, '') : `${n.children?.length ?? 0} items`}</span>
                <span className="row-actions">
                  <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => setEditing(n.id)}>
                    <Icon name="edit" size={13} />
                  </button>
                  <button className="icon-btn is-danger" title="Delete" aria-label="Delete" onClick={() => void call('bookmarks.remove', n.id).then(load)}>
                    <Icon name="trash" size={14} />
                  </button>
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </Shell>
  )
}

function FolderTree({ nodes, depth, current, onPick, onDrop }: { nodes: BookmarkNode[]; depth: number; current: number; onPick: (id: number) => void; onDrop: (id: number) => void }) {
  return (
    <>
      {nodes
        .filter((n) => n.kind === 'folder')
        .map((n) => (
          <div key={n.id}>
            <a
              href="#"
              className={n.id === current ? 'is-on' : ''}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={(e) => (e.preventDefault(), onPick(n.id))}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => (e.preventDefault(), onDrop(n.id))}
            >
              <FolderGlyph />
              {n.title}
            </a>
            {n.children && <FolderTree nodes={n.children} depth={depth + 1} current={current} onPick={onPick} onDrop={onDrop} />}
          </div>
        ))}
    </>
  )
}

function EditRow({ node, onDone }: { node: BookmarkNode; onDone: () => void }) {
  const [title, setTitle] = useState(node.title)
  const [url, setUrl] = useState(node.url ?? '')
  const [err, setErr] = useState('')
  const save = async () => {
    try {
      await call('bookmarks.update', node.id, node.kind === 'url' ? { title, url } : { title })
      onDone()
    } catch {
      setErr('That address isn’t valid.')
    }
  }
  return (
    <form
      style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, padding: '4px 0' }}
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <input className="field" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Name" style={{ width: 240 }} />
      {node.kind === 'url' && <input className="field" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Address" style={{ flex: 1 }} />}
      {err && <span style={{ color: 'var(--alert)' }}>{err}</span>}
      <button type="button" className="btn" onClick={onDone}>
        Cancel
      </button>
      <button type="submit" className="btn is-default">
        Save
      </button>
    </form>
  )
}
