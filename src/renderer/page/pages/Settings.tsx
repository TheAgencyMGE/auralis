import { useEffect, useState } from 'react'
import { FRAME_COLORS, SEARCH_ENGINES, SLEEP_OPTIONS, type FrameColorId, type SearchEngineId, type Settings } from '@shared/settings'
import { call, relativeTime, useSettings } from '@ui/api'
import { Icon } from '@ui/icons'
import { Group, Row, Shell } from '../Shell'

const set = (patch: Partial<Settings>) => void call('settings.set', patch)

const SECTIONS = [
  { id: 'appearance', label: 'Appearance', icon: 'sun' },
  { id: 'startup', label: 'Startup and home', icon: 'home' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'privacy', label: 'Privacy and Shield', icon: 'shield' },
  { id: 'permissions', label: 'Site permissions', icon: 'lock' },
  { id: 'clear', label: 'Clear browsing data', icon: 'trash' },
  { id: 'performance', label: 'Tabs and performance', icon: 'gauge' },
  { id: 'downloads', label: 'Downloads', icon: 'download' },
  { id: 'import', label: 'Import and export', icon: 'star' }
]

export default function SettingsPage() {
  const s = useSettings()
  useEffect(() => {
    document.title = 'Settings'
    const id = location.hash.slice(1)
    if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
  }, [])
  const pane = (
    <nav className="cp-nav" aria-label="Settings sections">
      {SECTIONS.map((x) => (
        <a key={x.id} href={`#${x.id}`}>
          <Icon name={x.icon} />
          {x.label}
        </a>
      ))}
    </nav>
  )
  return (
    <Shell icon="settings" title="Settings" subtitle="Choose how Auralis looks, starts and protects you." pane={pane}>
      <Appearance s={s} />
      <Startup s={s} />
      <Search s={s} />
      <Privacy s={s} />
      <Permissions />
      <ClearData />
      <Performance s={s} />
      <Downloads s={s} />
      <ImportExport />
    </Shell>
  )
}

function Appearance({ s }: { s: Settings }) {
  return (
    <Group id="appearance" title="Window color and appearance" intro="Pick the color of the glass. It tints the frame, menus and previews.">
      <div className="colors" role="radiogroup" aria-label="Window color">
        {(Object.keys(FRAME_COLORS) as FrameColorId[]).map((id) => (
          <button
            key={id}
            role="radio"
            aria-checked={s.frameColor === id}
            className={`color-swatch${s.frameColor === id ? ' is-on' : ''}`}
            style={{ '--c': FRAME_COLORS[id].tint } as React.CSSProperties}
            onClick={() => set({ frameColor: id })}
          >
            <span className="chip" />
            {FRAME_COLORS[id].name}
          </button>
        ))}
      </div>
      <Row label="Color intensity" htmlFor="intensity">
        <input id="intensity" type="range" className="slider" min={0} max={100} value={s.glassIntensity} onChange={(e) => set({ glassIntensity: Number(e.target.value) })} />
      </Row>
      <Row label="Enable transparency" help="Lets the desktop show through the frame, blurred. Turn off for a solid frame." htmlFor="transp">
        <input id="transp" type="checkbox" className="toggle" checked={s.transparency} onChange={(e) => set({ transparency: e.target.checked })} />
      </Row>
      <Row label="Show the Favorites bar" htmlFor="favbar">
        <input id="favbar" type="checkbox" className="toggle" checked={s.showBookmarksBar} onChange={(e) => set({ showBookmarksBar: e.target.checked })} />
      </Row>
      <Row label="Show the status bar" help="Shows link addresses, zoom and how much the Shield blocked." htmlFor="statusbar">
        <input id="statusbar" type="checkbox" className="toggle" checked={s.showStatusBar} onChange={(e) => set({ showStatusBar: e.target.checked })} />
      </Row>
      <Row label="Show the Home button" htmlFor="homebtn">
        <input id="homebtn" type="checkbox" className="toggle" checked={s.showHomeButton} onChange={(e) => set({ showHomeButton: e.target.checked })} />
      </Row>
      <Row label="Aero sounds" help="A water drop when you add a favorite and a glass chime when a download finishes." htmlFor="sounds">
        <input id="sounds" type="checkbox" className="toggle" checked={s.aeroSounds} onChange={(e) => set({ aeroSounds: e.target.checked })} />
      </Row>
      <Row label="Startup sound" help="A wind chime when Auralis starts." htmlFor="startsound">
        <input id="startsound" type="checkbox" className="toggle" checked={s.startupSound} onChange={(e) => set({ startupSound: e.target.checked })} />
      </Row>
      <Row label="Startup splash" help="The globe fades in on the glass for a moment when Auralis starts." htmlFor="splash">
        <input id="splash" type="checkbox" className="toggle" checked={s.splash} onChange={(e) => set({ splash: e.target.checked })} />
      </Row>
      <Row label="Busy pointer while pages load" help="The Aero “working in background” pointer shows until the page has loaded." htmlFor="busy">
        <input id="busy" type="checkbox" className="toggle" checked={s.busyCursor} onChange={(e) => set({ busyCursor: e.target.checked })} />
      </Row>
      <Row label="Show the Sidebar" help="Gadgets on the glass beside every page." htmlFor="sidebar">
        <input id="sidebar" type="checkbox" className="toggle" checked={s.sidebar} onChange={(e) => set({ sidebar: e.target.checked })} />
      </Row>
      <Row label="Preview tabs on hover" help="A thumbnail of the page appears when you rest the pointer on a tab." htmlFor="previews">
        <input id="previews" type="checkbox" className="toggle" checked={s.tabPreviews} onChange={(e) => set({ tabPreviews: e.target.checked })} />
      </Row>
    </Group>
  )
}

