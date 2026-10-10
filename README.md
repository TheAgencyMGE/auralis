# Auralis

A Windows browser from an alternate timeline where Vista's Aero kept evolving. It's built on Electron 44 (Chromium 152).

## Develop

```
npm install
npm run dev          # hot-reload development
npm test             # unit tests (run on Electron's own Node)
npm run test:e2e     # build + Playwright end-to-end tests
npm run dist         # typecheck, test, build, NSIS installer -> dist/
```

## Highlights

- Real acrylic glass frame with Vista window colors, IE-style navigation orbs and a Start-menu app menu.
- Tabs with Spaces, split view, hover previews, Tab Flip, tear-off, and sleeping tabs that keep their history.
- Shield: ad and tracker blocking (Ghostery engine), HTTPS-First, Global Privacy Control, per-site permissions, and a screen-sharing picker.
- Tools: Reader view, screenshots, QR codes, Picture-in-Picture, a command palette (Ctrl+K) and a Task Manager.
- Favorites, history with full-text search, downloads with Mark-of-the-Web, and session restore.
- The 2000s, kept: Flip 3D (Ctrl+Shift+F), a glass Sidebar of gadgets beside any page (clock, weather, slide show, feed headlines, currency, aquarium, notes, meter), IE7's feed button and feed view, the yellow Information Bar for blocked pop-ups and finished downloads, a Media Player-style mini player in the status bar, the Welcome Center, a startup chime and splash, the busy pointer while pages load, and the opaque Aero Basic frame when transparency is off.
- Live wallpapers from real Pexels footage. Every video and timer pauses when it isn't visible, and gadget code loads only when the Sidebar first opens.

See `docs/PLAN.md` for the architecture, and `THIRD_PARTY_NOTICES.md` for licenses and wallpaper credits.
