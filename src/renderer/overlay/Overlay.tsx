// Draws whatever the main process asks for above web content, measures
// it, and reports the size so the overlay view can be fitted around it.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DownloadItemState, MenuItem, OverlayContent, ScreenSource, Space, SpaceColor, TabThumb } from '@shared/types'
import { applyFrameTokens, bridge, call, formatBytes } from '@ui/api'
import { COMMAND_ICONS, Favicon, Icon } from '@ui/icons'
import { Orb } from '@ui/Orb'
import type { Settings } from '@shared/settings'

interface Msg {
  token: number
  content?: OverlayContent | null
  modal?: boolean
  align?: string
  shadow?: number
  placed?: { x: number; y: number }
}

const act = (id: string, payload?: unknown) => void call('overlay.action', id, payload ?? null)
const close = () => void call('overlay.close')

export function OverlayApp() {
  const [msg, setMsg] = useState<Msg | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void call<Settings>('settings.get').then((s) => applyFrameTokens(s))
    const offS = bridge().on('settings', (s) => applyFrameTokens(s as Settings))
    const off = bridge().on('overlay', (p) => {
      const m = p as Msg
      if (m.placed) return
      setMsg(m.content ? m : null)
    })
    return () => {
      off()
      offS()
    }
  }, [])

  const measure = useCallback(() => {
    const el = popupRef.current
    if (!el || !msg) return
    const r = el.getBoundingClientRect()
    void call('overlay.measured', msg.token, { width: r.width, height: r.height })
  }, [msg])

  useLayoutEffect(() => {
    measure()
    const el = popupRef.current
    if (!el || msg?.modal) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    return () => ro.disconnect()
  }, [msg, measure])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!msg?.content) return null
  const c = msg.content
  const shadow = msg.shadow ?? 14

  if (msg.modal) {
    return (
      <div className="ov-modal" ref={popupRef} onMouseDown={(e) => e.target === e.currentTarget && close()}>
        {c.kind === 'tabflip' && <TabFlip key={msg.token} tabs={c.tabs} spaces={c.spaces} />}
        {c.kind === 'palette' && <Palette key={msg.token} initial={c.query} />}
        {c.kind === 'screens' && <ScreenPicker key={msg.token} origin={c.origin} audio={c.audio} sources={c.sources} />}
      </div>
    )
  }

  return (
    <div className="ov-stage" style={{ padding: shadow }}>
      <div ref={popupRef} className={`ov-popup ov-${c.kind}`} role={c.kind === 'menu' || c.kind === 'appmenu' ? 'menu' : 'dialog'}>
        <Content key={c.kind === 'omnibox' || c.kind === 'preview' ? c.kind : msg.token} content={c} />
      </div>
    </div>
  )
}

function Content({ content: c }: { content: OverlayContent }) {
  switch (c.kind) {
    case 'menu':
      return <Menu items={c.items} minWidth={c.minWidth} />
    case 'appmenu':
      return <AppMenu items={c.items} recent={c.recent} incognito={c.incognito} />
    case 'omnibox':
      return <OmniboxList content={c} />
    case 'preview':
      return <Preview tab={c.tab} />
    case 'siteinfo':
      return <SiteInfoPanel info={c.info} />
    case 'permission':
      return <PermissionPrompt origin={c.prompt.origin} permissions={c.prompt.permissions} />
    case 'downloads':
      return <DownloadsPanel items={c.items} />
    case 'spaces':
      return <SpacesPanel spaces={c.spaces} active={c.activeSpaceId} counts={c.counts} />
    case 'qr':
      return <QrPanel url={c.url} dataUrl={c.dataUrl} />
    case 'bookmark':
      return <BookmarkPanel {...c} />
    case 'zoom':
      return <ZoomPanel level={c.level} />
    case 'confirm':
      return <Confirm title={c.title} message={c.message} confirm={c.confirm} cancel={c.cancel} />
    case 'toast':
      return (
        <div className="toast" role="status">
          {c.icon && <Icon name={c.icon} />}
          <span>{c.message}</span>
        </div>
      )
    default:
      return null
  }
}

// ---- menus ---------------------------------------------------------------------------

