// The new tab page: real photography, a search field, frequent sites, and
// a Sidebar of gadgets on the right — Vista's desktop, as a start page.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ALL_WALLPAPER_IDS, SEARCH_ENGINES, wallpaperInfo, type WallpaperId, type Settings } from '@shared/settings'
import { call, useSettings } from '@ui/api'
import { Favicon, Icon } from '@ui/icons'
import { weatherInfo } from '../weather'

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
          <img className="private-art" src="/emoji/detective.webp" width={64} height={64} alt="" />
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
  const wp = wallpaperInfo(s.wallpaper)
  const hasGadgets = s.widgets.weather || s.widgets.notes || s.widgets.meter || s.widgets.aquarium

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
        {s.widgets.weather && <WeatherGadget settings={s} />}
        {s.widgets.aquarium && (
          <section className="gadget aquarium" aria-label="Aquarium">
            <LiveVideo src="/live/tank.mp4" poster="/live/tank.webp" className="tank" />
          </section>
        )}
        {s.widgets.notes && <NotesGadget initial={s.notes} />}
        {s.widgets.meter && <MeterGadget />}
      </aside>
      )}

      <footer className="ntp-foot">
        <button className="ntp-chip" onClick={() => setPicker((p) => !p)} aria-expanded={picker}>
          <Icon name="sun" size={14} /> Wallpaper
        </button>
        <button className="ntp-chip" onClick={() => setCustomize((p) => !p)} aria-expanded={customize}>
          <Icon name="spaces" size={14} /> Gadgets
        </button>
        <a className="ntp-credit" href={wp.source} onClick={(e) => (e.preventDefault(), void call('nav.go', wp.source))}>
          {wp.live ? 'Video' : 'Photo'} by {wp.credit} on {wp.live ? 'Pexels' : 'Unsplash'}
        </a>
      </footer>

      {picker && <WallpaperPicker current={s.wallpaper} onClose={() => setPicker(false)} />}
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
  if (!sites.length) {
    return <p className="ntp-empty">The sites you visit most will gather here.</p>
  }
  return (
    <nav className="tiles" aria-label="Frequently visited">
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
    </nav>
  )
}

// ---- gadgets --------------------------------------------------------------------------

interface WeatherData {
  needsLocation?: boolean
  error?: string
  location?: string
  unit?: 'c' | 'f'
  current?: { temperature_2m: number; apparent_temperature: number; weather_code: number; is_day: number; wind_speed_10m: number; relative_humidity_2m: number }
  daily?: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; weather_code: number[] }
}

function WeatherGadget({ settings }: { settings: Settings }) {
  const [data, setData] = useState<WeatherData | null>(null)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    let live = true
    const load = () => void call<WeatherData>('weather.get').then((d) => live && setData(d))
    load()
    const t = window.setInterval(load, 15 * 60_000)
    return () => {
      live = false
      window.clearInterval(t)
    }
  }, [settings.weatherLocation?.lat, settings.weatherLocation?.lon, settings.temperatureUnit])

  if (!data || editing || data.needsLocation) {
    return (
      <section className="gadget weather is-setup">
        <LocationSearch
          prompt={data?.needsLocation ? 'Show the weather for' : 'Change location'}
          onDone={() => setEditing(false)}
          canCancel={!data?.needsLocation && !!data}
        />
      </section>
    )
  }
  if (data.error || !data.current) {
    return (
      <section className="gadget weather">
        <p className="gadget-msg">Weather is unavailable offline. It will refresh when you’re connected.</p>
      </section>
    )
  }
  const c = data.current
  const info = weatherInfo(c.weather_code, !!c.is_day)
  const unit = data.unit === 'f' ? '°F' : '°C'
  return (
    <section className="gadget weather" aria-label={`Weather in ${data.location}`}>
      <div className="w-now">
        <img className="weather-art" src={info.art} width={74} height={74} alt="" />
        <div className="w-temp">
          {Math.round(c.temperature_2m)}
          <span>°</span>
        </div>
      </div>
      <div className="w-cond">{info.label}</div>
      <button className="w-place" onClick={() => setEditing(true)} title="Change location">
        {data.location?.split(',')[0]}
      </button>
      <div className="w-meta">
        Feels like {Math.round(c.apparent_temperature)}
        {unit}, humidity {Math.round(c.relative_humidity_2m)}%
      </div>
      {data.daily && (
        <div className="w-days">
          {data.daily.time.slice(1, 5).map((d, i) => (
            <div key={d} className="w-day">
              <span>{new Date(d + 'T12:00').toLocaleDateString([], { weekday: 'short' })}</span>
              <img className="weather-art" src={weatherInfo(data.daily!.weather_code[i + 1]).art} width={26} height={26} alt="" />
              <span className="w-hi">{Math.round(data.daily!.temperature_2m_max[i + 1])}°</span>
              <span className="w-lo">{Math.round(data.daily!.temperature_2m_min[i + 1])}°</span>
            </div>
          ))}
        </div>
      )}
      <div className="w-credit">Weather data by Open-Meteo</div>
    </section>
  )
}

