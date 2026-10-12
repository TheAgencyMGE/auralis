// The Welcome Center: Vista's first-run window. Pick a tile below to see
// what it does above, and do it right there.
import { useEffect, useState, type ReactNode } from 'react'
import { ALL_WALLPAPER_IDS, FRAME_COLORS, SEARCH_ENGINES, wallpaperInfo, type FrameColorId, type SearchEngineId, type Settings } from '@shared/settings'
import { call, useSettings } from '@ui/api'
import { Orb } from '@ui/Orb'

const set = (patch: Partial<Settings>) => void call('settings.set', patch)

interface Tile {
  id: string
  art: string
  title: string
  blurb: string
  body: (s: Settings) => ReactNode
}

const TILES: Tile[] = [
  {
    id: 'import',
    art: 'favorites',
    title: 'Bring your favorites',
    blurb: 'Copy your bookmarks from another browser into Favorites. Nothing in the other browser is changed.',
    body: () => <ImportFavorites />
  },
  {
    id: 'wallpaper',
    art: 'wallpaper',
    title: 'Choose a wallpaper',
    blurb: 'New tabs open on real footage or photography. Live wallpapers loop quietly and pause when you look away.',
    body: (s) => (
      <div className="wc-walls">
        {ALL_WALLPAPER_IDS.filter((id) => id.startsWith('live:')).map((id) => {
          const w = wallpaperInfo(id)
          return (
            <button key={id} className={`wp-thumb${s.wallpaper === id ? ' is-on' : ''}`} aria-pressed={s.wallpaper === id} onClick={() => set({ wallpaper: id })}>
              <img src={w.thumb} alt="" />
              <span>{w.name}</span>
            </button>
          )
        })}
      </div>
    )
  },
  {
    id: 'search',
    art: 'search',
    title: 'Pick a search provider',
    blurb: 'What you type in the address bar that isn’t an address is searched with this provider.',
    body: (s) => (
      <div className="wc-choices" role="radiogroup" aria-label="Search provider">
        {(Object.keys(SEARCH_ENGINES) as SearchEngineId[]).map((id) => (
          <label key={id} className="wc-choice">
            <input type="radio" name="engine" checked={s.searchEngine === id} onChange={() => set({ searchEngine: id })} />
            {SEARCH_ENGINES[id].name}
          </label>
        ))}
      </div>
    )
  },
  {
    id: 'color',
    art: 'color',
    title: 'Color the glass',
    blurb: 'Tint the window frame. Turn transparency off for the opaque Aero Basic look.',
    body: (s) => (
      <>
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
        <label className="wc-choice">
          <input type="checkbox" checked={s.transparency} onChange={(e) => set({ transparency: e.target.checked })} />
          Enable transparency
        </label>
      </>
    )
  },
  {
    id: 'startup',
    art: 'sound',
    title: 'Startup sound and splash',
    blurb: 'Auralis greets you with a wind chime and its orb when it starts. Turn either off here.',
    body: (s) => (
      <>
        <label className="wc-choice">
          <input type="checkbox" checked={s.startupSound} onChange={(e) => set({ startupSound: e.target.checked })} />
          Play the startup sound
        </label>
        <label className="wc-choice">
          <input type="checkbox" checked={s.splash} onChange={(e) => set({ splash: e.target.checked })} />
          Show the splash
        </label>
      </>
    )
  },
  {
    id: 'default',
    art: 'browser',
    title: 'Make Auralis your browser',
    blurb: 'Windows lets you choose your default browser in Settings. Pick Auralis under Default apps.',
    body: () => (
      <button className="btn is-default" onClick={() => void call('app.defaultBrowser')}>
        Open Default apps
      </button>
    )
  }
]

export default function Welcome() {
  const s = useSettings()
  const [picked, setPicked] = useState(TILES[0].id)
  useEffect(() => {
    document.title = 'Welcome Center'
    // Shown once at first start; it stays one click away in the Auralis menu.
    set({ welcomed: true })
  }, [])
  const tile = TILES.find((t) => t.id === picked)!
  return (
    <div className="wc">
      <header className="wc-head">
        <Orb size={56} />
        <div>
          <h1>Welcome to Auralis</h1>
          <p>Get started by choosing what matters to you. You can come back here any time from the Auralis menu.</p>
        </div>
      </header>
      <section className="wc-detail" aria-live="polite">
        <img className="wc-detail-art" src={`/art/icons/${tile.art}.webp`} width={64} height={64} alt="" />
        <div className="wc-detail-body">
          <h2>{tile.title}</h2>
          <p>{tile.blurb}</p>
          {tile.body(s)}
        </div>
      </section>
      <h3 className="wc-section">Get started with Auralis</h3>
      <nav className="wc-tiles" aria-label="Welcome Center tasks">
        {TILES.map((t) => (
          <button key={t.id} className={`wc-tile${t.id === picked ? ' is-on' : ''}`} aria-pressed={t.id === picked} onClick={() => setPicked(t.id)}>
            <img src={`/art/icons/${t.art}.webp`} width={40} height={40} alt="" />
            <span>{t.title}</span>
          </button>
        ))}
      </nav>
      <footer className="wc-foot">
        <button className="btn" onClick={() => void call('nav.go', 'auralis://newtab/')}>
          Start browsing
        </button>
      </footer>
    </div>
  )
}

function ImportFavorites() {
  const [msg, setMsg] = useState('')
  const run = async (source: 'chrome' | 'edge' | 'brave' | 'html', name: string) => {
    setMsg(`Importing from ${name}…`)
    const r = await call<{ count: number; notFound?: boolean; canceled?: boolean }>('bookmarks.import', source)
    setMsg(r.notFound ? `${name} isn’t installed for this user.` : r.canceled ? '' : `Imported ${r.count} favorite${r.count === 1 ? '' : 's'} from ${name}.`)
  }
  return (
    <>
      <div className="wc-buttons">
        <button className="btn" onClick={() => void run('chrome', 'Google Chrome')}>
          Google Chrome
        </button>
        <button className="btn" onClick={() => void run('edge', 'Microsoft Edge')}>
          Microsoft Edge
        </button>
        <button className="btn" onClick={() => void run('brave', 'Brave')}>
          Brave
        </button>
        <button className="btn" onClick={() => void run('html', 'the file')}>
          From a file…
        </button>
      </div>
      {msg && <p className="wc-msg">{msg}</p>}
    </>
  )
}
