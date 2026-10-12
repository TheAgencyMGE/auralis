// Aqua: the default look. Tabs live down the left side as glossy "channel"
// pills (a Wii menu you can browse with), the address is a gel capsule at the
// top of the sidebar, round candy buttons sit along the bottom next to a
// clock, and the page shows on a rounded screen. Friendly, simple, bright.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type RefObject } from 'react'
import type { Settings } from '@shared/settings'
import type { BookmarkNode, TabState, WindowState } from '@shared/types'
import { bridge, call, rectOf } from '@ui/api'
import { Favicon, Icon } from '@ui/icons'
import { Orb } from '@ui/Orb'
import { FolderGlyph } from '@ui/FolderGlyph'
import { Omnibox, ProgressRing, ShieldButton } from './Toolbar'
import { FindBar, InfoBarRow, MiniPlayer, ViewportFurniture } from './Bars'

type SetAnchor = (key: string) => (el: HTMLElement | null) => void

export function AquaFrame({
  state,
  settings,
  active,
  immersive,
  viewportRef,
  setAnchor,
  sidePanel
}: {
  state: WindowState | null
  settings: Settings
  active: TabState | null
  immersive: boolean
  viewportRef: RefObject<HTMLDivElement | null>
  setAnchor: SetAnchor
  sidePanel: React.ReactNode
}) {
  // A compact sidebar opens up while the address field is in use.
  const [peek, setPeek] = useState(false)
  const reveal = () => {
    setPeek(true)
    // The address field mounts on the next frame; focus it then.
    requestAnimationFrame(() => requestAnimationFrame(() => (document.querySelector('.aq .omnibox-input') as HTMLInputElement | null)?.select()))
  }
  useEffect(() => bridge().on('omnibox.focus', (p) => (p as { reveal?: boolean } | null)?.reveal && reveal()), [])
  const compact = settings.sidebarCompact && !peek
  const cls = ['aq', state?.focused === false ? 'is-inactive' : '', state?.incognito ? 'is-private' : '', immersive ? 'is-immersive' : '', compact ? 'is-compact' : '', state?.busy ? 'is-busy' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cls}>
      {!immersive && (
        <aside
          className="aq-side"
          aria-label="Tabs and navigation"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPeek(false)
          }}
        >
          <div className="aq-side-top">
            <NavButtons active={active} compact={compact} />
            <button
              className="aq-icon-btn aq-collapse"
              title={settings.sidebarCompact ? 'Expand the sidebar' : 'Shrink the sidebar'}
              aria-label={settings.sidebarCompact ? 'Expand the sidebar' : 'Shrink the sidebar'}
              onClick={() => void call('settings.set', { sidebarCompact: !settings.sidebarCompact })}
            >
              <Icon name="sidebar" size={16} />
            </button>
          </div>
          {!compact && (
            <div className="aq-address">
              <Omnibox active={active} setAnchor={setAnchor} compact minDropWidth={560} />
            </div>
          )}
          {compact && (
            <button className="aq-icon-btn aq-search-btn" title="Search or enter address (Ctrl+L)" aria-label="Search or enter address" onClick={reveal}>
              <Icon name="search" size={18} />
            </button>
          )}
          <TabList state={state} settings={settings} compact={compact} />
          {!compact && settings.showBookmarksBar && <Favorites items={state?.bookmarksBar ?? []} />}
          <SideCards state={state} active={active} compact={compact} />
          <BottomBar compact={compact} setAnchor={setAnchor} />
        </aside>
      )}
      <div className="aq-main">
        {!immersive && <TopStrip state={state} active={active} settings={settings} setAnchor={setAnchor} />}
        {!immersive && state?.find.open && active && (
          <div className="aq-bubble-row">
            <FindBar find={state.find} />
          </div>
        )}
        {!immersive && state?.infobar && (
          <div className="aq-bubble-row">
            <InfoBarRow bar={state.infobar} />
          </div>
        )}
        <div className="aq-stage">
          <main className="viewport aq-screen" ref={viewportRef}>
            <ViewportFurniture state={state} active={active} viewportRef={viewportRef} />
          </main>
          {sidePanel}
        </div>
      </div>
    </div>
  )
}

// ---- navigation -------------------------------------------------------------------