function LocationSearch({ prompt, onDone, canCancel }: { prompt: string; onDone: () => void; canCancel: boolean }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ name: string; lat: number; lon: number }[]>([])
  const timer = useRef<number | null>(null)
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    if (q.trim().length < 2) return setResults([])
    timer.current = window.setTimeout(() => void call<typeof results>('geo.search', q).then(setResults), 250)
  }, [q])
  return (
    <div className="loc">
      <label className="gadget-msg" htmlFor="loc-q">
        {prompt}
      </label>
      <input id="loc-q" className="field" value={q} autoFocus={canCancel} onChange={(e) => setQ(e.target.value)} placeholder="City name" />
      <div className="loc-results">
        {results.map((r) => (
          <button
            key={`${r.lat},${r.lon}`}
            className="loc-row"
            onClick={() => {
              void call('settings.set', { weatherLocation: r })
              onDone()
            }}
          >
            {r.name}
          </button>
        ))}
      </div>
      {canCancel && (
        <button className="loc-cancel" onClick={onDone}>
          Cancel
        </button>
      )}
    </div>
  )
}

function NotesGadget({ initial }: { initial: string }) {
  const [text, setText] = useState(initial)
  const timer = useRef<number | null>(null)
  const dirty = useRef(false)
  useEffect(() => {
    if (!dirty.current) setText(initial)
  }, [initial])
  const save = (v: string) => {
    dirty.current = true
    setText(v)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      void call('settings.set', { notes: v })
      dirty.current = false
    }, 500)
  }
  return (
    <section className="gadget notes">
      <textarea value={text} onChange={(e) => save(e.target.value)} placeholder="Jot something down…" aria-label="Notes" spellCheck />
    </section>
  )
}

function MeterGadget() {
  const [m, setM] = useState<{ memoryMB: number; cpu: number; tabs: number; sleeping: number; blocked: number } | null>(null)
  useEffect(() => {
    let live = true
    const load = () => !document.hidden && void call<typeof m>('meter.get').then((v) => live && setM(v))
    load()
    const t = window.setInterval(load, 2000)
    return () => {
      live = false
      window.clearInterval(t)
    }
  }, [])
  const cpu = Math.min(100, m?.cpu ?? 0)
  const memPct = Math.min(100, ((m?.memoryMB ?? 0) / 4096) * 100)
  return (
    <section className="gadget meter" aria-label="Browser meter">
      <Bar label="CPU" value={cpu} text={`${Math.round(cpu)}%`} />
      <Bar label="Memory" value={memPct} text={m ? (m.memoryMB >= 1024 ? `${(m.memoryMB / 1024).toFixed(1)} GB` : `${m.memoryMB} MB`) : '–'} />
      <div className="meter-facts">
        <span>{m?.tabs ?? 0} tabs</span>
        <span>{m?.sleeping ?? 0} asleep</span>
        <span>{m?.blocked ?? 0} blocked</span>
      </div>
    </section>
  )
}

/** A labelled Vista progress bar. */
function Bar({ label, value, text }: { label: string; value: number; text: string }) {
  return (
    <div className="meter-row">
      <span className="meter-label">{label}</span>
      <span className="meter-bar">
        <span style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </span>
      <span className="meter-value">{text}</span>
    </div>
  )
}

// ---- customisation -----------------------------------------------------------------------

/**
 * A muted, looping video that only plays while the page is visible and the
 * user hasn't asked for reduced motion; otherwise its poster stands still.
 */
function LiveVideo({ src, poster, className }: { src: string; poster: string; className: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sync = () => {
      if (document.hidden || still) v.pause()
      else void v.play().catch(() => {})
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [src])
  return <video ref={ref} className={className} src={src} poster={poster} muted loop playsInline preload="auto" aria-hidden />
}

function WallpaperPicker({ current, onClose }: { current: WallpaperId; onClose: () => void }) {
  const live = ALL_WALLPAPER_IDS.filter((id) => id.startsWith('live:'))
  const photos = ALL_WALLPAPER_IDS.filter((id) => !id.startsWith('live:'))
  const tile = (id: WallpaperId) => {
    const w = wallpaperInfo(id)
    return (
      <button key={id} className={`wp-thumb${id === current ? ' is-on' : ''}`} onClick={() => void call('settings.set', { wallpaper: id })} aria-pressed={id === current}>
        <img src={w.thumb} alt="" />
        <span>{w.name}</span>
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
      <div className="wp-section">Live</div>
      <div className="wp-grid">{live.map(tile)}</div>
      <div className="wp-section">Photos</div>
      <div className="wp-grid">{photos.map(tile)}</div>
    </div>
  )
}

function GadgetPicker({ s, onClose }: { s: Settings; onClose: () => void }) {
  const items: { key: keyof Settings['widgets']; label: string }[] = [
    { key: 'clock', label: 'Clock and greeting' },
    { key: 'topSites', label: 'Frequently visited sites' },
    { key: 'weather', label: 'Weather' },
    { key: 'notes', label: 'Notes' },
    { key: 'aquarium', label: 'Aquarium' },
    { key: 'meter', label: 'Browser meter' }
  ]
  return (
    <div className="ntp-panel gadget-panel" role="dialog" aria-label="Gadgets">
      <div className="ntp-panel-head">
        <span>Show on new tabs</span>
        <button className="glass-x" aria-label="Close" onClick={onClose}>
          <Icon name="close" size={10} />
        </button>
      </div>
      {items.map((it) => (
        <label key={it.key} className="gp-row">
          <span>{it.label}</span>
          <input type="checkbox" className="toggle" checked={s.widgets[it.key]} onChange={(e) => void call('settings.set', { widgets: { [it.key]: e.target.checked } })} />
        </label>
      ))}
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
