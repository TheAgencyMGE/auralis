import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import type { Settings } from '@shared/settings'
import type { TabState, WindowState } from '@shared/types'
import { call, rectOf } from '@ui/api'
import { Favicon, Icon } from '@ui/icons'
import { Orb } from '@ui/Orb'

const MAX_W = 224
const MIN_W = 44
const PINNED_W = 40

interface Drag {
  id: number
  startX: number
  dx: number
  active: boolean
  fromIndex: number
  widths: number[]
}

export function TabStrip({ state, settings, menuAnchor }: { state: WindowState | null; settings: Settings; menuAnchor: (el: HTMLElement | null) => void }) {
  const stripRef = useRef<HTMLDivElement>(null)
  const [stripW, setStripW] = useState(800)
  const [drag, setDrag] = useState<Drag | null>(null)
  const previewTimer = useRef<number | null>(null)
  const previewOpen = useRef(false)
  const tabs = state?.tabs ?? []
  const space = state?.spaces.find((s) => s.id === state.activeSpaceId)

  useLayoutEffect(() => {
    const el = stripRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setStripW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Tabs share the strip width; pinned tabs are icon-only.
  const pinned = tabs.filter((t) => t.pinned).length
  const free = Math.max(0, stripW - 34 - pinned * PINNED_W)
  const each = Math.max(MIN_W, Math.min(MAX_W, Math.floor(free / Math.max(1, tabs.length - pinned))))
  const widthOf = (t: TabState) => (t.pinned ? PINNED_W : each)

  const hidePreview = (immediate = false) => {
    if (previewTimer.current) window.clearTimeout(previewTimer.current)
    previewTimer.current = null
    if (!previewOpen.current) return
    const close = () => {
      previewOpen.current = false
      void call('tab.preview', null)
    }
    if (immediate) close()
    else previewTimer.current = window.setTimeout(close, 120)
  }

  const schedulePreview = (t: TabState, el: HTMLElement) => {
    if (!settings.tabPreviews || drag?.active) return
    if (previewTimer.current) window.clearTimeout(previewTimer.current)
    const show = () => {
      previewOpen.current = true
      void call('tab.preview', t.id, rectOf(el))
    }
    // Once one preview is showing, moving along the strip swaps instantly.
    if (previewOpen.current) show()
    else previewTimer.current = window.setTimeout(show, 520)
  }

  useEffect(() => () => hidePreview(true), []) // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = (e: RPointerEvent, t: TabState, index: number) => {
    if (e.button !== 0) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({ id: t.id, startX: e.clientX, dx: 0, active: false, fromIndex: index, widths: tabs.map(widthOf) })
  }

  const onPointerMove = (e: RPointerEvent) => {
    if (!drag) return
    const dx = e.clientX - drag.startX
    if (!drag.active && Math.abs(dx) < 5) return
    if (!drag.active) hidePreview(true)
    setDrag({ ...drag, dx, active: true })
  }

  const targetIndex = (d: Drag): number => {
    // Walk neighbour midpoints in the drag direction.
    let idx = d.fromIndex
    let travel = d.dx
    if (travel > 0) {
      while (idx < tabs.length - 1 && travel > d.widths[idx + 1] / 2) {
        travel -= d.widths[idx + 1]
        idx++
      }
    } else {
      while (idx > 0 && -travel > d.widths[idx - 1] / 2) {
        travel += d.widths[idx - 1]
        idx--
      }
    }
    return idx
  }

  const onPointerUp = (t: TabState) => {
    if (!drag) return
    if (drag.active) {
      const to = targetIndex(drag)
      if (to !== drag.fromIndex) void call('tab.move', t.id, to)
    } else void call('tab.activate', t.id)
    setDrag(null)
  }

  const shiftFor = (index: number): number => {
    if (!drag?.active) return 0
    const to = targetIndex(drag)
    const w = drag.widths[drag.fromIndex]
    if (index === drag.fromIndex) return drag.dx
    if (drag.fromIndex < to && index > drag.fromIndex && index <= to) return -w
    if (drag.fromIndex > to && index < drag.fromIndex && index >= to) return w
    return 0
  }

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const move = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (move) {
      e.preventDefault()
      const next = tabs[(i + move + tabs.length) % tabs.length]
      ;(stripRef.current?.querySelector(`[data-tab="${next.id}"]`) as HTMLElement | null)?.focus()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      void call('tab.activate', tabs[i].id)
    } else if (e.key === 'Delete') void call('tab.close', tabs[i].id)
  }

  return (
    <div className="tabrow">
      <button
        ref={menuAnchor}
        className="orb-button"
        title="Auralis menu"
        aria-label="Auralis menu"
        onClick={(e) => void call('menu.app', rectOf(e.currentTarget))}
      >
        <Orb size={30} />
      </button>
      <button
        className={`space-gem space-${space?.color ?? 'sky'}${(state?.spaces.length ?? 1) > 1 ? ' has-name' : ''}`}
        title="Spaces"
        aria-label={`Space: ${space?.name ?? 'Home'}`}
        onClick={(e) => void call('menu.spaces', rectOf(e.currentTarget))}
      >
        <span className="gem" />
        {(state?.spaces.length ?? 1) > 1 && <span className="space-name glow-text">{space?.name}</span>}
      </button>
      <div className="tabstrip" ref={stripRef} role="tablist" aria-label="Tabs" onPointerLeave={() => hidePreview()}>
        {tabs.map((t, i) => (
          <Tab
            key={t.id}
            tab={t}
            active={t.id === state?.activeTabId}
            inSplit={!!state?.split && (state.split.left === t.id || state.split.right === t.id)}
            width={widthOf(t)}
            shift={shiftFor(i)}
            dragging={drag?.active === true && drag.id === t.id}
            onPointerDown={(e) => onPointerDown(e, t, i)}
            onPointerMove={onPointerMove}
            onPointerUp={() => onPointerUp(t)}
            onHover={(el) => schedulePreview(t, el)}
            onLeave={() => hidePreview()}
            onKeyDown={(e) => onKeyDown(e, i)}
          />
        ))}
        <button className="newtab-button" title="New tab (Ctrl+T)" aria-label="New tab" onClick={() => void call('tab.new', {})}>
          <Icon name="plus" size={14} />
        </button>
        <div className="tabstrip-fill" />
      </div>
    </div>
  )
}

