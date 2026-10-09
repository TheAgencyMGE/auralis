# Auralis — Implementation Plan

## Research summary

**Aero-Dock (installed, `~/aero-dock`, MIT, same author)** — the visual reference. Its material
is a glossy beveled panel: a vertical tint gradient that breaks at ~50% (the Vista "gloss line"),
a curved white specular cap on the top half, a bright 1px inner rim on top and a darker rim at the
bottom, a slow ambient light sweep, and a deep soft drop shadow. Accent palette: sky cyan
`#2f9de3`, deep blue `#145a9e`, "life" green `#7ad03a`, ink `#0d3a5c`. Section headings carry a
short blue→green underline. Typography is Segoe UI. Settings sit on a sky gradient with bubbles.

**Prior attempt (`~/aero`, Electron 34)** — useful gotchas: `ready-to-show` never fires with
`backgroundMaterial`; DOM focus cannot steal focus from a `WebContentsView` without
`webContents.focus()` first; IPC sent before a page loads is dropped; it depended on
`better-sqlite3`, which needs MSVC rebuilds.

**Platform** — Electron 44.7 (Chromium 152, Node 24.21). `node:sqlite` works inside Electron 44
including FTS5, so storage needs no native modules. `BrowserView` is deprecated;
`WebContentsView` is the supported tab primitive. `setWindowOpenHandler({createWindow})` lets
`window.open` popups become tabs while keeping `window.opener` (OAuth flows). Electron supports a
single `webRequest` listener per event, so ad blocking, HTTPS-First and Global Privacy Control
share one request pipeline. Extensions: Electron implements only a small subset of the Chrome
extension API; Auralis builds the most-wanted extension features in instead.

**Competitors** — Edge (sleeping tabs, vertical tabs, split screen), Vivaldi (workspaces, tab
tiling, capture, notes), Arc/Zen (spaces, command bar, split view, peek), Brave (shields),
Firefox (reader view, PiP). Common gaps: heavy UIs, settings sprawl, extension dependence.

## Product decisions

Identity: *Vista evolved*. The window is real desktop-blurring glass (Windows 11 acrylic) tinted
with a user-chosen Vista "window color". The client area is framed by glass on all sides, like a
Vista window. IE7-style glossy back/forward orbs, a Start-menu-style app menu behind an Auralis
orb, Win7 taskbar-style hover glow on tabs that takes the favicon's color, glass tab previews,
an IE7-style status bar, Control-Panel-style internal pages, and a Sidebar-gadget new tab page on
real photography.

Feature set (ranked by value ÷ risk):

1. Core: tabs (drag reorder, pin, mute, duplicate, reopen closed), omnibox with history /
   bookmark / open-tab / search suggestions, bookmarks + bar, history with full-text search,
   downloads with taskbar progress, find in page, zoom, print, devtools, session restore.
2. Spaces (workspaces) — named, colored sets of tabs.
3. Split view — two tabs side by side, draggable divider.
4. Tab previews on hover + Tab Flip overview (thumbnail grid with search).
5. Sleeping tabs — background tabs are discarded after a timeout and restored with full
   back/forward history (`navigationHistory.restore`). Task Manager shows the effect.
6. Shield — ad & tracker blocking (Ghostery engine, MPL-2.0), per-site toggle, blocked counts;
   HTTPS-First with fallback interstitial; Global Privacy Control; permission prompts with
   per-site memory; site-info panel with certificate details; clear browsing data; InPrivate
   windows (in-memory partition).
7. Tools — Reader view (Mozilla Readability in an isolated world), screenshot, QR code,
   Picture-in-Picture, command palette, built-in task manager.
8. Import/export — Chrome/Edge bookmarks, Netscape HTML import/export.
9. Recovery — crashed-tab page, unresponsive-page handling, unclean-shutdown detection with lazy
   (asleep) restore to avoid crash loops, rotating log file.

## Architecture

```
BrowserWindow (frameless, acrylic)  ── webContents = chrome UI (React)
 ├─ WebContentsView × N   tab content, sandboxed, no preload, placed in the content rect
 │                        the chrome UI reports (so CSS owns layout, DPI-correct)
 └─ WebContentsView       overlay: transparent, top-most, attached only while a menu,
                          popover, prompt or Tab Flip is open
auralis://<page>          internal pages served by protocol.handle from the bundle,
                          narrow preload API, IPC authorized by sender origin + page
SQLite (node:sqlite)      history (FTS5), bookmarks, downloads, permissions
JSON (atomic)             settings, session
```

## Stages

foundation → visual system → core browsing → differentiated features → persistence →
security hardening → tests (Vitest unit + Playwright-Electron e2e) → packaging (NSIS).