function NavButtons({ active, compact }: { active: TabState | null; compact: boolean }) {
  const history = (dir: 'back' | 'forward', e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    void call('nav.historyMenu', dir, rectOf(e.currentTarget))
  }
  return (
    <div className="aq-nav">
      <button className="aq-gel" disabled={!active?.canGoBack} title="Back (Alt+Left)" aria-label="Back" onClick={() => void call('nav.back')} onContextMenu={(e) => history('back', e)}>
        <Icon name="back" size={16} />
      </button>
      {!compact && (
        <>
          <button className="aq-gel" disabled={!active?.canGoForward} title="Forward (Alt+Right)" aria-label="Forward" onClick={() => void call('nav.forward')} onContextMenu={(e) => history('forward', e)}>
            <Icon name="forward" size={16} />
          </button>
          <button
            className="aq-gel"
            title={active?.loading ? 'Stop (Esc)' : 'Refresh (F5)'}
            aria-label={active?.loading ? 'Stop' : 'Refresh'}
            onClick={(e) => void call(active?.loading ? 'nav.stop' : 'nav.reload', e.shiftKey || e.ctrlKey)}
          >
            <Icon name={active?.loading ? 'stop' : 'reload'} size={active?.loading ? 13 : 16} />
          </button>
        </>
      )}
    </div>
  )
}

// ---- tabs ---------------------------------------------------------------------------

interface Drag {
  id: number
  startY: number
  dy: number
  active: boolean
  from: number
}

const ROW = 40

function TabList({ state, settings, compact }: { state: WindowState | null; settings: Settings; compact: boolean }) {
  const tabs = state?.tabs ?? []
  const pinned = tabs.filter((t) => t.pinned)
  const rows = tabs.filter((t) => !t.pinned)
  const [drag, setDrag] = useState<Drag | null>(null)
  const previewTimer = useRef<number | null>(null)
  const previewOpen = useRef(false)
  const space = state?.spaces.find((s) => s.id === state.activeSpaceId)

  const hidePreview = () => {
    if (previewTimer.current) window.clearTimeout(previewTimer.current)
    previewTimer.current = null
    if (previewOpen.current) {
      previewOpen.current = false
      void call('tab.preview', null)
    }
  }
  const schedulePreview = (t: TabState, el: HTMLElement) => {
    if (!settings.tabPreviews || drag?.active || t.id === state?.activeTabId) return
    if (previewTimer.current) window.clearTimeout(previewTimer.current)
    const r = rectOf(el)
    // The preview opens beside the tab, over the page.
    const show = () => {
      previewOpen.current = true
      void call('tab.preview', t.id, { x: r.x + r.width + 6, y: r.y - 8, width: 0, height: 0 })
    }
    if (previewOpen.current) show()
    else previewTimer.current = window.setTimeout(show, 600)
  }
  useEffect(() => () => hidePreview(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const target = (d: Drag) => Math.max(0, Math.min(rows.length - 1, d.from + Math.round(d.dy / ROW)))
  const shift = (i: number) => {
    if (!drag?.active) return 0
    const to = target(drag)
    if (i === drag.from) return drag.dy
    if (drag.from < to && i > drag.from && i <= to) return -ROW
    if (drag.from > to && i < drag.from && i >= to) return ROW
    return 0
  }

  const handlers = (t: TabState, i: number) => ({
    onPointerDown: (e: RPointerEvent) => {
      if (e.button !== 0) return
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      setDrag({ id: t.id, startY: e.clientY, dy: 0, active: false, from: i })
    },
    onPointerMove: (e: RPointerEvent) => {
      if (!drag || drag.id !== t.id) return
      const dy = e.clientY - drag.startY
      if (!drag.active && Math.abs(dy) < 5) return
      if (!drag.active) hidePreview()
      setDrag({ ...drag, dy, active: true })
    },
    onPointerUp: () => {
      if (!drag || drag.id !== t.id) return
      if (drag.active) {
        const to = target(drag)
        if (to !== drag.from) void call('tab.move', t.id, to + pinned.length)
      } else void call('tab.activate', t.id)
      setDrag(null)
    }
  })

  return (
    <div className="aq-tabs" onPointerLeave={hidePreview}>
      {pinned.length > 0 && (
        <div className="aq-channels" role="tablist" aria-label="Pinned tabs">
          {pinned.map((t) => (
            <button
              key={t.id}
              className={`aq-channel${t.id === state?.activeTabId ? ' is-active' : ''}`}
              title={t.title}
              aria-label={t.title}
              onClick={() => void call('tab.activate', t.id)}
              onAuxClick={(e) => e.button === 1 && void call('tab.close', t.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                void call('tab.menu', t.id, { x: e.clientX, y: e.clientY, width: 0, height: 0 })
              }}
            >
              <TabIcon tab={t} size={22} />
            </button>
          ))}
        </div>
      )}
      {!compact && (
        <button className="aq-space" title="Spaces" onClick={(e) => void call('menu.spaces', rectOf(e.currentTarget))}>
          <span className={`aq-space-dot space-${space?.color ?? 'sky'}`} />
          <span className="aq-space-name">{space?.name ?? 'Home'}</span>
          <Icon name="chevron-down" size={10} />
        </button>
      )}
      <div className="aq-tablist" role="tablist" aria-label="Tabs" aria-orientation="vertical">
        {rows.map((t, i) => (
          <div
            key={t.id}
            className={[
              'aq-tab',
              t.id === state?.activeTabId ? 'is-active' : '',
              t.asleep ? 'is-asleep' : '',
              drag?.active && drag.id === t.id ? 'is-dragging' : '',
              state?.split && (state.split.left === t.id || state.split.right === t.id) ? 'is-split' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ translate: `0 ${shift(i)}px`, '--accent': t.accent ?? '#5fc4ff' } as CSSProperties}
            role="tab"
            aria-selected={t.id === state?.activeTabId}
            tabIndex={t.id === state?.activeTabId ? 0 : -1}
            title={compact ? t.title : undefined}
            {...handlers(t, i)}
            onMouseEnter={(e) => schedulePreview(t, e.currentTarget)}
            onMouseLeave={hidePreview}
            onAuxClick={(e) => e.button === 1 && void call('tab.close', t.id)}
            onMouseDown={(e) => e.button === 1 && e.preventDefault()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') void call('tab.activate', t.id)
              else if (e.key === 'Delete') void call('tab.close', t.id)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              hidePreview()
              void call('tab.menu', t.id, { x: e.clientX, y: e.clientY, width: 0, height: 0 })
            }}
          >
            <span className="aq-tab-icon">
              <TabIcon tab={t} size={16} />
            </span>
            {!compact && <span className="aq-tab-title">{t.title}</span>}
            {!compact && (t.audible || t.muted) && (
              <button
                className="aq-tab-btn"
                aria-label={t.muted ? 'Unmute tab' : 'Mute tab'}
                title={t.muted ? 'Unmute tab' : 'Mute tab'}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  void call('tab.toggleMute', t.id)
                }}
              >
                <Icon name={t.muted ? 'mute' : 'volume'} size={12} />
              </button>
            )}
            {!compact && (
              <button
                className="aq-tab-btn aq-tab-close"
                aria-label="Close tab"
                title="Close tab (Ctrl+W)"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  hidePreview()
                  void call('tab.close', t.id)
                }}
              >
                <Icon name="close" size={10} />
              </button>
            )}
          </div>
        ))}
        <button className="aq-newtab" title="New tab (Ctrl+T)" aria-label="New tab" onClick={() => void call('tab.new', {})}>
          <span className="aq-newtab-plus">
            <Icon name="plus" size={14} />
          </span>
          {!compact && <span>New tab</span>}
        </button>
      </div>
    </div>
  )
}

