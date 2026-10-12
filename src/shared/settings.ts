// User settings: schema, defaults and a sanitizer that every write passes
// through. Anything that does not match the schema is replaced by the
// default, so a corrupted or hand-edited settings file can never crash the
// browser or smuggle in unexpected types.

export const SEARCH_ENGINES = {
  bing: { name: 'Bing', search: 'https://www.bing.com/search?q=%s', suggest: 'https://api.bing.com/osjson.aspx?query=%s' },
  google: { name: 'Google', search: 'https://www.google.com/search?q=%s', suggest: 'https://suggestqueries.google.com/complete/search?client=firefox&q=%s' },
  duckduckgo: { name: 'DuckDuckGo', search: 'https://duckduckgo.com/?q=%s', suggest: 'https://duckduckgo.com/ac/?type=list&q=%s' },
  brave: { name: 'Brave Search', search: 'https://search.brave.com/search?q=%s', suggest: 'https://search.brave.com/api/suggest?q=%s' },
  startpage: { name: 'Startpage', search: 'https://www.startpage.com/do/search?q=%s', suggest: null },
  ecosia: { name: 'Ecosia', search: 'https://www.ecosia.org/search?q=%s', suggest: 'https://ac.ecosia.org/autocomplete?type=list&q=%s' }
} as const

export type SearchEngineId = keyof typeof SEARCH_ENGINES

/** Vista's "Window Color and Appearance" swatches, retuned for 2026. */
export const FRAME_COLORS = {
  sky: { name: 'Sky', tint: '#1a9cf5' },
  aqua: { name: 'Aqua', tint: '#00b8e6' },
  lime: { name: 'Lime', tint: '#5cc81e' },
  twilight: { name: 'Twilight', tint: '#2f5fd0' },
  sea: { name: 'Sea', tint: '#00a8a8' },
  leaf: { name: 'Leaf', tint: '#3fae2a' },
  ruby: { name: 'Ruby', tint: '#d42a3c' },
  amber: { name: 'Amber', tint: '#f08c00' },
  rose: { name: 'Rose', tint: '#e8509a' },
  violet: { name: 'Violet', tint: '#8a4fe0' },
  graphite: { name: 'Graphite', tint: '#4a5a6c' },
  frost: { name: 'Frost', tint: '#8cc8ee' }
} as const

export type FrameColorId = keyof typeof FRAME_COLORS

export const WALLPAPERS = {
  meadow: { name: 'Meadow', credit: 'Tali Despins', source: 'https://unsplash.com/photos/FQkQxgO9Kh8', tone: 'light' },
  lagoon: { name: 'Lagoon', credit: 'Ibrahim Rifath', source: 'https://unsplash.com/photos/JgOlXp0Dlpc', tone: 'light' },
  cumulus: { name: 'Cumulus', credit: 'Kumiko Shimizu', source: 'https://unsplash.com/photos/lNxMcE8mvIM', tone: 'light' },
  deep: { name: 'Deep Water', credit: 'Sime Basioli', source: 'https://unsplash.com/photos/BRkikoNP0KQ', tone: 'dark' },
  dew: { name: 'Dew', credit: 'Elimende Inagella', source: 'https://unsplash.com/photos/lYj0dLgMHmA', tone: 'dark' },
  aurora: { name: 'Aurora', credit: 'v2osk', source: 'https://unsplash.com/photos/Ovn1hyBge38', tone: 'dark' },
  reef: { name: 'Reef', credit: 'NEOM', source: 'https://unsplash.com/photos/bOMVTvE2QFU', tone: 'light' },
  koi: { name: 'Koi Pond', credit: 'Anne Laure P', source: 'https://unsplash.com/photos/C4gUYeDV0Xo', tone: 'dark' },
  grass: { name: 'Morning Grass', credit: 'Aaron Burden', source: 'https://unsplash.com/photos/sI8V_ax011I', tone: 'light' },
  butterfly: { name: 'Butterfly', credit: 'Erik Karits', source: 'https://unsplash.com/photos/E3TZQOWh8IA', tone: 'light' },
  leaves: { name: 'Leaves', credit: 'Kumiko Shimizu', source: 'https://unsplash.com/photos/Pxa0yJ2Elxc', tone: 'light' }
} as const

