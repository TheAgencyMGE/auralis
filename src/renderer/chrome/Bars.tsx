import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { BookmarkNode, FindState, TabState, WindowState } from '@shared/types'
import { call, bridge, rectOf } from '@ui/api'
import { Favicon, Icon } from '@ui/icons'
import { FolderGlyph } from '@ui/FolderGlyph'

// ---- caption buttons (Vista: hung from the top edge, red Close) -----------------

export function CaptionButtons({ maximized }: { maximized: boolean }) {
  return (
    <div className="caption" role="group" aria-label="Window controls">
      <button className="cap cap-min" title="Minimize" aria-label="Minimize" onClick={() => void call('window.minimize')}>
        <Icon name="minimize" size={14} />
      </button>
      <button className="cap cap-max" title={maximized ? 'Restore Down' : 'Maximize'} aria-label={maximized ? 'Restore' : 'Maximize'} onClick={() => void call('window.toggleMaximize')}>
        <Icon name={maximized ? 'restore' : 'maximize'} size={12} />
      </button>
      <button className="cap cap-close" title="Close" aria-label="Close window" onClick={() => void call('window.close')}>
        <Icon name="close" size={13} />
      </button>
    </div>
  )
}

// ---- Favorites bar (styled as Vista's command bar) ---------------------------------

export function FavoritesBar({ items }: { items: BookmarkNode[] }) {
  const barRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(items.length)
  const [dragId, setDragId] = useState<number | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)

  // Fit as many items as the width allows; the rest go behind the chevron.
  useLayoutEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const fit = () => {
      const kids = [...bar.querySelectorAll<HTMLElement>('.fav-item')]
      const limit = bar.clientWidth - 34
      let used = 0
      let n = 0
      for (const k of kids) {
        used += k.offsetWidth + 2
        if (used > limit) break
        n++
      }
      setVisible(n)
    }
    setVisible(items.length)
    requestAnimationFrame(fit)
    const ro = new ResizeObserver(fit)
    ro.observe(bar)
    return () => ro.disconnect()
  }, [items])

  const open = (n: BookmarkNode, e: React.MouseEvent<HTMLElement>) => {
    if (n.kind === 'folder') return void call('menu.bookmarkFolder', n.id, rectOf(e.currentTarget))
    const disposition = e.button === 1 || e.ctrlKey ? 'background' : e.shiftKey ? 'window' : 'current'
    void call('bookmark.open', n.id, disposition)
  }

  return (
    <nav
      className="favbar"
      ref={barRef}
      aria-label="Favorites bar"
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest('.fav-item')) return
        e.preventDefault()
        void call('menu.chrome', { x: e.clientX, y: e.clientY, width: 0, height: 0 })
      }}
    >
      <Icon name="star" size={14} className="favbar-star" />
      {items.length === 0 && <span className="favbar-empty">Press Ctrl+D to add the current page here</span>}
      {items.map((n, i) => (
        <button
          key={n.id}
          className={`fav-item${i >= visible ? ' is-overflow' : ''}${dropAt === i && dragId !== n.id ? ' is-drop' : ''}`}
          title={n.kind === 'url' ? `${n.title}\n${n.url}` : n.title}
          draggable
          onDragStart={(e) => {
            setDragId(n.id)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragOver={(e) => {
            if (dragId == null) return
            e.preventDefault()
            setDropAt(i)
          }}
          onDragEnd={() => {
            setDragId(null)
            setDropAt(null)
          }}
          onDrop={(e) => {
            e.preventDefault()
            if (dragId != null && dragId !== n.id) void call('bookmark.move', dragId, i)
            setDragId(null)
            setDropAt(null)
          }}
          onClick={(e) => open(n, e)}
          onAuxClick={(e) => e.button === 1 && open(n, e)}
          onContextMenu={(e) => {
            e.preventDefault()
            void call('menu.bookmarkItem', n.id, rectOf(e.currentTarget))
          }}
        >
          {n.kind === 'folder' ? <FolderGlyph /> : <Favicon src={n.favicon} size={16} />}
          <span>{n.title || n.url}</span>
          {n.kind === 'folder' && <Icon name="chevron-down" size={10} className="fav-chev" />}
        </button>
      ))}
      {visible < items.length && (
        <button className="fav-more" title="More favorites" aria-label="More favorites" onClick={(e) => void call('menu.bookmarkFolder', 1, rectOf(e.currentTarget))}>
          <Icon name="chevron-right" size={12} />
          <Icon name="chevron-right" size={12} style={{ marginLeft: -8 }} />
        </button>
      )}
    </nav>
  )
}

