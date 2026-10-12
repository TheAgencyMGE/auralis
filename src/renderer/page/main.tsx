import { createRoot } from 'react-dom/client'
import { lazy, Suspense } from 'react'
import '../styles/tokens.css'
import '@ui/aqua-theme.css'
import './page.css'
import './page-aqua.css'

// One bundle, routed by host: auralis://<page>/
const pages = {
  newtab: lazy(() => import('./pages/NewTab')),
  settings: lazy(() => import('./pages/Settings')),
  history: lazy(() => import('./pages/History')),
  bookmarks: lazy(() => import('./pages/Bookmarks')),
  downloads: lazy(() => import('./pages/Downloads')),
  taskmanager: lazy(() => import('./pages/TaskManager')),
  reader: lazy(() => import('./pages/Reader')),
  error: lazy(() => import('./pages/ErrorPage')),
  about: lazy(() => import('./pages/About')),
  welcome: lazy(() => import('./pages/Welcome')),
  feed: lazy(() => import('./pages/FeedView')),
  extensions: lazy(() => import('./pages/Extensions'))
} as const

const host = location.hostname as keyof typeof pages
const Page = pages[host] ?? pages.error
document.documentElement.dataset.page = host
// The look (Aqua or Modern) follows the setting live.
document.documentElement.dataset.ui = 'aqua'
const applyUi = (s: unknown) => {
  const style = (s as { uiStyle?: string } | null)?.uiStyle
  if (style) document.documentElement.dataset.ui = style
}
void window.auralis?.call('settings.get').then(applyUi).catch(() => {})
window.auralis?.on('settings', applyUi)

createRoot(document.getElementById('root')!).render(
  <Suspense fallback={null}>
    <Page />
  </Suspense>
)