function Startup({ s }: { s: Settings }) {
  const [home, setHome] = useState(s.homePage)
  useEffect(() => setHome(s.homePage), [s.homePage])
  return (
    <Group id="startup" title="Startup and home">
      <div role="radiogroup" aria-label="When Auralis starts">
        {(
          [
            ['restore', 'Continue where you left off', 'Your tabs come back asleep and load when you click them.'],
            ['newtab', 'Open a new tab', ''],
            ['home', 'Open the home page', '']
          ] as const
        ).map(([v, label, help]) => (
          <label key={v} className="cp-row">
            <input type="radio" name="startup" checked={s.startup === v} onChange={() => set({ startup: v })} />
            <span className="cp-row-text">
              {label}
              {help && <small>{help}</small>}
            </span>
          </label>
        ))}
      </div>
      <Row label="Default browser" help="Windows lets you choose your default browser in Settings. Pick Auralis under Default apps.">
        <button className="btn" onClick={() => void call('app.defaultBrowser')}>
          Open Default apps
        </button>
      </Row>
      <Row label="Home page" htmlFor="home">
        <input
          id="home"
          className="field"
          style={{ width: 300 }}
          value={home}
          onChange={(e) => setHome(e.target.value)}
          onBlur={() => set({ homePage: /^[a-z]+:/i.test(home) ? home : `https://${home}` })}
        />
      </Row>
    </Group>
  )
}