// ---- find bar --------------------------------------------------------------------------

export function FindBar({ find }: { find: FindState }) {
  const ref = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(find.text)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
    return bridge().on('find.focus', () => {
      ref.current?.focus()
      ref.current?.select()
    })
  }, [])
  const query = (t: string, forward = true) => void call('find.query', t, forward)
  return (
    <div className="findbar" role="search">
      <Icon name="find" size={14} className="findbar-icon" />
      <input
        ref={ref}
        className="field findbar-input"
        value={text}
        aria-label="Find on page"
        placeholder="Find on page"
        onChange={(e) => {
          setText(e.target.value)
          query(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') query(text, !e.shiftKey)
          else if (e.key === 'Escape') void call('find.close')
        }}
      />
      <span className={`findbar-count${text && find.matches === 0 ? ' is-none' : ''}`} aria-live="polite">
        {text ? (find.matches ? `${find.active} of ${find.matches}` : 'No matches') : ''}
      </span>
      <button className="glass-btn small" title="Previous (Shift+Enter)" aria-label="Previous match" onClick={() => query(text, false)}>
        <Icon name="chevron-left" size={14} style={{ transform: 'rotate(90deg)' }} />
      </button>
      <button className="glass-btn small" title="Next (Enter)" aria-label="Next match" onClick={() => query(text, true)}>
        <Icon name="chevron-down" size={14} />
      </button>
      <button className="glass-btn small" title="Close (Esc)" aria-label="Close find bar" onClick={() => void call('find.close')}>
        <Icon name="close" size={11} />
      </button>
    </div>
  )
}

// ---- status bar --------------------------------------------------------------------------

export function StatusBar({ state, active }: { state: WindowState | null; active: TabState | null }) {
  const sleeping = state?.tabs.filter((t) => t.asleep).length ?? 0
  const status = state?.status || (active?.loading ? 'Loading…' : active?.crashed ? 'This tab stopped working' : 'Done')
  return (
    <footer className="statusbar glow-text">
      <span className="status-text">{status}</span>
      <span className="status-cells">
        {state?.incognito && (
          <span className="status-cell private-cell">
            <Icon name="private" size={14} /> InPrivate
          </span>
        )}
        {sleeping > 0 && (
          <span className="status-cell" title="Sleeping tabs free memory until you return to them">
            <Icon name="sleep" size={12} /> {sleeping} asleep
          </span>
        )}
        {active?.shieldActive && active.blocked > 0 && (
          <span className="status-cell">
            <Icon name="shield" size={12} /> {active.blocked} blocked
          </span>
        )}
        {active && Math.abs(active.zoom - 1) > 0.001 && (
          <button className="status-cell" title="Reset zoom (Ctrl+0)" onClick={() => void call('zoom.adjust', 0)}>
            <Icon name="zoom-in" size={12} /> {Math.round(active.zoom * 100)}%
          </button>
        )}
      </span>
    </footer>
  )
}

// ---- inside the viewport: split divider and the crashed-tab panel -----------------------------

export function ViewportFurniture({ state, active, viewportRef }: { state: WindowState | null; active: TabState | null; viewportRef: RefObject<HTMLDivElement | null> }) {
  const split = state?.split
  const [dragging, setDragging] = useState(false)
  if (active?.crashed && !split) {
    return (
      <div className="crash-panel" role="alert">
        <div className="crash-card">
          <Icon name="warning" size={34} className="crash-icon" />
          <div>
            <h1>This tab stopped working</h1>
            <p>Something on “{active.title || active.url}” made the page close unexpectedly. Your other tabs are fine.</p>
            <div className="crash-actions">
              <button className="btn is-default" onClick={() => void call('nav.reload')}>
                Reload page
              </button>
              <button className="btn" onClick={() => void call('tab.close', active.id)}>
                Close tab
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
  if (!split) return null
  const ratio = split.ratio
  const onDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!dragging) return
    const r = viewportRef.current!.getBoundingClientRect()
    void call('split.setRatio', (e.clientX - r.left) / r.width)
  }
  return (
    <div
      className={`split-divider${dragging ? ' is-dragging' : ''}`}
      style={{ left: `calc((100% - 8px) * ${ratio})` }}
      title="Drag to resize. Double-click to split evenly"
      onDoubleClick={() => void call('split.setRatio', 0.5)}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={() => setDragging(false)}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize split view"
    >
      <span className="split-grip" />
    </div>
  )
}
