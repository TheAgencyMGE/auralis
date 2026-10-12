import { useEffect, useRef, useState } from 'react'
import type { Settings } from '@shared/settings'
import type { TabState, WindowState } from '@shared/types'
import { displayUrl } from '@shared/url'
import { bridge, call, rectOf } from '@ui/api'
import { Icon } from '@ui/icons'
import { Orb } from '@ui/Orb'

type SetAnchor = (key: string) => (el: HTMLElement | null) => void

export function Toolbar({ state, active, settings, setAnchor }: { state: WindowState | null; active: TabState | null; settings: Settings; setAnchor: SetAnchor }) {
  const dl = state?.downloads
  const showDownloads = !!dl && (dl.active > 0 || dl.recent > 0)
  return (
    <div className="navrow">
      <NavOrbs active={active} />
      {settings.showHomeButton && (
        <button className="glass-btn" title="Home (Alt+Home)" aria-label="Home" onClick={() => void call('nav.home')}>
          <Icon name="home" />
        </button>
      )}
      <Omnibox active={active} setAnchor={setAnchor} />
      <div className="tools">
        <button
          className={`glass-btn${state?.split ? ' is-on' : ''}`}
          title={state?.split ? 'Close split view (Ctrl+Shift+E)' : 'Split view (Ctrl+Shift+E)'}
          aria-label="Split view"
          aria-pressed={!!state?.split}
          onClick={() => void call('tool.run', 'split-view')}
        >
          <Icon name="split" />
        </button>
        <button className="glass-btn" title="Tab Flip (Ctrl+Shift+A)" aria-label="Tab Flip" onClick={() => void call('tool.run', 'tab-flip')}>
          <Icon name="layers" />
        </button>
        {state?.extensions.map((a) => (
          <button
            key={a.id}
            className="glass-btn ext-btn"
            title={a.title}
            aria-label={a.title}
            onClick={(e) => void call('extensions.activate', a.id, rectOf(e.currentTarget))}
            onContextMenu={(e) => {
              e.preventDefault()
              void call('extensions.menu', a.id, rectOf(e.currentTarget))
            }}
          >
            {a.icon ? <img src={a.icon} width={16} height={16} alt="" /> : <Icon name="extensions" />}
            {a.badge && (
              <span className="badge" style={{ background: a.badgeColor }}>
                {a.badge.slice(0, 4)}
              </span>
            )}
          </button>
        ))}
        <ShieldButton active={active} settings={settings} />
        <button
          className={`glass-btn${settings.sidebar ? ' is-on' : ''}`}
          title={settings.sidebar ? 'Hide the Sidebar' : 'Show the Sidebar'}
          aria-label="Sidebar"
          aria-pressed={settings.sidebar}
          onClick={() => void call('settings.set', { sidebar: !settings.sidebar })}
        >
          <Icon name="sidebar" />
        </button>
        {showDownloads && (
          <button
            ref={setAnchor('downloads')}
            className="glass-btn downloads-btn"
            title="Downloads"
            aria-label={`Downloads${dl!.active ? `, ${dl!.active} in progress` : ''}`}
            onClick={(e) => void call('menu.downloads', rectOf(e.currentTarget))}
          >
            <Icon name="download" />
            {dl!.active > 0 && <ProgressRing value={dl!.progress} />}
          </button>
        )}
      </div>
    </div>
  )
}

export function ProgressRing({ value }: { value: number }) {
  const r = 12
  const c = 2 * Math.PI * r
  const indeterminate = value < 0
  return (
    <svg className={`progress-ring${indeterminate ? ' is-indeterminate' : ''}`} viewBox="0 0 28 28" aria-hidden>
      <circle cx="14" cy="14" r={r} className="track" />
      <circle cx="14" cy="14" r={r} className="bar" strokeDasharray={c} strokeDashoffset={indeterminate ? c * 0.7 : c * (1 - value)} />
    </svg>
  )
}