function Tab(props: {
  tab: TabState
  active: boolean
  inSplit: boolean
  width: number
  shift: number
  dragging: boolean
  onPointerDown: (e: RPointerEvent) => void
  onPointerMove: (e: RPointerEvent) => void
  onPointerUp: () => void
  onHover: (el: HTMLElement) => void
  onLeave: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}) {
  const { tab, active, width } = props
  const ref = useRef<HTMLDivElement>(null)
  const compact = width < 76 && !tab.pinned
  const style = {
    width,
    transform: props.shift ? `translateX(${props.shift}px)` : undefined,
    '--accent': tab.accent ?? '#7fd3ff'
  } as CSSProperties
  const cls = [
    'tab',
    active ? 'is-active' : '',
    tab.pinned ? 'is-pinned' : '',
    tab.asleep ? 'is-asleep' : '',
    props.inSplit ? 'is-split' : '',
    props.dragging ? 'is-dragging' : '',
    props.shift && !props.dragging ? 'is-shifting' : '',
    compact ? 'is-compact' : ''
  ]
    .filter(Boolean)
    .join(' ')

  const onMouseMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect()
    ref.current!.style.setProperty('--mx', `${e.clientX - r.left}px`)
  }

  const status = tab.crashed ? (
    <Icon name="warning" size={14} className="tab-warn" />
  ) : tab.loading ? (
    <span className="busy-ring" aria-label="Loading" />
  ) : (
    <Favicon src={tab.isNewTab ? null : tab.favicon} dim={tab.asleep} />
  )

  return (
    <div
      ref={ref}
      className={cls}
      style={style}
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      data-tab={tab.id}
      title={tab.pinned || compact ? tab.title : undefined}
      onPointerDown={props.onPointerDown}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onMouseEnter={() => props.onHover(ref.current!)}
      onMouseMove={onMouseMove}
      onMouseLeave={props.onLeave}
      onKeyDown={props.onKeyDown}
      onAuxClick={(e) => {
        if (e.button === 1) void call('tab.close', tab.id)
      }}
      onMouseDown={(e) => {
        if (e.button === 1) e.preventDefault()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        props.onLeave()
        void call('tab.menu', tab.id, { x: e.clientX, y: e.clientY, width: 0, height: 0 })
      }}
    >
      <span className="tab-glow" />
      <span className="tab-icon">{status}</span>
      {!tab.pinned && <span className="tab-title">{tab.title}</span>}
      {(tab.audible || tab.muted) && !compact && (
        <button
          className="tab-audio"
          title={tab.muted ? 'Unmute tab' : 'Mute tab'}
          aria-label={tab.muted ? 'Unmute tab' : 'Mute tab'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            void call('tab.toggleMute', tab.id)
          }}
        >
          <Icon name={tab.muted ? 'mute' : 'volume'} size={13} />
        </button>
      )}
      {!tab.pinned && (!compact || active) && (
        <button
          className="tab-close"
          title="Close tab (Ctrl+W)"
          aria-label="Close tab"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            props.onLeave()
            void call('tab.close', tab.id)
          }}
        >
          <Icon name="close" size={11} />
        </button>
      )}
    </div>
  )
}