function MenuIcon({ icon }: { icon?: string }) {
  if (!icon) return <span className="mi-icon" />
  if (icon.startsWith('data:') || icon === 'page') return <span className="mi-icon"><Favicon src={icon === 'page' ? null : icon} /></span>
  if (icon === 'folder') return <span className="mi-icon"><FolderMini /></span>
  if (icon.startsWith('space-')) return <span className={`mi-icon ${icon}`}><span className="gem" /></span>
  return (
    <span className="mi-icon">
      <Icon name={COMMAND_ICONS[icon] ?? icon} />
    </span>
  )
}

function FolderMini() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M1.5 3.5a1 1 0 0 1 1-1h3.6l1.4 1.5h6a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" fill="#e4b33b" stroke="#b07f17" strokeWidth=".7" />
      <path d="M1.5 6.2h13V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" fill="#f8d36e" stroke="#c08d1d" strokeWidth=".7" />
    </svg>
  )
}

function Menu({ items, minWidth }: { items: MenuItem[]; minWidth?: number }) {
  const [stack, setStack] = useState<{ label: string; items: MenuItem[] }[]>([])
  const current = stack.length ? stack[stack.length - 1].items : items
  const [hot, setHot] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  const actionable = current.map((it, i) => (it.type || it.disabled ? -1 : i)).filter((i) => i >= 0)

  useEffect(() => setHot(-1), [stack.length])

  const activate = (it: MenuItem) => {
    if (it.disabled) return
    if (it.submenu) {
      setStack([...stack, { label: it.label ?? '', items: it.submenu }])
      return
    }
    if (it.id) act(it.id)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!actionable.length) return
      const pos = actionable.indexOf(hot)
      const next = e.key === 'ArrowDown' ? actionable[(pos + 1) % actionable.length] : actionable[(pos - 1 + actionable.length) % actionable.length]
      setHot(next)
    } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
      const it = current[hot]
      if (it && (e.key !== 'ArrowRight' || it.submenu)) {
        e.preventDefault()
        activate(it)
      }
    } else if ((e.key === 'ArrowLeft' || e.key === 'Backspace') && stack.length) {
      e.preventDefault()
      setStack(stack.slice(0, -1))
    }
  }

  useEffect(() => ref.current?.focus(), [])

  return (
    <div className="menu" ref={ref} tabIndex={-1} onKeyDown={onKey} style={{ minWidth }}>
      {stack.length > 0 && (
        <button className="mi mi-back sel" onClick={() => setStack(stack.slice(0, -1))}>
          <span className="mi-icon">
            <Icon name="chevron-left" />
          </span>
          <span className="mi-label">{stack[stack.length - 1].label}</span>
        </button>
      )}
      {current.map((it, i) =>
        it.type === 'separator' ? (
          <div key={i} className="mi-sep" role="separator" />
        ) : it.type === 'header' ? (
          <div key={i} className="mi-header">
            {it.label}
          </div>
        ) : (
          <button
            key={i}
            role="menuitem"
            className={`mi sel${i === hot ? ' is-hot' : ''}${it.danger ? ' is-danger' : ''}`}
            disabled={it.disabled}
            aria-checked={it.checked}
            onMouseEnter={() => setHot(i)}
            onClick={() => activate(it)}
          >
            {it.checked ? (
              <span className="mi-icon mi-check">
                <Icon name="check" />
              </span>
            ) : (
              <MenuIcon icon={it.icon} />
            )}
            <span className="mi-label">{it.label}</span>
            {it.accelerator && <span className="mi-accel">{it.accelerator}</span>}
            {it.submenu && <Icon name="chevron-right" size={12} className="mi-sub" />}
          </button>
        )
      )}
    </div>
  )
}

// ---- the app menu: two columns, like the Vista Start menu -----------------------------

