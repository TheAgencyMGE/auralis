# How Auralis is built

Auralis is an Electron 44 app (Chromium 152, Node 24). This page explains how the parts fit together, for anyone who wants to read or change the code.

## Windows, tabs and the overlay

Each browser window is a frameless `BrowserWindow`. Its own web contents is the browser's interface (the "chrome"), written in React. Web pages never run in that document.

```
BrowserWindow                 the chrome UI (React): sidebar or tab strip, address bar, buttons
 ├─ WebContentsView × N       one per awake tab, sandboxed, placed in the rectangle the chrome reports
 └─ WebContentsView           the overlay: menus, popovers, prompts, Tab Flip, Flip 3D, the splash
```

The chrome measures where the page should go and sends that rectangle to the main process, which moves the tab's view there. CSS owns the layout, so both looks (Aqua and Modern) work with the same main-process code.

Native views always sit above the window's own HTML, so anything that has to appear over a page (a menu, the address suggestions, a permission prompt) is drawn by the overlay view. The overlay page measures its content and the main process sizes the view to fit, so clicks next to a popup still reach the page underneath.

Tabs you haven't looked at for a while go to sleep: Auralis closes their renderer and keeps their back and forward history, then restores it with `navigationHistory.restore` when you come back.

## Internal pages

`auralis://newtab`, `settings`, `history`, `bookmarks`, `downloads`, `extensions`, `welcome` and the rest are one React bundle served through `protocol.handle` from the app itself. Each page gets a strict Content Security Policy. Web pages can't load anything from `auralis://`.

There is one preload script. It exposes a small bridge only to Auralis' own pages. Every call goes through a single IPC channel, and the main process checks who is calling (the chrome, the overlay or which internal page) against an allowlist before running anything. Arguments are validated on the way in. The new tab page, for example, can change its wallpaper but can't clear your history.

## Storage

- History (with full-text search), favorites, downloads, site permissions and favicons live in SQLite through `node:sqlite`, so there are no native modules to rebuild.
- Settings and the session are JSON files written atomically. Every settings write passes through a sanitizer, so a damaged file can't crash the browser.
- Your own wallpapers are copied into the profile. Large photos are scaled to 2560 px on import, and videos stream with byte ranges instead of loading into memory.

## Privacy and safety

Electron allows one `webRequest` listener per event, so everything that inspects requests shares one pipeline in `src/main/shield.ts`:

- Ad and tracker blocking with the Ghostery engine, with cosmetic filtering and a per-site switch.
- HTTPS-First upgrades, with a fallback page when a site has no HTTPS.
- Global Privacy Control headers.
- Dangerous-site checks against community phishing and malware lists (malware-filter project). The lists download every 12 hours and are kept as sorted 64-bit hashes, so every check happens on your computer.

Auralis sends Chromium's user agent without the Electron token, except on Google's sign-in page. There it keeps the token, because Google refuses sign-in from browsers that look like Chrome but don't pass Chrome's own checks (`src/main/sign-in.ts`).

Pop-ups need a click or key press shortly before them, like in Chromium. Downloads get Windows' Mark of the Web.

## Extensions

Chrome extensions use [electron-chrome-extensions](https://github.com/samuelmaddock/electron-browser-shell) for the APIs Electron lacks (tabs, windows, action buttons, context menus) and [electron-chrome-web-store](https://github.com/samuelmaddock/electron-browser-shell) to install from the Chrome Web Store. Auralis draws the toolbar buttons itself. Extensions run in normal windows only.

## Looks

`settings.uiStyle` picks the look. `src/renderer/chrome/Aqua.tsx` and `aqua.css` are the default; the Modern look is `Tabs.tsx`, `Toolbar.tsx` and `chrome.css`. Shared controls are themed by `:root[data-ui='aqua']` rules in `src/renderer/ui/aqua-theme.css`, which every bundle loads.

## Tests

- `npm test` runs the Vitest unit tests on Electron's own Node.
- `npm run test:e2e` builds the app and drives it with Playwright: real windows, real keystrokes and a local test server.

## Building the installer

`npm run dist` runs the type checks and tests, builds, writes `THIRD_PARTY_NOTICES.md` and packages an NSIS installer into `dist/`. The build turns off Electron's risky fuses (no `ELECTRON_RUN_AS_NODE`, no inspector flags, ASAR integrity checks on).
