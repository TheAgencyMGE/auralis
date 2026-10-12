// Sidebar gadgets, shared by the new tab page and the glass Sidebar panel
// beside every page. Each one does nothing while hidden: timers check
// document.hidden and videos pause, so an idle gadget costs no CPU.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CURRENCIES, WALLPAPERS, type Currency, type Settings, type Widgets } from '@shared/settings'
import { call } from './api'
import { Icon } from './icons'
import { weatherInfo } from './weather'
import { parseFeed, type Feed } from './feed'
import './gadgets.css'
import './gadgets-aqua.css'

/** Every gadget, in Sidebar order, with its label for the gadget list. */
export const GADGETS: { key: keyof Widgets; label: string; sidebar: boolean }[] = [
  { key: 'clock', label: 'Clock and greeting', sidebar: false },
  { key: 'topSites', label: 'Frequently visited sites', sidebar: false },
  { key: 'analogClock', label: 'Clock', sidebar: true },
  { key: 'weather', label: 'Weather', sidebar: true },
  { key: 'slideshow', label: 'Slide Show', sidebar: true },
  { key: 'news', label: 'Feed Headlines', sidebar: true },
  { key: 'currency', label: 'Currency', sidebar: true },
  { key: 'aquarium', label: 'Aquarium', sidebar: true },
  { key: 'notes', label: 'Notes', sidebar: true },
  { key: 'meter', label: 'Browser meter', sidebar: true }
]

export const hasSidebarGadgets = (w: Widgets) => GADGETS.some((g) => g.sidebar && w[g.key])

export function Gadgets({ s }: { s: Settings }) {
  const w = s.widgets
  return (
    <>
      {w.analogClock && <AnalogClockGadget />}
      {w.weather && <WeatherGadget settings={s} />}
      {w.slideshow && <SlideshowGadget />}
      {w.news && <HeadlinesGadget url={s.newsFeed} />}
      {w.currency && <CurrencyGadget s={s} />}
      {w.aquarium && (
        <section className="gadget aquarium" aria-label="Aquarium">
          <LiveVideo src="/live/tank.mp4" poster="/live/tank.webp" className="tank" />
        </section>
      )}
      {w.notes && <NotesGadget initial={s.notes} />}
      {w.meter && <MeterGadget />}
    </>
  )
}