function NavOrbs({ active }: { active: TabState | null }) {
  const holdTimer = useRef<number | null>(null)
  const historyMenu = (dir: 'back' | 'forward', el: HTMLElement) => void call('nav.historyMenu', dir, rectOf(el))
  const press = (dir: 'back' | 'forward') => ({
    onClick: () => void call(dir === 'back' ? 'nav.back' : 'nav.forward'),
    onContextMenu: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      historyMenu(dir, e.currentTarget)
    },
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      const el = e.currentTarget
      holdTimer.current = window.setTimeout(() => historyMenu(dir, el), 550)
    },
    onPointerUp: () => holdTimer.current && window.clearTimeout(holdTimer.current),
    onPointerLeave: () => holdTimer.current && window.clearTimeout(holdTimer.current)
  })
  return (
    <div className="nav-orbs">
      <button className="nav-orb is-back" disabled={!active?.canGoBack} title="Back (Alt+Left). Right-click for history" aria-label="Back" {...press('back')}>
        <Icon name="back" size={18} />
      </button>
      <button className="nav-orb is-forward" disabled={!active?.canGoForward} title="Forward (Alt+Right)" aria-label="Forward" {...press('forward')}>
        <Icon name="forward" size={15} />
      </button>
    </div>
  )
}

export function ShieldButton({ active, settings }: { active: TabState | null; settings: Settings }) {
  const on = !!active?.shieldActive
  const web = !!active && /^https?:/.test(active.url)
  const label = !settings.shieldEnabled
    ? 'Shield is off'
    : !web
      ? 'Shield'
      : on
        ? `Shield: ${active!.blocked} ad${active!.blocked === 1 ? '' : 's'} and trackers blocked`
        : 'Shield is off for this site'
  return (
    <button
      className={`glass-btn shield-btn${on ? ' is-on' : ''}`}
      title={label}
      aria-label={label}
      onClick={(e) => void call('menu.siteinfo', rectOf(e.currentTarget))}
    >
      <Icon name={on || !web ? 'shield' : 'shield-off'} />
      {on && active!.blocked > 0 && <span className="badge">{active!.blocked > 99 ? '99+' : active!.blocked}</span>}
    </button>
  )
}

// ---- omnibox ----------------------------------------------------------------------

function useFakeProgress(loading: boolean, key: unknown): number {
  // Electron reports no load progress; ease toward 85% while loading, then finish.
  const [p, setP] = useState(0)
  useEffect(() => {
    if (!loading) {
      setP((v) => (v > 0 ? 1 : 0))
      const t = window.setTimeout(() => setP(0), 420)
      return () => window.clearTimeout(t)
    }
    setP(0.08)
    let v = 0.08
    const id = window.setInterval(() => {
      v += (0.85 - v) * 0.06
      setP(v)
    }, 100)
    return () => window.clearInterval(id)
  }, [loading, key])
  return p
}

function SiteChip({ tab, anchorRef }: { tab: TabState | null; anchorRef: (el: HTMLElement | null) => void }) {
  const sec = tab?.security ?? 'none'
  const open = (el: HTMLElement) => void call('menu.siteinfo', rectOf(el))
  if (!tab || tab.isNewTab) {
    return (
      <span ref={anchorRef} className="site-chip is-search" aria-hidden>
        <Icon name="search" size={14} />
      </span>
    )
  }
  const map = {
    secure: { icon: 'lock', text: '', cls: 'is-secure', label: 'Connection is secure' },
    insecure: { icon: 'warning', text: 'Not secure', cls: 'is-insecure', label: 'Connection is not secure' },
    error: { icon: 'warning', text: 'Certificate error', cls: 'is-error', label: 'The certificate is not valid' },
    internal: { icon: '', text: 'Auralis', cls: 'is-internal', label: 'Auralis page' },
    file: { icon: 'page', text: 'File', cls: 'is-file', label: 'Local file' },
    none: { icon: 'info', text: '', cls: 'is-none', label: 'Site information' }
  }[sec]
  return (
    <button ref={anchorRef} className={`site-chip ${map.cls}`} title={map.label} aria-label={map.label} onClick={(e) => open(e.currentTarget)}>
      {sec === 'internal' ? <Orb size={16} /> : <Icon name={map.icon} size={14} />}
      {map.text && <span>{map.text}</span>}
    </button>
  )
}