/** Live wallpapers: real footage from Pexels (Pexels License), looped. */
export const LIVE_WALLPAPERS = {
  fields: { name: 'Rolling Fields', credit: 'Egor Kunovsky', source: 'https://www.pexels.com/video/3829702/', tone: 'light' },
  bubbles: { name: 'Bubbles', credit: 'Kindel Media', source: 'https://www.pexels.com/video/8823625/', tone: 'light' },
  sunbeams: { name: 'Sunbeams', credit: 'James Cheney', source: 'https://www.pexels.com/video/2632737/', tone: 'light' },
  dolphins: { name: 'Dolphins', credit: 'Nichola Peters', source: 'https://www.pexels.com/video/10802614/', tone: 'light' },
  koi: { name: 'Koi', credit: 'Samuel Sobrinho', source: 'https://www.pexels.com/video/3582903/', tone: 'light' },
  jellyfish: { name: 'Jellyfish', credit: 'Chris Munnik', source: 'https://www.pexels.com/video/4805827/', tone: 'dark' },
  droplet: { name: 'Droplet', credit: 'Pixabay', source: 'https://www.pexels.com/video/855494/', tone: 'light' },
  borealis: { name: 'Northern Lights', credit: 'Nico Becker', source: 'https://www.pexels.com/video/5600929/', tone: 'dark' },
  rain: { name: 'Rain on Glass', credit: 'Zuzanna Musial', source: 'https://www.pexels.com/video/5366344/', tone: 'light' },
  turbines: { name: 'Wind Farm', credit: 'Pixabay', source: 'https://www.pexels.com/video/855181/', tone: 'light' },
  dusk: { name: 'City at Dusk', credit: 'William Chen', source: 'https://www.pexels.com/video/14563249/', tone: 'light' },
  waterfall: { name: 'Rainforest Falls', credit: 'Greg Benson', source: 'https://www.pexels.com/video/10761087/', tone: 'dark' },
  shoal: { name: 'School of Fish', credit: 'Daniel Torobekov', source: 'https://www.pexels.com/video/5277924/', tone: 'dark' }
} as const

/** Wallpapers added in the latest release get a "New" badge in the picker. */
export const NEW_WALLPAPERS: readonly WallpaperId[] = ['live:rain', 'live:turbines', 'live:dusk', 'live:waterfall', 'live:shoal']

export type PhotoWallpaperId = keyof typeof WALLPAPERS
export type LiveWallpaperId = keyof typeof LIVE_WALLPAPERS
/** Live ids are stored as "live:<id>" so they never collide with photos. */
export type WallpaperId = PhotoWallpaperId | `live:${LiveWallpaperId}` | `custom:${string}`

/** A picture or video the user added; files live in the profile's wallpapers folder. */
export interface CustomWallpaper {
  id: string
  name: string
  kind: 'image' | 'video'
  /** file name inside the wallpapers folder */
  file: string
  /** whether a <id>.thumb.jpg exists */
  thumb: boolean
  tone: 'light' | 'dark'
}

export const ALL_WALLPAPER_IDS: WallpaperId[] = [
  ...(Object.keys(LIVE_WALLPAPERS) as LiveWallpaperId[]).map((k) => `live:${k}` as const),
  ...(Object.keys(WALLPAPERS) as PhotoWallpaperId[])
]

export interface WallpaperInfo {
  name: string
  credit: string
  source: string
  tone: 'light' | 'dark'
  live: boolean
  /** background image (for live wallpapers, the poster shown while loading) */
  image: string
  thumb: string
  video: string | null
}

export function wallpaperInfo(id: WallpaperId, custom: readonly CustomWallpaper[] = []): WallpaperInfo {
  if (id.startsWith('custom:')) {
    const c = custom.find((x) => `custom:${x.id}` === id)
    if (c) {
      const src = `/user-wallpapers/${c.file}`
      const thumb = c.thumb ? `/user-wallpapers/${c.id}.thumb.jpg` : ''
      return { name: c.name, credit: '', source: '', tone: c.tone, live: c.kind === 'video', image: c.kind === 'image' ? src : thumb, thumb: c.kind === 'image' ? thumb || src : thumb, video: c.kind === 'video' ? src : null }
    }
    return wallpaperInfo('live:fields')
  }
  if (id.startsWith('live:')) {
    const key = id.slice(5) as LiveWallpaperId
    const w = LIVE_WALLPAPERS[key] ?? LIVE_WALLPAPERS.fields
    return { ...w, live: true, image: `/live/${key}.webp`, thumb: `/live/${key}.thumb.webp`, video: `/live/${key}.mp4` }
  }
  const w = WALLPAPERS[id as PhotoWallpaperId] ?? WALLPAPERS.meadow
  return { ...w, live: false, image: `/wallpapers/${id}.webp`, thumb: `/wallpapers/${id}.thumb.webp`, video: null }
}

