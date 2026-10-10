import { createRoot } from 'react-dom/client'
import { lazy, Suspense } from 'react'
import '../styles/tokens.css'
import './page.css'

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

createRoot(document.getElementById('root')!).render(
  <Suspense fallback={null}>
    <Page />
  </Suspense>
)