export function Omnibox({
  active,
  setAnchor,
  compact = false,
  minDropWidth = 0
}: {
  active: TabState | null
  setAnchor: SetAnchor
  /** Aqua: refresh and zoom live elsewhere */
  compact?: boolean
  /** the suggestion list may be wider than the field itself */
  minDropWidth?: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [value, setValue] = useState('')
  const typed = useRef('')
  const pickIndex = useRef<number | null>(null)
  const editing = useRef(false)
  const shownUrl = active ? (active.isNewTab ? '' : displayUrl(active.url)) : ''
  const progress = useFakeProgress(!!active?.loading, active?.id)


  // Follow the page while the user isn't editing.
  useEffect(() => {
    if (!editing.current) setValue(shownUrl)
  }, [shownUrl, active?.id])

  // A tab switch abandons any half-typed text.
  useEffect(() => {
    editing.current = false
    setValue(shownUrl)
    pickIndex.current = null
  }, [active?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // A click into the page takes focus from the address bar.
  useEffect(() => bridge().on('page.focus', () => inputRef.current?.blur()), [])

  useEffect(
    () =>
      bridge().on('omnibox.focus', (p) => {
        const el = inputRef.current
        if (!el) return
        el.focus()
        if ((p as { selectAll?: boolean })?.selectAll !== false) el.select()
      }),
    []
  )

  const anchorRect = () => {
    const r = rectOf(inputRef.current?.closest('.omnibox') ?? null)
    return { ...r, width: Math.max(r.width, minDropWidth) }
  }

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target
    const text = el.value
    editing.current = true
    pickIndex.current = null
    typed.current = text
    setValue(text)
    const native = e.nativeEvent as InputEvent
    const caretAtEnd = el.selectionStart === text.length
    const allowInline = caretAtEnd && native.inputType === 'insertText'
    const r = await call<{ inline: string | null }>('omnibox.input', text, anchorRect(), allowInline)
    // Only complete if the user hasn't typed further meanwhile.
    if (r?.inline && inputRef.current && inputRef.current.value === text && typed.current === text) {
      const full = text + r.inline.slice(text.length)
      setValue(full)
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(text.length, full.length))
    }
  }

  const onKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const r = await call<{ fill: string; index: number } | null>('omnibox.move', e.key === 'ArrowDown' ? 1 : -1)
      if (r) {
        pickIndex.current = r.index === 0 ? null : r.index
        setValue(r.index === 0 ? typed.current : r.fill)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      let text = el.value
      // Ctrl+Enter completes "contoso" to www.contoso.com, like every browser since IE.
      if (e.ctrlKey && !/[\s./:]/.test(text) && text) text = `www.${text}.com`
      editing.current = false
      const idx = pickIndex.current
      pickIndex.current = null
      void call('omnibox.accept', text, idx, e.altKey || (e.shiftKey && e.ctrlKey))
      el.blur()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (el.value !== shownUrl) {
        editing.current = false
        setValue(shownUrl)
        void call('omnibox.dismiss')
        requestAnimationFrame(() => el.select())
      } else {
        el.blur()
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      // Deleting an inline completion must not re-complete it.
      typed.current = el.value
    }
  }

  const host = (() => {
    if (!active || active.isNewTab || active.security === 'internal') return null
    const m = /^(https?:\/\/)?([^/?#]+)(.*)$/.exec(shownUrl)
    return m ? { scheme: m[1] ?? '', host: m[2], rest: m[3] } : null
  })()

  return (
    <div
      ref={setAnchor('omnibox')}
      className={`omnibox${focused ? ' is-focused' : ''} sec-${active?.security ?? 'none'}`}
      style={{ '--progress': progress } as React.CSSProperties}
    >
      <span className="omnibox-progress" aria-hidden />
      <SiteChip tab={active} anchorRef={setAnchor('siteInfo')} />
      <div className="omnibox-field">
        <input
          ref={inputRef}
          className="omnibox-input"
          value={value}
          spellCheck={false}
          autoComplete="off"
          aria-label="Address and search bar"
          placeholder="Search or enter address"
          onChange={(e) => void onChange(e)}
          onKeyDown={(e) => void onKeyDown(e)}
          onFocus={(e) => {
            setFocused(true)
            // Synchronous: a deferred select() would swallow a fast first keystroke.
            e.currentTarget.select()
          }}
          onMouseDown={(e) => {
            // First click selects the whole address; later clicks place the caret.
            if (document.activeElement !== e.currentTarget) {
              e.preventDefault()
              e.currentTarget.focus()
            }
          }}
          onBlur={() => {
            setFocused(false)
            void call('omnibox.dismiss')
            if (!editing.current || !value.trim()) {
              editing.current = false
              setValue(shownUrl)
            }
          }}
        />
        {!focused && host && value === shownUrl && (
          <div className="omnibox-display" aria-hidden>
            {host.scheme && <span className="dim">{host.scheme}</span>}
            <span className="host">{host.host}</span>
            <span className="dim">{host.rest}</span>
          </div>
        )}
      </div>
      {!!active?.feeds.length && !focused && (
        <button
          className="field-btn feed-btn"
          title={active.feeds.length === 1 ? `View feed: ${active.feeds[0].title || 'this site’s feed'}` : `View feeds (${active.feeds.length})`}
          aria-label="View this site’s feed"
          onClick={() => void call('feed.open', active.feeds[0].url)}
        >
          <img src="/art/feed.svg" width={16} height={16} alt="" />
        </button>
      )}
      {active?.readerable && !focused && (
        <button className="field-btn" title="Reader view (F9)" aria-label="Reader view" onClick={() => void call('tool.run', 'reader')}>
          <Icon name="reader" />
        </button>
      )}
      {!compact && active && Math.abs(active.zoom - 1) > 0.001 && (
        <button className="zoom-chip" title="Zoom" onClick={(e) => void call('menu.zoom', rectOf(e.currentTarget))}>
          {Math.round(active.zoom * 100)}%
        </button>
      )}
      {active && !active.isNewTab && /^(https?|file):/.test(active.url) && (
        <button
          ref={setAnchor('star')}
          className={`field-btn star-btn${active.bookmarked ? ' is-on' : ''}`}
          title={active.bookmarked ? 'Edit favorite (Ctrl+D)' : 'Add to Favorites (Ctrl+D)'}
          aria-label={active.bookmarked ? 'Edit favorite' : 'Add to Favorites'}
          onClick={(e) => void call('menu.bookmarkStar', rectOf(e.currentTarget))}
        >
          <Icon name={active.bookmarked ? 'star-filled' : 'star'} />
        </button>
      )}
      {!compact && <span className="field-divider" />}
      {!compact && (
      <button
        className="field-btn reload-btn"
        title={active?.loading ? 'Stop (Esc)' : 'Refresh (F5)'}
        aria-label={active?.loading ? 'Stop' : 'Refresh'}
        onClick={(e) => void call(active?.loading ? 'nav.stop' : 'nav.reload', e.shiftKey || e.ctrlKey)}
      >
        <Icon name={active?.loading ? 'stop' : 'reload'} size={active?.loading ? 13 : 15} />
      </button>
      )}
    </div>
  )
}
