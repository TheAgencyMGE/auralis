// The new tab page: real photography, a search field, frequent sites, and
// a Sidebar of gadgets on the right, like Vista's desktop.
import { useEffect, useMemo, useState } from 'react'
import { ALL_WALLPAPER_IDS, NEW_GADGETS, NEW_WALLPAPERS, SEARCH_ENGINES, isFeedUrl, wallpaperInfo, type WallpaperId, type Settings } from '@shared/settings'
import { call, useSettings } from '@ui/api'
import { Favicon, Icon } from '@ui/icons'
import { GADGETS, Gadgets, LiveVideo, NewBadge, hasSidebarGadgets } from '@ui/gadgets'

interface Site {
  url: string
  title: string
  favicon: string | null
  accent: string | null
  host: string
}

export default function NewTab() {
  const [incognito, setIncognito] = useState<boolean | null>(null)
  useEffect(() => {
    void call<{ incognito: boolean }>('ntp.info').then((i) => setIncognito(i.incognito))
  }, [])
  if (incognito === null) return null
  return incognito ? <PrivateTab /> : <NormalTab />
}

/** InPrivate windows say plainly what is and isn't kept. */
function PrivateTab() {
  const s = useSettings()
  useEffect(() => {
    document.title = 'InPrivate'
  }, [])
  return (
    <div className="ntp tone-dark is-private">
      <div className="ntp-wall" style={{ backgroundImage: 'url(/wallpapers/aurora.webp)' }} />
      <div className="ntp-shade" />
      <main className="ntp-main">
        <div className="private-card">
          <img className="private-art" src="/art/icons/private.webp" width={64} height={64} alt="" />
          <h1>You’re browsing InPrivate</h1>
          <p>When you close every InPrivate window, Auralis forgets the pages you visited, cookies, site data and anything you typed into forms in this window.</p>
          <p>Files you download and favorites you add are kept. Your internet provider, employer or school, and the sites you visit, can still see what you do.</p>
        </div>
        <SearchBox engine={SEARCH_ENGINES[s.searchEngine].name} />
      </main>
    </div>
  )
}