function AppMenu({ items, recent, incognito }: { items: MenuItem[]; recent: { title: string; url: string; favicon: string | null }[]; incognito: boolean }) {
  const zoomIdx = items.findIndex((i) => i.type === 'header' && i.label === 'zoom')
  const left = items.slice(0, zoomIdx)
  const zoom = Number(items[zoomIdx]?.id?.split(':')[1] ?? 100)
  const right = items.slice(zoomIdx + 1)
  const [q, setQ] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => searchRef.current?.focus(), [])
  return (
    <div className="appmenu">
      <div className="am-columns">
        <div className="am-left">
          {left.map((it, i) =>
            it.type === 'separator' ? (
              <div key={i} className="mi-sep" />
            ) : (
              <button key={i} className="am-item sel" disabled={it.disabled} onClick={() => act(it.id!)}>
                <span className="am-icon">
                  <Icon name={COMMAND_ICONS[it.icon ?? ''] ?? it.icon ?? 'page'} size={18} />
                </span>
                <span className="am-label">{it.label}</span>
                {it.accelerator && <span className="mi-accel">{it.accelerator}</span>}
              </button>
            )
          )}
          <div className="am-zoom">
            <span className="am-zoom-label">Zoom</span>
            <button className="am-zbtn" aria-label="Zoom out" onClick={() => act('zoom-out')}>
              <Icon name="minus" size={13} />
            </button>
            <button className="am-zval" title="Reset zoom" onClick={() => act('zoom-reset')}>
              {zoom}%
            </button>
            <button className="am-zbtn" aria-label="Zoom in" onClick={() => act('zoom-in')}>
              <Icon name="plus" size={13} />
            </button>
            <button className="am-zbtn" aria-label="Full screen" title="Full screen (F11)" onClick={() => act('cmd:fullscreen')}>
              <Icon name="fullscreen" size={13} />
            </button>
          </div>
        </div>
        <div className="am-right">
          <div className="am-tile">
            <Orb size={44} />
            {incognito && <span className="am-private">InPrivate</span>}
          </div>
          {right.map((it, i) => (
            <button key={i} className="am-link" onClick={() => act(it.id!)}>
              {it.label}
            </button>
          ))}
          {recent.length > 0 && !incognito && (
            <>
              <div className="am-sep" />
              <div className="am-caption">Recently visited</div>
              {recent.slice(0, 5).map((r) => (
                <button key={r.url} className="am-recent" title={r.url} onClick={() => act('recent', r.url)}>
                  <Favicon src={r.favicon} size={14} />
                  <span>{r.title}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
      <div className="am-bottom">
        <div className="am-search">
          <Icon name="search" size={14} />
          <input
            ref={searchRef}
            value={q}
            placeholder="Search commands, tabs and history"
            aria-label="Search commands, tabs and history"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') act('search', q)
            }}
          />
        </div>
        <button className="am-power" title="Exit Auralis (Ctrl+Shift+Q)" aria-label="Exit Auralis" onClick={() => act('cmd:quit')}>
          <Icon name="power" size={15} />
        </button>
      </div>
    </div>
  )
}

// ---- omnibox suggestions ------------------------------------------------------------------

function OmniboxList({ content }: { content: Extract<OverlayContent, { kind: 'omnibox' }> }) {
  const kindIcon: Record<string, string> = { search: 'search', history: 'history', bookmark: 'star', tab: 'tab', navigate: 'globe', command: 'command' }
  return (
    <div className="omni" style={{ width: Math.max(320, content.width) }} role="listbox">
      {content.suggestions.map((s, i) => (
        <div
          key={`${s.kind}:${s.url}`}
          role="option"
          aria-selected={i === content.selected}
          className={`omni-row sel${i === content.selected ? ' is-selected' : ''}`}
          // pointerdown, not click: focus leaves the omnibox on mousedown.
          onPointerDown={(e) => {
            e.preventDefault()
            act('pick', i)
          }}
        >
          <span className="omni-icon">{s.kind === 'search' ? <Icon name="search" /> : s.favicon ? <Favicon src={s.favicon} /> : <Icon name={kindIcon[s.kind]} />}</span>
          <span className="omni-title">{s.title}</span>
          {s.kind !== 'search' && s.kind !== 'navigate' && <span className="omni-url">{s.url.replace(/^https?:\/\/(www\.)?/, '')}</span>}
          {s.kind === 'tab' && <span className="omni-tag">Switch to tab</span>}
          {s.kind === 'bookmark' && <Icon name="star" size={13} className="omni-star" />}
        </div>
      ))}
    </div>
  )
}

// ---- tab preview (Win7 taskbar thumbnail) ---------------------------------------------------

function Preview({ tab }: { tab: TabThumb }) {
  return (
    <div className="preview">
      <div className="preview-head">
        <Favicon src={tab.favicon} />
        <span className="preview-title">{tab.title}</span>
      </div>
      <div className="preview-shot">
        {tab.thumbnail ? <img src={tab.thumbnail} alt="" /> : <div className="preview-empty">{tab.asleep ? 'Asleep to save memory' : 'No preview yet'}</div>}
        {tab.asleep && tab.thumbnail && (
          <span className="preview-sleep">
            <Icon name="sleep" size={12} /> Asleep
          </span>
        )}
      </div>
      <div className="preview-url">{tab.url.replace(/^https?:\/\//, '')}</div>
    </div>
  )
}

// ---- site info ------------------------------------------------------------------------------------

const PERM_ICON: Record<string, string> = { geolocation: 'location', notifications: 'bell', camera: 'video', microphone: 'mic', 'clipboard-read': 'clipboard', midi: 'settings', midiSysex: 'settings' }
const PERM_NAME: Record<string, string> = { geolocation: 'Location', notifications: 'Notifications', camera: 'Camera', microphone: 'Microphone', 'clipboard-read': 'Clipboard', midi: 'MIDI devices', midiSysex: 'MIDI control', 'idle-detection': 'Idle detection', 'window-management': 'Window management' }

function SiteInfoPanel({ info }: { info: Extract<OverlayContent, { kind: 'siteinfo' }>['info'] }) {
  const [showCert, setShowCert] = useState(false)
  const head = {
    secure: { icon: 'lock', cls: 'is-secure', title: 'Connection is secure', text: 'Information you send to this site is private and can’t be read in transit.' },
    insecure: { icon: 'warning', cls: 'is-insecure', title: 'Connection is not secure', text: 'Don’t enter passwords or payment details here. Someone on the network could read or change them.' },
    error: { icon: 'warning', cls: 'is-insecure', title: 'Certificate is not valid', text: 'This site’s identity couldn’t be verified, so Auralis blocked the connection.' },
    internal: { icon: 'info', cls: 'is-internal', title: 'Auralis page', text: 'This page is part of Auralis.' },
    file: { icon: 'page', cls: 'is-internal', title: 'Local file', text: 'This file is on your computer.' },
    none: { icon: 'info', cls: 'is-internal', title: info.host || 'Site information', text: '' }
  }[info.security]
  const web = /^https?:/.test(info.url)
  return (
    <div className="siteinfo">
      <div className={`si-head ${head.cls}`}>
        <span className="si-badge">
          <Icon name={head.icon} size={18} />
        </span>
        <div>
          <div className="si-host">{info.host || head.title}</div>
          <div className="si-title">{head.title}</div>
        </div>
      </div>
      {head.text && <p className="si-text">{head.text}</p>}
      {info.certificate && (
        <button className="si-row sel" onClick={() => setShowCert(!showCert)} aria-expanded={showCert}>
          <Icon name="certificate" />
          <span className="si-label">Certificate</span>
          <span className="si-value">{showCert ? 'Hide' : 'Details'}</span>
        </button>
      )}
      {showCert && info.certificate && (
        <dl className="si-cert">
          <dt>Issued to</dt>
          <dd>{info.certificate.subject}</dd>
          <dt>Issued by</dt>
          <dd>{info.certificate.issuer}</dd>
          <dt>Valid</dt>
          <dd>
            {new Date(info.certificate.validFrom).toLocaleDateString()} – {new Date(info.certificate.validTo).toLocaleDateString()}
          </dd>
          <dt>SHA-256</dt>
          <dd className="si-mono">{info.certificate.fingerprint.replace(/^sha256\//, '')}</dd>
        </dl>
      )}
      {web && (
        <>
          <div className="si-sep" />
          <label className="si-row si-shield">
            <Icon name={info.shieldActive ? 'shield' : 'shield-off'} />
            <span className="si-label">
              Shield
              <small>{!info.shieldEnabled ? 'Turned off in Settings' : info.shieldActive ? `${info.blocked} ad${info.blocked === 1 ? '' : 's'} and trackers blocked on this page` : 'Off for this site'}</small>
            </span>
            <input type="checkbox" className="toggle" disabled={!info.shieldEnabled} checked={info.shieldActive} onChange={() => act('shield')} />
          </label>
          {info.permissions.map((p) => (
            <div key={p.permission} className="si-row">
              <Icon name={PERM_ICON[p.permission] ?? 'settings'} />
              <span className="si-label">{PERM_NAME[p.permission] ?? p.permission}</span>
              <select
                className="field si-select"
                value={p.decision}
                onChange={(e) => act('permission', { permission: p.permission, decision: e.target.value })}
              >
                <option value="allow">Allow</option>
                <option value="deny">Block</option>
                <option value="reset">Ask (reset)</option>
              </select>
            </div>
          ))}
          <div className="si-row">
            <Icon name="cookie" />
            <span className="si-label">
              Cookies and site data
              <small>{info.cookies} cookie{info.cookies === 1 ? '' : 's'} in use</small>
            </span>
            <button className="btn" onClick={() => act('clear')}>
              Clear
            </button>
          </div>
          <div className="si-foot">
            <button className="link-btn" onClick={() => act('settings')}>
              Site permissions
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function PermissionPrompt({ origin, permissions }: { origin: string; permissions: string[] }) {
  const host = origin.replace(/^https?:\/\//, '')
  return (
    <div className="perm">
      <div className="perm-text">
        <strong>{host}</strong> wants to
      </div>
      <ul className="perm-list">
        {permissions.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <div className="perm-actions">
        <button className="btn" onClick={() => act('deny')}>
          Block
        </button>
        <button className="btn is-default" autoFocus onClick={() => act('allow')}>
          Allow
        </button>
      </div>
    </div>
  )
}

// ---- downloads ----------------------------------------------------------------------------------------

function DownloadsPanel({ items }: { items: DownloadItemState[] }) {
  return (
    <div className="dlp">
      <div className="panel-title">Downloads</div>
      {items.length === 0 && <div className="panel-empty">Files you download appear here.</div>}
      {items.map((d) => {
        const live = d.state === 'progressing' || d.state === 'paused'
        const pct = d.total > 0 ? d.received / d.total : 0
        return (
          <div key={d.id} className={`dl-row sel dl-${d.state}`} onDoubleClick={() => d.state === 'completed' && act('open', d.id)}>
            <span className="dl-icon">
              <Icon name="page" size={22} />
            </span>
            <div className="dl-main">
              <button className="dl-name" disabled={d.state !== 'completed'} onClick={() => act('open', d.id)} title={d.path}>
                {d.filename}
              </button>
              {live ? (
                <>
                  <div className="dl-bar">
                    <span style={{ width: `${pct * 100}%` }} />
                  </div>
                  <div className="dl-meta">
                    {d.state === 'paused' ? 'Paused — ' : ''}
                    {formatBytes(d.received)}
                    {d.total > 0 ? ` of ${formatBytes(d.total)}` : ''}
                    {d.state === 'progressing' && d.speed > 0 ? `, ${formatBytes(d.speed)}/s` : ''}
                  </div>
                </>
              ) : (
                <div className="dl-meta">{d.state === 'completed' ? formatBytes(d.total || d.received) : d.state === 'cancelled' ? 'Canceled' : 'Failed — the connection was interrupted'}</div>
              )}
            </div>
            <div className="dl-actions">
              {d.state === 'progressing' && (
                <button className="glass-mini" title="Pause" aria-label="Pause" onClick={() => act('pause', d.id)}>
                  <Icon name="pause" size={12} />
                </button>
              )}
              {d.state === 'paused' && (
                <button className="glass-mini" title="Resume" aria-label="Resume" onClick={() => act('resume', d.id)}>
                  <Icon name="play" size={12} />
                </button>
              )}
              {live && (
                <button className="glass-mini" title="Cancel" aria-label="Cancel" onClick={() => act('cancel', d.id)}>
                  <Icon name="close" size={11} />
                </button>
              )}
              {d.state === 'interrupted' && (
                <button className="glass-mini" title="Retry" aria-label="Retry" onClick={() => act('retry', d.id)}>
                  <Icon name="reload" size={12} />
                </button>
              )}
              {d.state === 'completed' && (
                <button className="glass-mini" title="Show in folder" aria-label="Show in folder" onClick={() => act('show', d.id)}>
                  <Icon name="folder" size={13} />
                </button>
              )}
            </div>
          </div>
        )
      })}
      <div className="panel-foot">
        <button className="link-btn" onClick={() => act('all')}>
          Open Downloads
        </button>
      </div>
    </div>
  )
}

// ---- spaces -------------------------------------------------------------------------------------------------

const SPACE_COLORS: SpaceColor[] = ['sky', 'sea', 'leaf', 'sun', 'rose', 'violet', 'graphite']

function SpacesPanel({ spaces, active, counts }: { spaces: Space[]; active: string; counts: Record<string, number> }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  return (
    <div className="spaces">
      <div className="panel-title">Spaces</div>
      <p className="panel-note">Each space keeps its own set of tabs.</p>
      {spaces.map((s) => (
        <div key={s.id} className={`space-row sel${s.id === active ? ' is-selected' : ''}`}>
          {editing === s.id ? (
            <div className="space-edit">
              <input
                className="field"
                autoFocus
                value={name}
                maxLength={40}
                aria-label="Space name"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    act('update', { id: s.id, name })
                    setEditing(null)
                  }
                }}
              />
              <div className="swatches">
                {SPACE_COLORS.map((c) => (
                  <button key={c} className={`swatch space-${c}${s.color === c ? ' is-on' : ''}`} aria-label={c} onClick={() => act('update', { id: s.id, color: c })}>
                    <span className="gem" />
                  </button>
                ))}
              </div>
              <div className="space-edit-actions">
                {spaces.length > 1 && (
                  <button className="btn is-danger" onClick={() => act('delete', { id: s.id })}>
                    Delete
                  </button>
                )}
                <button
                  className="btn is-default"
                  onClick={() => {
                    act('update', { id: s.id, name })
                    setEditing(null)
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <button className="space-main" onClick={() => act('switch', { id: s.id })}>
                <span className={`space-dot space-${s.color}`}>
                  <span className="gem" />
                </span>
                <span className="space-label">{s.name}</span>
                <span className="space-count">{counts[s.id] ?? 0} tabs</span>
              </button>
              <button
                className="glass-mini"
                title="Rename or recolor"
                aria-label={`Edit ${s.name}`}
                onClick={() => {
                  setEditing(s.id)
                  setName(s.name)
                }}
              >
                <Icon name="edit" size={12} />
              </button>
            </>
          )}
        </div>
      ))}
      <div className="panel-foot">
        <button className="btn" onClick={() => act('new', {})}>
          <Icon name="plus" size={12} /> New space
        </button>
      </div>
    </div>
  )
}

// ---- small panels ----------------------------------------------------------------------------------------------

function QrPanel({ url, dataUrl }: { url: string; dataUrl: string }) {
  return (
    <div className="qr">
      <div className="panel-title">Scan to open on your phone</div>
      <img src={dataUrl} width={232} height={232} alt={`QR code for ${url}`} />
      <div className="qr-url">{url}</div>
      <div className="perm-actions">
        <button className="btn" onClick={() => act('save')}>
          Save image…
        </button>
        <button className="btn is-default" onClick={() => act('copy')}>
          Copy image
        </button>
      </div>
    </div>
  )
}

function BookmarkPanel({ title, folderId, folders }: Extract<OverlayContent, { kind: 'bookmark' }>) {
  const [t, setT] = useState(title)
  const [f, setF] = useState(folderId)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  return (
    <form
      className="bm"
      onSubmit={(e) => {
        e.preventDefault()
        act('save', { title: t, folderId: f })
      }}
    >
      <div className="bm-head">
        <Icon name="star" size={18} className="bm-star" />
        <span className="panel-title">Added to Favorites</span>
      </div>
      <label className="bm-field">
        <span>Name</span>
        <input ref={ref} className="field" value={t} onChange={(e) => setT(e.target.value)} maxLength={1024} />
      </label>
      <label className="bm-field">
        <span>Folder</span>
        <select className="field" value={f} onChange={(e) => setF(Number(e.target.value))}>
          {folders.map((fo) => (
            <option key={fo.id} value={fo.id}>
              {' '.repeat(fo.depth)}
              {fo.title}
            </option>
          ))}
        </select>
      </label>
      <div className="perm-actions">
        <button type="button" className="btn is-danger" onClick={() => act('remove')}>
          Remove
        </button>
        <button type="submit" className="btn is-default">
          Done
        </button>
      </div>
    </form>
  )
}

function ZoomPanel({ level }: { level: number }) {
  return (
    <div className="zoomp">
      <button className="glass-mini" aria-label="Zoom out" onClick={() => act('out')}>
        <Icon name="minus" size={13} />
      </button>
      <span className="zoomp-val">{level}%</span>
      <button className="glass-mini" aria-label="Zoom in" onClick={() => act('in')}>
        <Icon name="plus" size={13} />
      </button>
      <button className="btn" onClick={() => act('reset')}>
        Reset
      </button>
    </div>
  )
}

function Confirm({ title, message, confirm, cancel }: { title: string; message: string; confirm: string; cancel: string }) {
  return (
    <div className="confirm" role="alertdialog" aria-label={title}>
      <div className="confirm-body">
        <Icon name="warning" size={30} className="confirm-icon" />
        <div>
          <div className="confirm-title">{title}</div>
          <div className="confirm-msg">{message}</div>
        </div>
      </div>
      <div className="confirm-actions">
        <button className="btn is-default" autoFocus onClick={() => act('cancel')}>
          {cancel}
        </button>
        <button className="btn" onClick={() => act('confirm')}>
          {confirm}
        </button>
      </div>
    </div>
  )
}

// ---- Tab Flip -----------------------------------------------------------------------------------------------------

function TabFlip({ tabs, spaces }: { tabs: TabThumb[]; spaces: Space[] }) {
  const [q, setQ] = useState('')
  const [space, setSpace] = useState<string | 'all'>(() => tabs.find((t) => t.active)?.spaceId ?? 'all')
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase()
    return tabs.filter((t) => (space === 'all' || t.spaceId === space) && (!n || t.title.toLowerCase().includes(n) || t.url.toLowerCase().includes(n)))
  }, [tabs, q, space])
  const [hot, setHot] = useState(0)
  useEffect(() => {
    const i = filtered.findIndex((t) => t.active)
    setHot(i >= 0 && !q ? i : 0)
  }, [filtered, q])
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])
  const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(filtered.length))))

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.key === 'ArrowRight' || e.key === 'Tab' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? cols : e.key === 'ArrowUp' ? -cols : 0
    if (step && filtered.length) {
      e.preventDefault()
      setHot((h) => Math.max(0, Math.min(filtered.length - 1, h + (e.shiftKey && e.key === 'Tab' ? -1 : step))))
    } else if (e.key === 'Enter' && filtered[hot]) act('activate', filtered[hot].id)
    else if (e.key === 'Delete' && filtered[hot] && !q) act('close', filtered[hot].id)
  }

  return (
    <div className="flip" onKeyDown={onKey}>
      <div className="flip-top">
        <div className="flip-search">
          <Icon name="search" />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search open tabs" aria-label="Search open tabs" />
        </div>
        {spaces.length > 1 && (
          <div className="flip-spaces" role="tablist">
            <button className={space === 'all' ? 'is-on' : ''} onClick={() => setSpace('all')}>
              All spaces
            </button>
            {spaces.map((s) => (
              <button key={s.id} className={`space-${s.color}${space === s.id ? ' is-on' : ''}`} onClick={() => setSpace(s.id)}>
                <span className="gem" /> {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flip-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {filtered.map((t, i) => (
          <div
            key={t.id}
            className={`flip-card${i === hot ? ' is-hot' : ''}${t.active ? ' is-active' : ''}`}
            onMouseEnter={() => setHot(i)}
            onClick={() => act('activate', t.id)}
            onAuxClick={(e) => e.button === 1 && act('close', t.id)}
          >
            <div className="flip-shot">
              {t.thumbnail ? <img src={t.thumbnail} alt="" /> : <div className="flip-blank"><Favicon src={t.favicon} size={32} /></div>}
              {t.asleep && <span className="preview-sleep"><Icon name="sleep" size={12} /> Asleep</span>}
            </div>
            <div className="flip-caption">
              <Favicon src={t.favicon} />
              <span>{t.title}</span>
              <button
                className="flip-close"
                aria-label={`Close ${t.title}`}
                onClick={(e) => {
                  e.stopPropagation()
                  act('close', t.id)
                }}
              >
                <Icon name="close" size={10} />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="flip-none">No open tabs match “{q}”.</div>}
      </div>
      <div className="flip-hint">Press Enter to switch, Delete to close a tab, or Esc to go back.</div>
    </div>
  )
}

// ---- screen sharing picker ------------------------------------------------------------------------------------

function ScreenPicker({ origin, audio, sources }: { origin: string; audio: boolean; sources: ScreenSource[] }) {
  const [tab, setTab] = useState<'screen' | 'window'>('screen')
  const [picked, setPicked] = useState<string | null>(null)
  const [shareAudio, setShareAudio] = useState(false)
  const shown = sources.filter((s) => s.kind === tab)
  const pick = sources.find((s) => s.id === picked)
  return (
    <div className="screens" role="dialog" aria-label="Choose what to share">
      <div className="screens-head">
        <Icon name="pip" size={20} />
        <div>
          <div className="confirm-title">Choose what to share</div>
          <div className="confirm-msg">{origin.replace(/^https?:\/\//, '')} will be able to see what you choose.</div>
        </div>
      </div>
      <div className="screens-tabs" role="tablist">
        {(['screen', 'window'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>
            {k === 'screen' ? 'Entire screen' : 'Window'}
          </button>
        ))}
      </div>
      <div className="screens-grid">
        {shown.map((s) => (
          <button
            key={s.id}
            className={`screen-card sel${picked === s.id ? ' is-selected' : ''}`}
            onClick={() => setPicked(s.id)}
            onDoubleClick={() => act('share', { id: s.id, audio: shareAudio })}
          >
            <img src={s.thumbnail} alt="" />
            <span className="screen-name">
              {s.icon && <img src={s.icon} width={16} height={16} alt="" />}
              {s.name}
            </span>
          </button>
        ))}
        {shown.length === 0 && <div className="panel-empty">Nothing to share here.</div>}
      </div>
      <div className="confirm-actions">
        {audio && pick?.kind === 'screen' && (
          <label className="screens-audio">
            <input type="checkbox" className="check" checked={shareAudio} onChange={(e) => setShareAudio(e.target.checked)} /> Also share system audio
          </label>
        )}
        <button className="btn" onClick={() => act('cancel')}>
          Cancel
        </button>
        <button className="btn is-default" disabled={!pick} onClick={() => act('share', { id: picked, audio: shareAudio })}>
          Share
        </button>
      </div>
    </div>
  )
}

// ---- command palette -------------------------------------------------------------------------------------------------

interface PaletteRow {
  kind: 'command' | 'tab' | 'url'
  id: string
  title: string
  subtitle: string
  shortcut: string | null
  icon: string
  favicon?: string | null
}

function Palette({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial)
  const [rows, setRows] = useState<PaletteRow[]>([])
  const [hot, setHot] = useState(0)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])
  useEffect(() => {
    let live = true
    void call<PaletteRow[]>('palette.query', q).then((r) => {
      if (!live) return
      setRows(r)
      setHot(0)
    })
    return () => {
      live = false
    }
  }, [q])
  const run = (r: PaletteRow) => act(r.kind, r.id)
  const groups: { label: string; rows: PaletteRow[] }[] = []
  for (const r of rows) {
    const label = r.kind === 'command' ? 'Commands' : r.kind === 'tab' ? 'Open tabs' : 'Favorites and history'
    const g = groups.find((x) => x.label === label)
    if (g) g.rows.push(r)
    else groups.push({ label, rows: [r] })
  }
  let n = -1
  return (
    <div
      className="palette"
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setHot((h) => Math.min(rows.length - 1, h + 1))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setHot((h) => Math.max(0, h - 1))
        } else if (e.key === 'Enter' && rows[hot]) run(rows[hot])
      }}
    >
      <div className="palette-search">
        <Icon name="command" size={18} />
        <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a command, or search tabs and history" aria-label="Command palette" />
      </div>
      <div className="palette-list" role="listbox">
        {groups.map((g) => (
          <Group key={g.label} label={g.label}>
            {g.rows.map((r) => {
              n++
              const idx = n
              return (
                <div key={`${r.kind}:${r.id}`} role="option" aria-selected={idx === hot} className={`pal-row sel${idx === hot ? ' is-selected' : ''}`} onMouseEnter={() => setHot(idx)} onClick={() => run(r)}>
                  <span className="pal-icon">{r.favicon !== undefined ? <Favicon src={r.favicon} /> : <Icon name={COMMAND_ICONS[r.icon] ?? r.icon} />}</span>
                  <span className="pal-title">{r.title}</span>
                  {r.kind !== 'command' && <span className="pal-sub">{r.subtitle.replace(/^https?:\/\//, '')}</span>}
                  {r.shortcut && <kbd>{r.shortcut}</kbd>}
                </div>
              )
            })}
          </Group>
        ))}
        {rows.length === 0 && <div className="panel-empty">Nothing matches “{q}”.</div>}
      </div>
    </div>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pal-group">
      <div className="pal-label">{label}</div>
      {children}
    </div>
  )
}
