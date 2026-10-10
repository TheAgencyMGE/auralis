// Generates THIRD_PARTY_NOTICES.md: every package that ships inside the
// installer (runtime node_modules plus libraries bundled into out/), with
// its license text, followed by non-code assets and data sources.
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const nm = path.join(root, 'node_modules')

/** Libraries compiled into out/ by Vite (not present as node_modules in the app).
 *  qrcode's yargs dependency serves only its CLI and is not in the bundle. */
const BUNDLED = ['react', 'react-dom', 'scheduler', 'qrcode', 'qrcode/node_modules/pngjs', 'dijkstrajs', '@mozilla/readability']

/** The closure of `dependencies` (not peers, not dev) starting from the
 *  app's own dependencies: exactly what electron-builder copies into the app. */
function runtimePackages() {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const seen = new Set()
  // Resolve like Node: a nested node_modules wins over the hoisted copy.
  const resolve = (name, fromDir) => {
    for (let dir = fromDir; dir.startsWith(root); dir = path.dirname(dir)) {
      const candidate = path.join(dir, 'node_modules', name)
      if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate
      if (dir === root) break
    }
    return null
  }
  const visit = (name, fromDir) => {
    const dir = resolve(name, fromDir)
    if (!dir || seen.has(dir)) return
    seen.add(dir)
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
    for (const dep of Object.keys(pkg.dependencies ?? {})) visit(dep, dir)
  }
  Object.keys(app.dependencies ?? {}).forEach((d) => visit(d, root))
  return [...seen]
}

function licenseText(dir) {
  const file = fs.readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\..*)?$/i.test(f))
  return file ? fs.readFileSync(path.join(dir, file), 'utf8').trim() : null
}

const dirs = [...new Set([...runtimePackages(), ...BUNDLED.map((b) => path.join(nm, b))])].sort()
const sections = []
for (const dir of dirs) {
  if (!fs.existsSync(path.join(dir, 'package.json'))) continue
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type ?? 'see text'
  const text = licenseText(dir)
  sections.push(`## ${pkg.name} ${pkg.version}\n\nLicense: ${license}${pkg.homepage ? `\nHomepage: ${pkg.homepage}` : ''}\n\n${text ? '```\n' + text + '\n```' : '_No license file shipped; see the package metadata._'}`)
}