function NormalTab() {
  const s = useSettings()
  const [sites, setSites] = useState<Site[] | null>(null)
  const [now, setNow] = useState(new Date())
  const [picker, setPicker] = useState(false)
  const [customize, setCustomize] = useState(false)
  const wp = wallpaperInfo(s.wallpaper, s.customWallpapers)
  // With the window's own Sidebar open, the page's gadget column steps aside.
  const hasGadgets = !s.sidebar && hasSidebarGadgets(s.widgets)

  useEffect(() => {
    document.title = 'New Tab'
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => {
    void call<Site[]>('ntp.topSites').then(setSites)
  }, [s.widgets.topSites])

  const greeting = useMemo(() => {
    const h = now.getHours()
    return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  }, [now])

  return (
    <div className={`ntp tone-${wp.tone}${hasGadgets ? '' : ' no-sidebar'}`}>
      <div className="ntp-wall" style={{ backgroundImage: `url(${wp.image})` }} />
      {wp.video && <LiveVideo key={wp.video} src={wp.video} poster={wp.image} className="ntp-live" />}
      <div className="ntp-shade" />

      <main className="ntp-main">
        {s.widgets.clock && (
          <div className="ntp-clock" aria-live="off">
            <div className="ntp-time">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
            <div className="ntp-date">
              {greeting}. {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>
        )}
        <SearchBox engine={SEARCH_ENGINES[s.searchEngine].name} />
        {s.widgets.topSites && sites && <TopSites sites={sites} onRemove={(h) => setSites((x) => x?.filter((y) => y.host !== h) ?? null)} />}
      </main>

      {hasGadgets && (
      <aside className="sidebar" aria-label="Gadgets">
        <Gadgets s={s} />
      </aside>
      )}

      <footer className="ntp-foot">
        <button className="ntp-chip" onClick={() => setPicker((p) => !p)} aria-expanded={picker}>
          <Icon name="sun" size={14} /> Wallpaper
        </button>
        <button className="ntp-chip" onClick={() => setCustomize((p) => !p)} aria-expanded={customize}>
          <Icon name="spaces" size={14} /> Gadgets
        </button>
        {wp.source && (
          <a className="ntp-credit" href={wp.source} onClick={(e) => (e.preventDefault(), void call('nav.go', wp.source))}>
            {wp.live ? 'Video' : 'Photo'} by {wp.credit} on {wp.live ? 'Pexels' : 'Unsplash'}
          </a>
        )}
      </footer>

      {picker && <WallpaperPicker s={s} onClose={() => setPicker(false)} />}
      {customize && <GadgetPicker s={s} onClose={() => setCustomize(false)} />}
    </div>
  )
}

function SearchBox({ engine }: { engine: string }) {
  const [q, setQ] = useState('')
  return (
    <form
      className="ntp-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        if (q.trim()) void call('nav.go', q)
      }}
    >
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search with ${engine} or enter an address`} aria-label="Search or enter address" />
      <button type="submit" className="ntp-search-go" aria-label="Search">
        <Icon name="search" size={18} />
      </button>
    </form>
  )
}

function TopSites({ sites, onRemove }: { sites: Site[]; onRemove: (host: string) => void }) {
  // Aqua shows empty channel slots, like the Wii menu; Modern hides them.
  const empty = Array.from({ length: Math.max(0, 8 - sites.length) }, (_, i) => <span key={`empty-${i}`} className="tile tile-empty" aria-hidden />)
  return (
    <nav className={`tiles${sites.length ? '' : ' is-empty'}`} aria-label="Frequently visited">
      {!sites.length && <p className="ntp-empty">The sites you visit most will gather here.</p>}
      {sites.map((site) => (
        <a
          key={site.url}
          className="tile"
          href={site.url}
          style={{ '--accent': site.accent ?? '#6fc3ff' } as React.CSSProperties}
          onClick={(e) => {
            e.preventDefault()
            void call('nav.go', site.url, e.ctrlKey || e.button === 1 ? 'background' : 'current')
          }}
          onAuxClick={(e) => {
            if (e.button === 1) {
              e.preventDefault()
              void call('nav.go', site.url, 'background')
            }
          }}
        >
          <span className="tile-jewel">
            <Favicon src={site.favicon} size={28} />
          </span>
          <span className="tile-title">{site.title.split(/[|\-–—:]/)[0].trim() || site.host}</span>
          <button
            className="tile-remove"
            aria-label={`Remove ${site.host}`}
            title="Don’t show this site"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void call('ntp.removeTopSite', site.host)
              onRemove(site.host)
            }}
          >
            <Icon name="close" size={9} />
          </button>
        </a>
      ))}
      {empty}
    </nav>
  )
}

// ---- customisation -----------------------------------------------------------------------

function WallpaperPicker({ s, onClose }: { s: Settings; onClose: () => void }) {
  const current = s.wallpaper
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const add = async () => {
    setBusy(true)
    const r = await call<{ added: number; errors: string[] }>('wallpaper.import').finally(() => setBusy(false))
    setErrors(r.errors)
  }
  const live = ALL_WALLPAPER_IDS.filter((id) => id.startsWith('live:'))
  const photos = ALL_WALLPAPER_IDS.filter((id) => !id.startsWith('live:'))
  const tile = (id: WallpaperId) => {
    const w = wallpaperInfo(id)
    return (
      <button key={id} className={`wp-thumb${id === current ? ' is-on' : ''}`} onClick={() => void call('settings.set', { wallpaper: id })} aria-pressed={id === current}>
        <img src={w.thumb} alt="" />
        <span>
          {w.name}
          {NEW_WALLPAPERS.includes(id) && <NewBadge />}
        </span>
      </button>
    )
  }
  return (
    <div className="ntp-panel wp-panel" role="dialog" aria-label="Choose a wallpaper">
      <div className="ntp-panel-head">
        <span>Wallpaper</span>
        <button className="glass-x" aria-label="Close" onClick={onClose}>
          <Icon name="close" size={10} />
        </button>
      </div>
      <div className="wp-section">Yours</div>
      <div className="wp-grid">
        {s.customWallpapers.map((c) => {
          const id = `custom:${c.id}` as WallpaperId
          const w = wallpaperInfo(id, s.customWallpapers)
          return (
            <div key={c.id} className={`wp-thumb wp-own${id === current ? ' is-on' : ''}`}>
              <button className="wp-own-pick" onClick={() => void call('settings.set', { wallpaper: id })} aria-pressed={id === current} title={c.name}>
                {w.thumb ? <img src={w.thumb} alt="" /> : <span className="wp-own-blank"><Icon name={c.kind === 'video' ? 'video' : 'image'} size={22} /></span>}
                <span>
                  {c.kind === 'video' && <Icon name="video" size={11} className="wp-own-kind" />}
                  {c.name}
                </span>
              </button>
              <button className="wp-own-x" aria-label={`Remove ${c.name}`} title="Remove" onClick={() => void call('wallpaper.remove', c.id)}>
                <Icon name="close" size={8} />
              </button>
            </div>
          )
        })}
        <button className="wp-thumb wp-add" onClick={() => void add()} disabled={busy}>
          <span className="wp-add-box">
            <Icon name="plus" size={22} />
          </span>
          <span>{busy ? 'Adding…' : 'Add your own…'}</span>
        </button>
      </div>
      {errors.length > 0 && (
        <div className="wp-errors" role="alert">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}
      <div className="wp-section">Live</div>
      <div className="wp-grid">{live.map(tile)}</div>
      <div className="wp-section">Photos</div>
      <div className="wp-grid">{photos.map(tile)}</div>
    </div>
  )
}

function GadgetPicker({ s, onClose }: { s: Settings; onClose: () => void }) {
  const [feed, setFeed] = useState(s.newsFeed)
  useEffect(() => setFeed(s.newsFeed), [s.newsFeed])
  return (
    <div className="ntp-panel gadget-panel" role="dialog" aria-label="Gadgets">
      <div className="ntp-panel-head">
        <span>Show on new tabs</span>
        <button className="glass-x" aria-label="Close" onClick={onClose}>
          <Icon name="close" size={10} />
        </button>
      </div>
      {GADGETS.map((it) => (
        <label key={it.key} className="gp-row">
          <span>
            {it.label}
            {NEW_GADGETS.includes(it.key) && <NewBadge />}
          </span>
          <input type="checkbox" className="toggle" checked={s.widgets[it.key]} onChange={(e) => void call('settings.set', { widgets: { [it.key]: e.target.checked } })} />
        </label>
      ))}
      {s.widgets.news && (
        <label className="gp-row">
          <span>Headlines feed</span>
          <input
            className={`field gp-feed${isFeedUrl(feed) ? '' : ' is-invalid'}`}
            value={feed}
            aria-label="Feed address for Feed Headlines"
            onChange={(e) => setFeed(e.target.value)}
            onBlur={() => isFeedUrl(feed) && feed !== s.newsFeed && void call('settings.set', { newsFeed: feed })}
          />
        </label>
      )}
      <label className="gp-row">
        <span>Aero sounds</span>
        <input type="checkbox" className="toggle" checked={s.aeroSounds} onChange={(e) => void call('settings.set', { aeroSounds: e.target.checked })} />
      </label>
      <label className="gp-row">
        <span>Temperature</span>
        <select className="field" value={s.temperatureUnit} onChange={(e) => void call('settings.set', { temperatureUnit: e.target.value })}>
          <option value="c">Celsius</option>
          <option value="f">Fahrenheit</option>
        </select>
      </label>
    </div>
  )
}
