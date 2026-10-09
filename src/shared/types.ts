// Data shapes shared by the main process and every renderer.

export type SecurityLevel = 'secure' | 'insecure' | 'internal' | 'error' | 'file' | 'none'

export interface TabState {
  id: number
  spaceId: string
  url: string
  title: string
  /** data: URL produced by the main process, never a remote URL */
  favicon: string | null
  /** dominant colour of the favicon, drives the hover glow */
  accent: string | null
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  pinned: boolean
  muted: boolean
  audible: boolean
  asleep: boolean
  crashed: boolean
  security: SecurityLevel
  zoom: number
  blocked: number
  shieldActive: boolean
  bookmarked: boolean
  readerable: boolean
  /** true while the omnibox should show the raw URL as typed rather than the page URL */
  isNewTab: boolean
}

export interface Space {
  id: string
  name: string
  color: SpaceColor
}

export type SpaceColor = 'sky' | 'sea' | 'leaf' | 'sun' | 'rose' | 'violet' | 'graphite'

export interface SplitState {
  left: number
  right: number
  ratio: number
}

export interface DownloadItemState {
  id: string
  url: string
  filename: string
  path: string
  state: 'progressing' | 'paused' | 'completed' | 'cancelled' | 'interrupted'
  received: number
  total: number
  speed: number
  startTime: number
  endTime: number | null
}

export interface FindState {
  open: boolean
  text: string
  active: number
  matches: number
}

export interface WindowState {
  id: number
  incognito: boolean
  maximized: boolean
  fullscreen: boolean
  htmlFullscreen: boolean
  focused: boolean
  spaces: Space[]
  activeSpaceId: string
  tabs: TabState[]
  activeTabId: number | null
  split: SplitState | null
  find: FindState
  downloads: { active: number; progress: number; recent: number }
  bookmarksBar: BookmarkNode[]
  status: string
}

export interface BookmarkNode {
  id: number
  parentId: number | null
  kind: 'folder' | 'url'
  title: string
  url: string | null
  position: number
  created: number
  children?: BookmarkNode[]
  favicon?: string | null
}

export interface HistoryEntry {
  id: number
  url: string
  title: string
  lastVisit: number
  visitCount: number
  favicon?: string | null
}

export interface Suggestion {
  kind: 'navigate' | 'search' | 'history' | 'bookmark' | 'tab' | 'command'
  title: string
  url: string
  /** text the omnibox shows while this row is selected */
  fill: string
  favicon?: string | null
  tabId?: number
  command?: string
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface MenuItem {
  id?: string
  label?: string
  accelerator?: string
  icon?: string
  checked?: boolean
  disabled?: boolean
  danger?: boolean
  type?: 'separator' | 'header'
  submenu?: MenuItem[]
}

export interface SiteInfo {
  url: string
  origin: string
  host: string
  security: SecurityLevel
  certificate: {
    subject: string
    issuer: string
    validFrom: number
    validTo: number
    fingerprint: string
  } | null
  permissions: { permission: string; decision: 'allow' | 'deny' }[]
  shieldEnabled: boolean
  shieldActive: boolean
  blocked: number
  cookies: number
}

export interface PermissionPrompt {
  id: number
  origin: string
  permissions: string[]
}

export interface ProcessRow {
  pid: number
  type: string
  title: string
  url: string
  tabId: number | null
  memoryKB: number
  cpu: number
  asleep: boolean
}

export interface TabThumb {
  id: number
  title: string
  url: string
  favicon: string | null
  thumbnail: string | null
  asleep: boolean
  active: boolean
  spaceId: string
}

/** Everything the overlay can be asked to draw. */
export type OverlayContent =
  | { kind: 'menu'; items: MenuItem[]; minWidth?: number }
  | { kind: 'appmenu'; items: MenuItem[]; recent: { title: string; url: string; favicon: string | null }[]; incognito: boolean }
  | { kind: 'omnibox'; suggestions: Suggestion[]; selected: number; width: number }
  | { kind: 'preview'; tab: TabThumb }
  | { kind: 'tabflip'; tabs: TabThumb[]; spaces: Space[] }
  | { kind: 'siteinfo'; info: SiteInfo }
  | { kind: 'permission'; prompt: PermissionPrompt }
  | { kind: 'downloads'; items: DownloadItemState[] }
  | { kind: 'spaces'; spaces: Space[]; activeSpaceId: string; counts: Record<string, number> }
  | { kind: 'qr'; url: string; dataUrl: string }
  | { kind: 'palette'; query: string }
  | { kind: 'bookmark'; id: number; title: string; folderId: number; folders: { id: number; title: string; depth: number }[] }
  | { kind: 'zoom'; level: number }
  | { kind: 'confirm'; title: string; message: string; confirm: string; cancel: string; token: string }
  | { kind: 'toast'; message: string; icon?: string }

export interface OverlayRequest {
  content: OverlayContent
  /** anchor in window coordinates; the popup appears below it */
  anchor: Rect
  align: 'start' | 'end' | 'center'
  /** fullscreen overlays get a dimming backdrop and cover the window */
  modal?: boolean
  /** non-interactive overlays never take focus (tab previews) */
  passive?: boolean
}