export const SLEEP_OPTIONS = [0, 5, 15, 30, 60, 120] as const

/** Currencies the currency gadget offers (ECB reference rates via Frankfurter). */
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'MXN', 'BRL', 'SEK', 'NOK', 'NZD', 'KRW', 'SGD', 'HKD', 'ZAR', 'PLN', 'TRY'] as const
export type Currency = (typeof CURRENCIES)[number]

export const DEFAULT_NEWS_FEED = 'https://feeds.bbci.co.uk/news/rss.xml'

export type Widgets = {
  clock: boolean
  weather: boolean
  notes: boolean
  meter: boolean
  topSites: boolean
  aquarium: boolean
  analogClock: boolean
  slideshow: boolean
  news: boolean
  currency: boolean
}

/** Gadgets added in the latest release get a "New" badge in the gadget list. */
export const NEW_GADGETS: readonly (keyof Widgets)[] = ['analogClock', 'slideshow', 'news', 'currency']

/** Aqua: the friendly, glossy side-tab look (default). Modern: Vista glass with tabs on top. */
export const UI_STYLES = ['aqua', 'modern'] as const
export type UiStyle = (typeof UI_STYLES)[number]

export interface Settings {
  uiStyle: UiStyle
  /** Aqua: the tab sidebar shrunk to icons */
  sidebarCompact: boolean
  startup: 'restore' | 'newtab' | 'home'
  homePage: string
  searchEngine: SearchEngineId
  searchSuggestions: boolean
  frameColor: FrameColorId
  glassIntensity: number
  transparency: boolean
  showBookmarksBar: boolean
  showStatusBar: boolean
  showHomeButton: boolean
  tabPreviews: boolean
  sleepAfterMinutes: (typeof SLEEP_OPTIONS)[number]
  shieldEnabled: boolean
  shieldAllowlist: string[]
  httpsFirst: boolean
  globalPrivacyControl: boolean
  downloadDir: string
  askWhereToSave: boolean
  wallpaper: WallpaperId
  customWallpapers: CustomWallpaper[]
  widgets: Widgets
  aeroSounds: boolean
  /** chime and glass splash when Auralis starts */
  startupSound: boolean
  splash: boolean
  /** the Aero "working in background" pointer while the page loads */
  busyCursor: boolean
  /** the glass gadget panel at the right of the window */
  sidebar: boolean
  newsFeed: string
  currencyBase: Currency
  currencyQuotes: Currency[]
  /** folders of unpacked extensions loaded at startup (developer mode) */
  unpackedExtensions: string[]
  /** warn before opening sites on the phishing and malware lists */
  safeBrowsing: boolean
  /** sites whose pop-ups are never blocked */
  popupAllowlist: string[]
  /** the Welcome Center has been shown once */
  welcomed: boolean
  weatherLocation: { name: string; lat: number; lon: number } | null
  temperatureUnit: 'c' | 'f'
  notes: string
  defaultZoom: number
  spellcheck: boolean
  restoreAsleep: boolean
  confirmCloseTabs: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  uiStyle: 'aqua',
  sidebarCompact: false,
  startup: 'restore',
  homePage: 'auralis://newtab',
  searchEngine: 'bing',
  searchSuggestions: true,
  frameColor: 'sky',
  glassIntensity: 70,
  transparency: true,
  showBookmarksBar: true,
  showStatusBar: true,
  showHomeButton: false,
  tabPreviews: true,
  sleepAfterMinutes: 30,
  shieldEnabled: true,
  shieldAllowlist: [],
  httpsFirst: true,
  globalPrivacyControl: true,
  downloadDir: '',
  askWhereToSave: false,
  wallpaper: 'live:fields',
  customWallpapers: [],
  widgets: { clock: true, weather: true, notes: true, meter: false, topSites: true, aquarium: true, analogClock: true, slideshow: false, news: false, currency: false },
  aeroSounds: true,
  startupSound: true,
  splash: true,
  busyCursor: true,
  sidebar: false,
  newsFeed: DEFAULT_NEWS_FEED,
  currencyBase: 'USD',
  currencyQuotes: ['EUR', 'GBP', 'JPY'],
  popupAllowlist: [],
  safeBrowsing: true,
  unpackedExtensions: [],
  welcomed: false,
  weatherLocation: null,
  temperatureUnit: 'c',
  notes: '',
  defaultZoom: 1,
  spellcheck: true,
  restoreAsleep: true,
  confirmCloseTabs: true
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const oneOf = <T extends string | number>(v: unknown, opts: readonly T[], d: T): T => (opts.includes(v as T) ? (v as T) : d)
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)
const num = (v: unknown, min: number, max: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d
const str = (v: unknown, max: number, d: string) => (typeof v === 'string' ? v.slice(0, max) : d)

export function isSafeHomePage(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'auralis:'
  } catch {
    return false
  }
}