/** Runs `fn` every `ms` while the document is visible (and once now). */
function useVisibleInterval(fn: () => void, ms: number, deps: unknown[]): void {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    ref.current()
    const t = window.setInterval(() => !document.hidden && ref.current(), ms)
    return () => window.clearInterval(t)
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * A muted, looping video that only plays while the page is visible and the
 * user hasn't asked for reduced motion; otherwise its poster stands still.
 */
export function LiveVideo({ src, poster, className }: { src: string; poster: string; className: string }) {
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

// ---- clock: the Swiss railway clock, hands turned once a second ------------------------------

let clockSource: Promise<string> | null = null

function AnalogClockGadget() {
  const host = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState('')
  useEffect(() => {
    let live = true
    let timer = 0
    clockSource ??= fetch('/art/clock.svg').then((r) => r.text())
    void clockSource.then((text) => {
      const el = host.current
      if (!live || !el) return
      // Our own bundled file, parsed as SVG (no scripts in it, none would run).
      const svg = document.importNode(new DOMParser().parseFromString(text, 'image/svg+xml').documentElement, true)
      svg.removeAttribute('width')
      svg.removeAttribute('height')
      svg.setAttribute('aria-hidden', 'true')
      el.replaceChildren(svg)
      const hand = (id: string) => svg.querySelector(`#${id}`)
      const [h, m, s] = [hand('hhand'), hand('mhand'), hand('shand')]
      let shown = -1
      const tick = () => {
        const d = new Date()
        if (!document.hidden) {
          const sec = d.getSeconds()
          const min = d.getMinutes()
          h?.setAttribute('transform', `rotate(${(d.getHours() % 12) * 30 + min * 0.5})`)
          m?.setAttribute('transform', `rotate(${min * 6})`)
          s?.setAttribute('transform', `rotate(${sec * 6})`)
          if (min !== shown) {
            shown = min
            setLabel(d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
          }
        }
        timer = window.setTimeout(tick, 1000 - d.getMilliseconds())
      }
      tick()
    })
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [])
  return (
    <section className="gadget analog" aria-label={label ? `Clock, ${label}` : 'Clock'}>
      <div ref={host} className="analog-face" />
    </section>
  )
}

// ---- slide show: the bundled photographs, one every eight seconds ------------------------

const SLIDES = Object.entries(WALLPAPERS).map(([id, w]) => ({ src: `/wallpapers/${id}.thumb.webp`, name: w.name, credit: w.credit }))

function SlideshowGadget() {
  const [i, setI] = useState(() => Math.floor(Math.random() * SLIDES.length))
  const [hover, setHover] = useState(false)
  useVisibleInterval(() => !hover && setI((n) => (n + 1) % SLIDES.length), 8000, [hover])
  const slide = SLIDES[i]
  const step = (d: number) => setI((n) => (n + d + SLIDES.length) % SLIDES.length)
  return (
    <section className="gadget slideshow" aria-label="Slide Show" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="slide-frame">
        <img key={slide.src} className="slide" src={slide.src} alt={`${slide.name}, photo by ${slide.credit}`} />
      </div>
      <div className="slide-bar">
        <button className="slide-btn" aria-label="Previous picture" onClick={() => step(-1)}>
          <Icon name="chevron-left" size={12} />
        </button>
        <span className="slide-name">{slide.name}</span>
        <button className="slide-btn" aria-label="Next picture" onClick={() => step(1)}>
          <Icon name="chevron-right" size={12} />
        </button>
      </div>
    </section>
  )
}

// ---- feed headlines -----------------------------------------------------------------

const PER_PAGE = 4

function HeadlinesGadget({ url }: { url: string }) {
  const [feed, setFeed] = useState<Feed | null>(null)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(0)
  const [hover, setHover] = useState(false)
  useVisibleInterval(
    () =>
      void call<{ text: string; url: string } | { error: string }>('feed.get', url).then((r) => {
        const f = 'text' in r ? parseFeed(r.text, r.url) : null
        setFeed(f)
        setError(!f)
      }),
    15 * 60_000,
    [url]
  )
  const pages = feed ? Math.max(1, Math.ceil(Math.min(feed.items.length, 20) / PER_PAGE)) : 1
  useVisibleInterval(() => !hover && setPage((p) => p + 1), 9000, [hover])
  const p = page % pages
  return (
    <section className="gadget headlines" aria-label="Feed Headlines" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="hl-head">
        <img src="/art/feed.svg" width={14} height={14} alt="" />
        <span title={feed?.title}>{feed?.title ?? 'Feed Headlines'}</span>
      </div>
      {error && <p className="gadget-msg">Headlines will appear when Auralis can reach the feed.</p>}
      {!feed && !error && <p className="gadget-msg">Loading headlines…</p>}
      {feed && (
        <ul className="hl-list">
          {feed.items.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE).map((it, n) => (
            <li key={`${p}-${n}`}>
              <button className="hl-item" title={it.summary || it.title} disabled={!it.link} onClick={() => it.link && void call('nav.go', it.link, 'newtab')}>
                {it.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      {feed && pages > 1 && (
        <div className="hl-pager">
          <button className="slide-btn" aria-label="Previous headlines" onClick={() => setPage((x) => (x % pages) + pages - 1)}>
            <Icon name="chevron-left" size={11} />
          </button>
          <span>
            {p + 1} of {pages}
          </span>
          <button className="slide-btn" aria-label="Next headlines" onClick={() => setPage((x) => x + 1)}>
            <Icon name="chevron-right" size={11} />
          </button>
        </div>
      )}
    </section>
  )
}

// ---- currency ---------------------------------------------------------------------

interface Rates {
  base?: string
  date?: string
  rates?: Record<string, number>
  error?: string
}

function CurrencyGadget({ s }: { s: Settings }) {
  const [rates, setRates] = useState<Rates | null>(null)
  const [amount, setAmount] = useState('1')
  const quotes = s.currencyQuotes
  useVisibleInterval(() => void call<Rates>('currency.get').then(setRates), 60 * 60_000, [s.currencyBase, quotes.join()])
  const n = Number(amount.replace(',', '.'))
  const fmt = (code: string, v: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: code, maximumFractionDigits: v >= 100 ? 0 : 2 }).format(v)
    } catch {
      return v.toFixed(2)
    }
  }
  const setQuote = (i: number, c: Currency) => {
    const next = [...quotes]
    next[i] = c
    void call('settings.set', { currencyQuotes: next })
  }
  return (
    <section className="gadget currency" aria-label="Currency">
      <div className="cur-row cur-base">
        <input className="cur-amount" value={amount} inputMode="decimal" aria-label="Amount" onChange={(e) => setAmount(e.target.value.slice(0, 12))} />
        <CurrencySelect value={s.currencyBase} label="From currency" onChange={(c) => void call('settings.set', { currencyBase: c })} />
      </div>
      {quotes.map((q, i) => {
        const r = q === s.currencyBase ? 1 : rates?.rates?.[q]
        return (
          <div className="cur-row" key={i}>
            <span className="cur-value">{r != null && Number.isFinite(n) ? fmt(q, n * r) : '–'}</span>
            <CurrencySelect value={q} label="To currency" onChange={(c) => setQuote(i, c)} />
          </div>
        )
      })}
      <div className="cur-note">{rates?.error ? 'Rates unavailable offline' : rates?.date ? `ECB reference rates, ${new Date(rates.date + 'T12:00').toLocaleDateString()}` : 'Loading rates…'}</div>
    </section>
  )
}

function CurrencySelect({ value, label, onChange }: { value: Currency; label: string; onChange: (c: Currency) => void }) {
  return (
    <select className="cur-code" value={value} aria-label={label} onChange={(e) => onChange(e.target.value as Currency)}>
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  )
}

// ---- weather ------------------------------------------------------------------------

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
  useVisibleInterval(
    () => void call<WeatherData>('weather.get').then(setData),
    15 * 60_000,
    [settings.weatherLocation?.lat, settings.weatherLocation?.lon, settings.temperatureUnit]
  )

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
      <label className="gadget-msg">
        {prompt}
        <input className="field" value={q} autoFocus={canCancel} onChange={(e) => setQ(e.target.value)} placeholder="City name" />
      </label>
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

// ---- notes and meter -----------------------------------------------------------------

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
  useVisibleInterval(() => void call<typeof m>('meter.get').then(setM), 2000, [])
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

/** The glossy "New" pill of every 2008 web page. */
export function NewBadge({ children = 'New' }: { children?: ReactNode }) {
  return <span className="new-badge">{children}</span>
}