const assets = `## Electron and Chromium

Auralis is built on Electron (MIT License, https://github.com/electron/electron).
Electron includes Chromium and its dependencies; their licenses are reproduced in
\`LICENSES.chromium.html\` in the Auralis installation folder.

## Wallpaper photography (Unsplash License)

Used under the Unsplash License (https://unsplash.com/license): free to use,
attribution appreciated, not to be sold unaltered or compiled into a competing
photo service.

- Meadow — Tali Despins — https://unsplash.com/photos/FQkQxgO9Kh8
- Lagoon — Ibrahim Rifath — https://unsplash.com/photos/JgOlXp0Dlpc
- Cumulus — Kumiko Shimizu — https://unsplash.com/photos/lNxMcE8mvIM
- Deep Water — Sime Basioli — https://unsplash.com/photos/BRkikoNP0KQ
- Dew — Elimende Inagella — https://unsplash.com/photos/lYj0dLgMHmA
- Aurora — v2osk — https://unsplash.com/photos/Ovn1hyBge38
- Reef — NEOM — https://unsplash.com/photos/bOMVTvE2QFU
- Koi Pond — Anne Laure P — https://unsplash.com/photos/C4gUYeDV0Xo
- Morning Grass — Aaron Burden — https://unsplash.com/photos/sI8V_ax011I
- Butterfly — Erik Karits — https://unsplash.com/photos/E3TZQOWh8IA
- Leaves — Kumiko Shimizu — https://unsplash.com/photos/Pxa0yJ2Elxc

## Live wallpapers and aquarium footage (Pexels License)

Real video footage used under the Pexels License (https://www.pexels.com/license/):
free to use, attribution appreciated, not to be sold unaltered or redistributed
as stock footage.

- Rolling Fields — Egor Kunovsky — https://www.pexels.com/video/3829702/
- Bubbles — Kindel Media — https://www.pexels.com/video/8823625/
- Sunbeams — James Cheney — https://www.pexels.com/video/2632737/
- Dolphins — Nichola Peters — https://www.pexels.com/video/10802614/
- Koi — Samuel Sobrinho — https://www.pexels.com/video/3582903/
- Jellyfish — Chris Munnik — https://www.pexels.com/video/4805827/
- Droplet — Pixabay — https://www.pexels.com/video/855494/
- Northern Lights — Nico Becker — https://www.pexels.com/video/5600929/
- Rain on Glass — Zuzanna Musial — https://www.pexels.com/video/5366344/
- Wind Farm — Pixabay — https://www.pexels.com/video/855181/
- City at Dusk — William Chen — https://www.pexels.com/video/14563249/
- Rainforest Falls — Greg Benson — https://www.pexels.com/video/10761087/
- School of Fish — Daniel Torobekov — https://www.pexels.com/video/5277924/
- Aquarium gadget — Magda Ehlers — https://www.pexels.com/video/18900261/

## Data services

- Weather forecasts and geocoding: Open-Meteo (https://open-meteo.com), data
  licensed CC BY 4.0. Free for non-commercial use; commercial redistribution of
  Auralis would require an Open-Meteo API subscription.
- Ad and tracker filter lists: fetched at runtime by the Ghostery adblocker
  engine from Ghostery's CDN (EasyList and EasyPrivacy, dual-licensed GPLv3 /
  CC BY-SA 3.0; uBlock Origin resources, GPLv3). The lists are downloaded, not
  distributed with Auralis.

## Icons, artwork and sounds

- Interface icons: Fluent UI System Icons, Copyright (c) 2020 Microsoft
  Corporation, MIT License — https://github.com/microsoft/fluentui-system-icons
- 3D artwork (globe logo and app icon, folder, weather, page headers): Fluent
  Emoji, Copyright (c) Microsoft Corporation, MIT License —
  https://github.com/microsoft/fluentui-emoji
- Sounds: Interface Sounds by Kenney (www.kenney.nl), CC0 1.0 —
  https://kenney.nl/assets/interface-sounds
- Startup sound: "Wind chime small" by freesound_community, Pixabay Content
  License — https://pixabay.com/sound-effects/film-special-effects-wind-chime-small-64660/ (trimmed
  to seven seconds)
- Clock gadget: "Swiss railway clock" by Jahoe, Wikimedia Commons, CC BY-SA 3.0 —
  https://commons.wikimedia.org/wiki/File:Swiss_railway_clock.svg (modified:
  ids on the hands, prefixed class names). The modified file,
  art/clock.svg, is available under the same license.
- Feed icon: the Mozilla Foundation's feed icon, MPL 1.1 —
  https://commons.wikimedia.org/wiki/File:Feed-icon.svg
- Currency rates: Frankfurter (https://frankfurter.dev), European Central Bank
  reference rates.
- Dangerous-site lists, downloaded at runtime from the malware-filter project
  (https://gitlab.com/malware-filter): Phishing Domains Blocklist (CC BY-SA 4.0;
  sources OpenPhish, PhishTank, IPThreat) and Malicious Domains Blocklist
  (CC0; source URLhaus by abuse.ch). Checked locally; nothing is sent.
- Chrome extensions are installed from the Chrome Web Store at the user's
  request and are not distributed with Auralis.
- Feed Headlines default feed: BBC News (https://www.bbc.co.uk/news), fetched at
  runtime and shown as headlines that link to the BBC.
- Text is set in Segoe UI, which is part of Windows and is not distributed
  with Auralis.`

const doc = `# Third-party notices

Auralis includes the following third-party software. This file is generated by
\`npm run notices\` from the packages that actually ship.

${assets}

# Software packages

${sections.join('\n\n')}
`
fs.writeFileSync(path.join(root, 'THIRD_PARTY_NOTICES.md'), doc)
console.log(`THIRD_PARTY_NOTICES.md: ${sections.length} packages`)