function Search({ s }: { s: Settings }) {
  return (
    <Group id="search" title="Search">
      <Row label="Search engine used in the address bar" htmlFor="engine">
        <select id="engine" className="field" value={s.searchEngine} onChange={(e) => set({ searchEngine: e.target.value as SearchEngineId })}>
          {(Object.keys(SEARCH_ENGINES) as SearchEngineId[]).map((id) => (
            <option key={id} value={id}>
              {SEARCH_ENGINES[id].name}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Show search suggestions" help="What you type in the address bar is sent to your search engine to suggest searches." htmlFor="sugg">
        <input id="sugg" type="checkbox" className="toggle" checked={s.searchSuggestions} onChange={(e) => set({ searchSuggestions: e.target.checked })} />
      </Row>
    </Group>
  )
}

function Privacy({ s }: { s: Settings }) {
  const [stats, setStats] = useState<{ ready: boolean; updated: number; totalBlocked: number; safety: { hosts: number; updated: number } } | null>(null)
  useEffect(() => {
    void call<typeof stats>('shield.stats').then(setStats)
  }, [])
  return (
    <Group id="privacy" title="Privacy and Shield" intro="The Shield blocks ads and trackers before they load, so pages are lighter and fewer companies follow you around.">
      <Row
        label="Block ads and trackers"
        help={stats ? (stats.ready ? `Filter lists updated ${relativeTime(stats.updated)}. ${stats.totalBlocked.toLocaleString()} requests blocked since Auralis started.` : 'Filter lists download the first time you’re online.') : ''}
        htmlFor="shield"
      >
        <input id="shield" type="checkbox" className="toggle" checked={s.shieldEnabled} onChange={(e) => set({ shieldEnabled: e.target.checked })} />
      </Row>
      {s.shieldAllowlist.length > 0 && (
        <div className="cp-row" style={{ alignItems: 'flex-start' }}>
          <span className="cp-row-text">
            Sites where the Shield is off
            <small>Turn the Shield back on from the site’s lock icon, or remove it here.</small>
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 240 }}>
            {s.shieldAllowlist.map((h) => (
              <div key={h} className="row sel" style={{ minHeight: 26 }}>
                <span className="row-title">{h}</span>
                <span style={{ flex: 1 }} />
                <button className="icon-btn" aria-label={`Remove ${h}`} onClick={() => set({ shieldAllowlist: s.shieldAllowlist.filter((x) => x !== h) })}>
                  <Icon name="close" size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {s.popupAllowlist.length > 0 && (
        <div className="cp-row" style={{ alignItems: 'flex-start' }}>
          <span className="cp-row-text">
            Sites allowed to open pop-ups
            <small>Every other site needs a click before it can open a pop-up.</small>
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 240 }}>
            {s.popupAllowlist.map((h) => (
              <div key={h} className="row sel" style={{ minHeight: 26 }}>
                <span className="row-title">{h}</span>
                <span style={{ flex: 1 }} />
                <button className="icon-btn" aria-label={`Remove ${h}`} onClick={() => set({ popupAllowlist: s.popupAllowlist.filter((x) => x !== h) })}>
                  <Icon name="close" size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <Row
        label="Warn me about dangerous sites"
        help={
          stats?.safety.hosts
            ? `Checks every site you open against ${stats.safety.hosts.toLocaleString()} reported phishing and malware sites, on this computer. Lists updated ${relativeTime(stats.safety.updated)}.`
            : 'Checks sites against reported phishing and malware lists, on this computer. The lists download the first time you’re online.'
        }
        htmlFor="safe"
      >
        <input id="safe" type="checkbox" className="toggle" checked={s.safeBrowsing} onChange={(e) => set({ safeBrowsing: e.target.checked })} />
      </Row>
      <Row label="Always use secure connections" help="Auralis upgrades sites to HTTPS and asks before loading one that only works without it." htmlFor="https">
        <input id="https" type="checkbox" className="toggle" checked={s.httpsFirst} onChange={(e) => set({ httpsFirst: e.target.checked })} />
      </Row>
      <Row label="Tell sites not to sell or share my data" help="Sends the Global Privacy Control signal, which some laws require sites to honor." htmlFor="gpc">
        <input id="gpc" type="checkbox" className="toggle" checked={s.globalPrivacyControl} onChange={(e) => set({ globalPrivacyControl: e.target.checked })} />
      </Row>
      <Row label="Check spelling as I type" htmlFor="spell">
        <input id="spell" type="checkbox" className="toggle" checked={s.spellcheck} onChange={(e) => set({ spellcheck: e.target.checked })} />
      </Row>
    </Group>
  )
}

const PERM_NAMES: Record<string, string> = { geolocation: 'Location', notifications: 'Notifications', camera: 'Camera', microphone: 'Microphone', 'clipboard-read': 'Clipboard', midi: 'MIDI devices', midiSysex: 'MIDI control' }

function Permissions() {
  const [rows, setRows] = useState<{ origin: string; permission: string; decision: string; updated: number }[]>([])
  const load = () => void call<typeof rows>('permissions.list').then(setRows)
  useEffect(load, [])
  return (
    <Group id="permissions" title="Site permissions" intro="Sites ask before using your location, camera, microphone or notifications. Your answers are remembered here.">
      {rows.length === 0 ? (
        <div className="cp-row">
          <span className="cp-row-text">
            <small>No site has asked yet.</small>
          </span>
        </div>
      ) : (
        <table className="grid-table">
          <thead>
            <tr>
              <th>Site</th>
              <th>Permission</th>
              <th>Decision</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.origin + r.permission}>
                <td className="name">{r.origin.replace(/^https?:\/\//, '')}</td>
                <td>{PERM_NAMES[r.permission] ?? r.permission}</td>
                <td>
                  <span className={`pill${r.decision === 'deny' ? ' is-sleep' : ''}`}>{r.decision === 'allow' ? 'Allowed' : 'Blocked'}</span>
                </td>
                <td className="num">
                  <button className="link-btn" onClick={() => void call('permissions.remove', r.origin, r.permission).then(load)}>
                    Reset
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Group>
  )
}

function ClearData() {
  const [range, setRange] = useState('3600000')
  const [what, setWhat] = useState({ history: true, cookies: false, cache: true, downloads: false, permissions: false, favicons: false })
  const [status, setStatus] = useState<'idle' | 'busy' | 'done'>('idle')
  const items: [keyof typeof what, string, string][] = [
    ['history', 'Browsing history', 'Pages you visited and what you typed in the address bar'],
    ['cookies', 'Cookies and site data', 'Signs you out of most sites'],
    ['cache', 'Cached images and files', 'Pages may load slower the next time'],
    ['downloads', 'Download list', 'The files themselves stay on your computer'],
    ['permissions', 'Site permissions', 'Sites will ask again'],
    ['favicons', 'Site icons', '']
  ]
  return (
    <Group id="clear" title="Clear browsing data">
      <Row label="Time range" htmlFor="range">
        <select id="range" className="field" value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="3600000">Last hour</option>
          <option value="86400000">Last 24 hours</option>
          <option value="604800000">Last 7 days</option>
          <option value="0">All time</option>
        </select>
      </Row>
      {items.map(([k, label, help]) => (
        <label key={k} className="cp-row">
          <input type="checkbox" className="check" checked={what[k]} onChange={(e) => setWhat({ ...what, [k]: e.target.checked })} />
          <span className="cp-row-text">
            {label}
            {help && <small>{help}</small>}
          </span>
        </label>
      ))}
      <div className="cp-footer">
        {status === 'done' && <span style={{ alignSelf: 'center', color: 'var(--life-deep)' }}>Cleared.</span>}
        <button
          className="btn is-default"
          disabled={status === 'busy' || !Object.values(what).some(Boolean)}
          onClick={async () => {
            setStatus('busy')
            const r = Number(range)
            await call('data.clear', { since: r ? Date.now() - r : null, what })
            setStatus('done')
          }}
        >
          {status === 'busy' ? 'Clearing…' : 'Clear now'}
        </button>
      </div>
    </Group>
  )
}

function Performance({ s }: { s: Settings }) {
  return (
    <Group id="performance" title="Tabs and performance" intro="Sleeping tabs give their memory back until you return to them. They wake with their back and forward history intact.">
      <Row label="Put inactive tabs to sleep after" htmlFor="sleep">
        <select id="sleep" className="field" value={s.sleepAfterMinutes} onChange={(e) => set({ sleepAfterMinutes: Number(e.target.value) as Settings['sleepAfterMinutes'] })}>
          {SLEEP_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m === 0 ? 'Never' : m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? 's' : ''}`}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Restore previous tabs asleep" help="Only the tab you were looking at loads at startup." htmlFor="rasleep">
        <input id="rasleep" type="checkbox" className="toggle" checked={s.restoreAsleep} onChange={(e) => set({ restoreAsleep: e.target.checked })} />
      </Row>
      <Row label="Default page zoom" htmlFor="zoom">
        <select id="zoom" className="field" value={s.defaultZoom} onChange={(e) => set({ defaultZoom: Number(e.target.value) })}>
          {[0.75, 0.9, 1, 1.1, 1.25, 1.5].map((z) => (
            <option key={z} value={z}>
              {Math.round(z * 100)}%
            </option>
          ))}
        </select>
      </Row>
    </Group>
  )
}

function Downloads({ s }: { s: Settings }) {
  return (
    <Group id="downloads" title="Downloads">
      <Row label="Save files to" help={s.downloadDir}>
        <button className="btn" onClick={() => void call('dialog.chooseFolder')}>
          Change…
        </button>
      </Row>
      <Row label="Ask where to save each file" htmlFor="ask">
        <input id="ask" type="checkbox" className="toggle" checked={s.askWhereToSave} onChange={(e) => set({ askWhereToSave: e.target.checked })} />
      </Row>
    </Group>
  )
}

function ImportExport() {
  const [msg, setMsg] = useState('')
  const run = async (source: string) => {
    setMsg('Importing…')
    const r = await call<{ count: number; notFound?: boolean; canceled?: boolean }>('bookmarks.import', source)
    setMsg(r.canceled ? '' : r.notFound ? `No ${source[0].toUpperCase() + source.slice(1)} profile was found on this computer.` : `Imported ${r.count} favorite${r.count === 1 ? '' : 's'}.`)
  }
  return (
    <Group id="import" title="Import and export favorites" intro="Bring your bookmarks from another browser. They arrive in a folder under Other favorites.">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => void run('chrome')}>
          From Chrome
        </button>
        <button className="btn" onClick={() => void run('edge')}>
          From Edge
        </button>
        <button className="btn" onClick={() => void run('brave')}>
          From Brave
        </button>
        <button className="btn" onClick={() => void run('html')}>
          From a bookmarks file…
        </button>
        <button
          className="btn"
          onClick={async () => {
            const r = await call<{ saved: boolean; path?: string }>('bookmarks.export')
            if (r.saved) setMsg(`Saved to ${r.path}`)
          }}
        >
          Export to a file…
        </button>
      </div>
      {msg && (
        <p role="status" style={{ marginTop: 10 }}>
          {msg}
        </p>
      )}
    </Group>
  )
}