function sanitizeCustomWallpapers(v: unknown, d: CustomWallpaper[]): CustomWallpaper[] {
  if (!Array.isArray(v)) return d
  const out: CustomWallpaper[] = []
  for (const w of v) {
    if (!isObj(w) || typeof w.id !== 'string' || !/^[a-f0-9]{16}$/.test(w.id)) continue
    if (typeof w.file !== 'string' || !new RegExp(`^${w.id}\\.[a-z0-9]{2,5}$`).test(w.file)) continue
    if (w.kind !== 'image' && w.kind !== 'video') continue
    if (out.some((x) => x.id === w.id)) continue
    out.push({ id: w.id, name: str(w.name, 80, 'Wallpaper'), kind: w.kind, file: w.file, thumb: w.thumb === true, tone: w.tone === 'dark' ? 'dark' : 'light' })
    if (out.length >= 50) break
  }
  return out
}

/** News feeds are fetched by the main process; only plain web URLs. */
export function isFeedUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export function sanitizeSettings(input: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const s = isObj(input) ? input : {}
  const d = base
  const w = isObj(s.widgets) ? s.widgets : {}
  const loc = isObj(s.weatherLocation) ? s.weatherLocation : null
  const homePage = str(s.homePage, 2048, d.homePage)
  const customWallpapers = sanitizeCustomWallpapers(s.customWallpapers, d.customWallpapers)
  return {
    uiStyle: oneOf(s.uiStyle, UI_STYLES, d.uiStyle),
    sidebarCompact: bool(s.sidebarCompact, d.sidebarCompact),
    startup: oneOf(s.startup, ['restore', 'newtab', 'home'] as const, d.startup),
    homePage: isSafeHomePage(homePage) ? homePage : d.homePage,
    searchEngine: oneOf(s.searchEngine, Object.keys(SEARCH_ENGINES) as SearchEngineId[], d.searchEngine),
    searchSuggestions: bool(s.searchSuggestions, d.searchSuggestions),
    frameColor: oneOf(s.frameColor, Object.keys(FRAME_COLORS) as FrameColorId[], d.frameColor),
    glassIntensity: Math.round(num(s.glassIntensity, 0, 100, d.glassIntensity)),
    transparency: bool(s.transparency, d.transparency),
    showBookmarksBar: bool(s.showBookmarksBar, d.showBookmarksBar),
    showStatusBar: bool(s.showStatusBar, d.showStatusBar),
    showHomeButton: bool(s.showHomeButton, d.showHomeButton),
    tabPreviews: bool(s.tabPreviews, d.tabPreviews),
    sleepAfterMinutes: oneOf(s.sleepAfterMinutes, SLEEP_OPTIONS, d.sleepAfterMinutes),
    shieldEnabled: bool(s.shieldEnabled, d.shieldEnabled),
    shieldAllowlist: Array.isArray(s.shieldAllowlist)
      ? [...new Set(s.shieldAllowlist.filter((h): h is string => typeof h === 'string' && /^[a-z0-9.-]{1,253}$/i.test(h)))].slice(0, 5000)
      : d.shieldAllowlist,
    httpsFirst: bool(s.httpsFirst, d.httpsFirst),
    globalPrivacyControl: bool(s.globalPrivacyControl, d.globalPrivacyControl),
    downloadDir: str(s.downloadDir, 1024, d.downloadDir),
    askWhereToSave: bool(s.askWhereToSave, d.askWhereToSave),
    customWallpapers,
    wallpaper:
      typeof s.wallpaper === 'string' && s.wallpaper.startsWith('custom:') && customWallpapers.some((c) => `custom:${c.id}` === s.wallpaper)
        ? (s.wallpaper as WallpaperId)
        : oneOf(s.wallpaper, ALL_WALLPAPER_IDS, d.wallpaper),
    widgets: {
      clock: bool(w.clock, d.widgets.clock),
      weather: bool(w.weather, d.widgets.weather),
      notes: bool(w.notes, d.widgets.notes),
      meter: bool(w.meter, d.widgets.meter),
      topSites: bool(w.topSites, d.widgets.topSites),
      aquarium: bool(w.aquarium, d.widgets.aquarium),
      analogClock: bool(w.analogClock, d.widgets.analogClock),
      slideshow: bool(w.slideshow, d.widgets.slideshow),
      news: bool(w.news, d.widgets.news),
      currency: bool(w.currency, d.widgets.currency)
    },
    aeroSounds: bool(s.aeroSounds, d.aeroSounds),
    startupSound: bool(s.startupSound, d.startupSound),
    splash: bool(s.splash, d.splash),
    busyCursor: bool(s.busyCursor, d.busyCursor),
    sidebar: bool(s.sidebar, d.sidebar),
    newsFeed: typeof s.newsFeed === 'string' && isFeedUrl(s.newsFeed) ? s.newsFeed.slice(0, 2048) : d.newsFeed,
    currencyBase: oneOf(s.currencyBase, CURRENCIES, d.currencyBase),
    currencyQuotes: Array.isArray(s.currencyQuotes)
      ? [...new Set(s.currencyQuotes.filter((c): c is Currency => (CURRENCIES as readonly unknown[]).includes(c)))].slice(0, 4)
      : d.currencyQuotes,
    popupAllowlist: Array.isArray(s.popupAllowlist)
      ? [...new Set(s.popupAllowlist.filter((h): h is string => typeof h === 'string' && /^[a-z0-9.-]{1,253}$/i.test(h)))].slice(0, 5000)
      : d.popupAllowlist,
    welcomed: bool(s.welcomed, d.welcomed),
    safeBrowsing: bool(s.safeBrowsing, d.safeBrowsing),
    unpackedExtensions: Array.isArray(s.unpackedExtensions)
      ? [...new Set(s.unpackedExtensions.filter((p): p is string => typeof p === 'string' && p.length > 2 && p.length < 1024))].slice(0, 50)
      : d.unpackedExtensions,
    weatherLocation:
      s.weatherLocation === null
        ? null
        : loc && typeof loc.name === 'string' && typeof loc.lat === 'number' && typeof loc.lon === 'number' &&
            Math.abs(loc.lat) <= 90 && Math.abs(loc.lon) <= 180
          ? { name: loc.name.slice(0, 120), lat: loc.lat, lon: loc.lon }
          : d.weatherLocation,
    temperatureUnit: oneOf(s.temperatureUnit, ['c', 'f'] as const, d.temperatureUnit),
    notes: str(s.notes, 20000, d.notes),
    defaultZoom: num(s.defaultZoom, 0.5, 3, d.defaultZoom),
    spellcheck: bool(s.spellcheck, d.spellcheck),
    restoreAsleep: bool(s.restoreAsleep, d.restoreAsleep),
    confirmCloseTabs: bool(s.confirmCloseTabs, d.confirmCloseTabs)
  }
}

/** Apply a partial update on top of the current settings, then sanitize. */
export function mergeSettings(current: Settings, patch: unknown): Settings {
  if (!isObj(patch)) return current
  const merged: Record<string, unknown> = { ...current, ...patch }
  if (isObj(patch.widgets)) merged.widgets = { ...current.widgets, ...patch.widgets }
  return sanitizeSettings(merged, current)
}
