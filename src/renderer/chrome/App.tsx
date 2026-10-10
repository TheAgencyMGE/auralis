// The window frame: glass title row with tabs, the navigation row, the
// Favorites command bar, an optional find bar, the web viewport and the
// status bar. Web pages are separate views the main process places inside
// the viewport rectangle this component reports.
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Settings } from '@shared/settings'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { WindowState } from '@shared/types'
import { applyFrameTokens, bridge, call, rectOf } from '@ui/api'
import { playSound, type SoundName } from '@ui/sound'
import { TabStrip } from './Tabs'
import { Toolbar } from './Toolbar'
import { CaptionButtons, FavoritesBar, FindBar, InfoBarRow, StatusBar, ViewportFurniture } from './Bars'

// Gadget code loads the first time the Sidebar opens, not with every window.
const SidePanel = lazy(() => import('./Sidebar').then((m) => ({ default: m.SidePanel })))

export function App() {
  const [state, setState] = useState<WindowState | null>(null)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const viewportRef = useRef<HTMLDivElement>(null)
  const anchorRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    const offState = bridge().on('state', (s) => setState(s as WindowState))
    const offSettings = bridge().on('settings', (s) => setSettings(s as Settings))
    const offSound = bridge().on('sound', (n) => playSound(n as SoundName))
    void call<{ settings: Settings; state: WindowState }>('chrome.ready').then((r) => {
      setSettings(r.settings)
      setState(r.state)
    })
    return () => {
      offState()
      offSettings()
      offSound()
    }
  }, [])

  useEffect(() => applyFrameTokens(settings), [settings])

  const reportLayout = useCallback(() => {
    const vp = viewportRef.current
    if (!vp) return
    const a = anchorRefs.current
    void call('window.layout', rectOf(vp), {
      siteInfo: a.siteInfo ? rectOf(a.siteInfo) : undefined,
      omnibox: a.omnibox ? rectOf(a.omnibox) : undefined,
      menu: a.menu ? rectOf(a.menu) : undefined,
      downloads: a.downloads ? rectOf(a.downloads) : undefined,
      star: a.star ? rectOf(a.star) : undefined
    })
  }, [])

  useLayoutEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const ro = new ResizeObserver(() => reportLayout())
    ro.observe(vp)
    window.addEventListener('resize', reportLayout)
    reportLayout()
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', reportLayout)
    }
  }, [reportLayout])

  // Rows appearing or disappearing move the viewport without resizing it.
  useLayoutEffect(() => {
    reportLayout()
  }, [reportLayout, settings.showBookmarksBar, settings.showStatusBar, settings.sidebar, state?.infobar?.id, state?.find.open, state?.maximized, state?.fullscreen, state?.htmlFullscreen])

  const setAnchor = useCallback((key: string) => (el: HTMLElement | null) => {
    anchorRefs.current[key] = el
  }, [])

  const active = state?.tabs.find((t) => t.id === state.activeTabId) ?? null
  const immersive = !!state && (state.fullscreen || state.htmlFullscreen)
  const cls = [
    'frame',
    state?.maximized ? 'is-maximized' : '',
    state?.focused === false ? 'is-inactive' : '',
    state?.incognito ? 'is-private' : '',
    immersive ? 'is-immersive' : '',
    settings.transparency ? '' : 'is-opaque',
    state?.busy ? 'is-busy' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls}>
      {!immersive && (
        <>
          <header className="titlebar">
            <TabStrip state={state} settings={settings} menuAnchor={setAnchor('menu')} />
            <CaptionButtons maximized={!!state?.maximized} />
          </header>
          <Toolbar state={state} active={active} settings={settings} setAnchor={setAnchor} />
          {settings.showBookmarksBar && <FavoritesBar items={state?.bookmarksBar ?? []} />}
          {state?.find.open && active && <FindBar find={state.find} />}
          {state?.infobar && <InfoBarRow bar={state.infobar} />}
        </>
      )}
      <div className="client">
        <main className="viewport" ref={viewportRef}>
          <ViewportFurniture state={state} active={active} viewportRef={viewportRef} />
        </main>
        {!immersive && settings.sidebar && (
          <Suspense fallback={<aside className="side-panel" />}>
            <SidePanel settings={settings} />
          </Suspense>
        )}
      </div>
      {!immersive && settings.showStatusBar && <StatusBar state={state} active={active} />}
    </div>
  )
}