function TabIcon({ tab, size }: { tab: TabState; size: number }) {
  if (tab.crashed) return <Icon name="warning" size={size - 2} className="tab-warn" />
  if (tab.loading) return <span className="busy-ring" aria-label="Loading" />
  if (tab.security === 'internal') return <Orb size={size} />
  return <Favicon src={tab.favicon} dim={tab.asleep} size={size} />
}

// ---- favorites -------------------------------------------------------------------------

function Favorites({ items }: { items: BookmarkNode[] }) {
  const [open, setOpen] = useState(true)
  if (!items.length) return null
  return (
    <div className="aq-favs">
      <button className="aq-section" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={10} />
        Favorites
      </button>
      {open && (
        <div className="aq-fav-grid">
          {items.slice(0, 12).map((n) => (
            <button
              key={n.id}
              className="aq-fav"
              title={n.kind === 'url' ? `${n.title}\n${n.url}` : n.title}
              onClick={(e) =>
                n.kind === 'folder'
                  ? void call('menu.bookmarkFolder', n.id, rectOf(e.currentTarget))
                  : void call('bookmark.open', n.id, e.ctrlKey ? 'background' : 'current')
              }
              onAuxClick={(e) => e.button === 1 && n.kind === 'url' && void call('bookmark.open', n.id, 'background')}
              onContextMenu={(e) => {
                e.preventDefault()
                void call('menu.bookmarkItem', n.id, rectOf(e.currentTarget))
              }}
            >
              {n.kind === 'folder' ? <FolderGlyph size={20} /> : <Favicon src={n.favicon} size={20} />}
              <span>{n.title || n.url}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- cards at the foot of the sidebar ---------------------------------------------------

function SideCards({ state, active, compact }: { state: WindowState | null; active: TabState | null; compact: boolean }) {
  const player = active?.media ? active : (state?.tabs.find((t) => t.media?.playing) ?? null)
  if (compact || !player) return null
  return (
    <div className="aq-cards">
      <MiniPlayer tab={player} />
    </div>
  )
}

/** The Wii menu's bottom bar: a round button, the clock, another round button. */
function BottomBar({ compact, setAnchor }: { compact: boolean; setAnchor: SetAnchor }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(t)
  }, [])
  return (
    <div className="aq-bottom">
      <button ref={setAnchor('menu')} className="aq-orb" title="Auralis menu" aria-label="Auralis menu" onClick={(e) => void call('menu.app', rectOf(e.currentTarget))}>
        <Orb size={34} />
      </button>
      {!compact && (
        <div className="aq-clock" aria-label="Time">
          <span className="aq-time">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
          <span className="aq-date">{now.toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' })}</span>
        </div>
      )}
      {!compact && (
        <button className="aq-round" title="Settings (Ctrl+,)" aria-label="Settings" onClick={() => void call('tool.run', 'settings')}>
          <Icon name="settings" size={18} />
        </button>
      )}
    </div>
  )
}

// ---- the strip above the page -------------------------------------------------------------

function TopStrip({ state, active, settings, setAnchor }: { state: WindowState | null; active: TabState | null; settings: Settings; setAnchor: SetAnchor }) {
  const dl = state?.downloads
  const showDownloads = !!dl && (dl.active > 0 || dl.recent > 0)
  const text = state?.status || active?.title || 'Auralis'
  return (
    <header className="aq-top">
      <div className={`aq-title${state?.status ? ' is-status' : ''}`} title={text}>
        {text}
      </div>
      <div className="aq-tools">
        {state?.extensions.map((a) => (
          <button
            key={a.id}
            className="aq-icon-btn ext-btn"
            title={a.title}
            aria-label={a.title}
            onClick={(e) => void call('extensions.activate', a.id, rectOf(e.currentTarget))}
            onContextMenu={(e) => {
              e.preventDefault()
              void call('extensions.menu', a.id, rectOf(e.currentTarget))
            }}
          >
            {a.icon ? <img src={a.icon} width={16} height={16} alt="" /> : <Icon name="extensions" size={16} />}
            {a.badge && (
              <span className="badge" style={{ background: a.badgeColor }}>
                {a.badge.slice(0, 4)}
              </span>
            )}
          </button>
        ))}
        <ShieldButton active={active} settings={settings} />
        {showDownloads && (
          <button
            ref={setAnchor('downloads')}
            className="aq-icon-btn downloads-btn"
            title="Downloads"
            aria-label="Downloads"
            onClick={(e) => void call('menu.downloads', rectOf(e.currentTarget))}
          >
            <Icon name="download" size={17} />
            {dl!.active > 0 && <ProgressRing value={dl!.progress} />}
          </button>
        )}
        <button className={`aq-icon-btn${state?.split ? ' is-on' : ''}`} title="Split view (Ctrl+Shift+E)" aria-label="Split view" aria-pressed={!!state?.split} onClick={() => void call('tool.run', 'split-view')}>
          <Icon name="split" size={17} />
        </button>
        <button className="aq-icon-btn" title="Flip 3D (Ctrl+Shift+F)" aria-label="Flip 3D" onClick={() => void call('tool.run', 'flip-3d')}>
          <Icon name="flip" size={17} />
        </button>
        <button
          className={`aq-icon-btn${settings.sidebar ? ' is-on' : ''}`}
          title={settings.sidebar ? 'Hide gadgets' : 'Show gadgets'}
          aria-label="Gadgets"
          aria-pressed={settings.sidebar}
          onClick={() => void call('settings.set', { sidebar: !settings.sidebar })}
        >
          <Icon name="spaces" size={17} />
        </button>
      </div>
      <div className="aq-caption" role="group" aria-label="Window controls">
        <button className="aq-cap" title="Minimize" aria-label="Minimize" onClick={() => void call('window.minimize')}>
          <Icon name="minimize" size={12} />
        </button>
        <button className="aq-cap" title={state?.maximized ? 'Restore Down' : 'Maximize'} aria-label={state?.maximized ? 'Restore' : 'Maximize'} onClick={() => void call('window.toggleMaximize')}>
          <Icon name={state?.maximized ? 'restore' : 'maximize'} size={11} />
        </button>
        <button className="aq-cap aq-cap-close" title="Close" aria-label="Close window" onClick={() => void call('window.close')}>
          <Icon name="close" size={11} />
        </button>
      </div>
    </header>
  )
}
