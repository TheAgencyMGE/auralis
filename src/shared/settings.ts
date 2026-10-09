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
  sky: { name: 'Sky', tint: '#3d8fd6' },
  aqua: { name: 'Aqua', tint: '#14aecb' },
  lime: { name: 'Lime', tint: '#6cbf2a' },
  twilight: { name: 'Twilight', tint: '#3654a8' },
  sea: { name: 'Sea', tint: '#1f9aa6' },
  leaf: { name: 'Leaf', tint: '#4f9f3a' },
  ruby: { name: 'Ruby', tint: '#b4363d' },
  amber: { name: 'Amber', tint: '#d0862a' },
  rose: { name: 'Rose', tint: '#c8578f' },
  violet: { name: 'Violet', tint: '#7a55c4' },
  graphite: { name: 'Graphite', tint: '#4a5562' },
  frost: { name: 'Frost', tint: '#9fb6c8' }
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
  borealis: { name: 'Northern Lights', credit: 'Nico Becker', source: 'https://www.pexels.com/video/5600929/', tone: 'dark' }
} as const

export type PhotoWallpaperId = keyof typeof WALLPAPERS
export type LiveWallpaperId = keyof typeof LIVE_WALLPAPERS
/** Live ids are stored as "live:<id>" so they never collide with photos. */
export type WallpaperId = PhotoWallpaperId | `live:${LiveWallpaperId}`

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

export function wallpaperInfo(id: WallpaperId): WallpaperInfo {
  if (id.startsWith('live:')) {
    const key = id.slice(5) as LiveWallpaperId
    const w = LIVE_WALLPAPERS[key] ?? LIVE_WALLPAPERS.fields
    return { ...w, live: true, image: `/live/${key}.webp`, thumb: `/live/${key}.thumb.webp`, video: `/live/${key}.mp4` }
  }
  const w = WALLPAPERS[id as PhotoWallpaperId] ?? WALLPAPERS.meadow
  return { ...w, live: false, image: `/wallpapers/${id}.webp`, thumb: `/wallpapers/${id}.thumb.webp`, video: null }
}

export const SLEEP_OPTIONS = [0, 5, 15, 30, 60, 120] as const

export interface Settings {
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
  widgets: { clock: boolean; weather: boolean; notes: boolean; meter: boolean; topSites: boolean; aquarium: boolean }
  aeroSounds: boolean
  weatherLocation: { name: string; lat: number; lon: number } | null
  temperatureUnit: 'c' | 'f'
  notes: string
  defaultZoom: number
  spellcheck: boolean
  restoreAsleep: boolean
  confirmCloseTabs: boolean
}

export const DEFAULT_SETTINGS: Settings = {
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
  widgets: { clock: true, weather: true, notes: true, meter: false, topSites: true, aquarium: true },
  aeroSounds: true,
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

export function sanitizeSettings(input: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const s = isObj(input) ? input : {}
  const d = base
  const w = isObj(s.widgets) ? s.widgets : {}
  const loc = isObj(s.weatherLocation) ? s.weatherLocation : null
  const homePage = str(s.homePage, 2048, d.homePage)
  return {
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
    wallpaper: oneOf(s.wallpaper, ALL_WALLPAPER_IDS, d.wallpaper),
    widgets: {
      clock: bool(w.clock, d.widgets.clock),
      weather: bool(w.weather, d.widgets.weather),
      notes: bool(w.notes, d.widgets.notes),
      meter: bool(w.meter, d.widgets.meter),
      topSites: bool(w.topSites, d.widgets.topSites),
      aquarium: bool(w.aquarium, d.widgets.aquarium)
    },
    aeroSounds: bool(s.aeroSounds, d.aeroSounds),
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
