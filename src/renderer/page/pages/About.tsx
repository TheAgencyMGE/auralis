import { useEffect, useState } from 'react'
import { LIVE_WALLPAPERS, WALLPAPERS } from '@shared/settings'
import { call } from '@ui/api'
import { Orb } from '@ui/Orb'
import { Group, Shell } from '../Shell'

interface Info {
  version: string
  electron: string
  chrome: string
  node: string
  v8: string
  platform: string
  userData: string
  log: string | null
  packaged: boolean
}

export default function About() {
  const [info, setInfo] = useState<Info | null>(null)
  const [notices, setNotices] = useState('')
  useEffect(() => {
    document.title = 'About Auralis'
    void call<Info>('app.info').then(setInfo)
    void call<string>('app.licenses').then(setNotices)
  }, [])
  return (
    <Shell icon="info" title="About Auralis">
      <div className="about-hero">
        <Orb size={72} />
        <div>
          <h1>Auralis</h1>
          <p style={{ margin: '2px 0 0', color: 'var(--ink-soft)' }}>Version {info?.version ?? '…'}</p>
        </div>
      </div>
      <Group title="Version information">
        {info && (
          <dl className="kv">
            <dt>Auralis</dt>
            <dd>{info.version}</dd>
            <dt>Chromium</dt>
            <dd>{info.chrome}</dd>
            <dt>Electron</dt>
            <dd>{info.electron}</dd>
            <dt>Node.js</dt>
            <dd>{info.node}</dd>
            <dt>V8</dt>
            <dd>{info.v8}</dd>
            <dt>Operating system</dt>
            <dd>{info.platform}</dd>
            <dt>Profile folder</dt>
            <dd>{info.userData}</dd>
            {info.log && (
              <>
                <dt>Log file</dt>
                <dd>{info.log}</dd>
              </>
            )}
          </dl>
        )}
      </Group>
      <Group title="Updates" intro="Auralis is built on Electron, which follows Chromium’s security releases. New versions are published as installers; install the latest one over this version to update. Your favorites, history and settings are kept.">
        <span />
      </Group>
      <Group
        title="Live wallpapers"
        intro="Real footage from Pexels, used under the Pexels License. The aquarium gadget plays “An aquarium with many fish and anemones” by Magda Ehlers. The startup sound is “Wind chime small” from Pixabay, the clock gadget is “Swiss railway clock” by Jahoe (CC BY-SA 3.0) and the feed icon is Mozilla’s (MPL 1.1)."
      >
        <dl className="kv">
          {Object.values(LIVE_WALLPAPERS).map((w) => (
            <span key={w.name} style={{ display: 'contents' }}>
              <dt>{w.name}</dt>
              <dd>
                {w.credit},{' '}
                <a
                  href={w.source}
                  onClick={(e) => {
                    e.preventDefault()
                    void call('nav.go', w.source, 'newtab')
                  }}
                >
                  {w.source.replace('https://', '')}
                </a>
              </dd>
            </span>
          ))}
        </dl>
      </Group>
      <Group title="Photography" intro="New tab photos are used under the Unsplash License.">
        <dl className="kv">
          {Object.values(WALLPAPERS).map((w) => (
            <span key={w.name} style={{ display: 'contents' }}>
              <dt>{w.name}</dt>
              <dd>
                {w.credit},{' '}
                <a
                  href={w.source}
                  onClick={(e) => {
                    e.preventDefault()
                    void call('nav.go', w.source, 'newtab')
                  }}
                >
                  {w.source.replace('https://', '')}
                </a>
              </dd>
            </span>
          ))}
        </dl>
      </Group>
      <Group title="Open-source software" intro="Auralis is made possible by these projects and their authors.">
        <pre className="notices">{notices || 'Loading…'}</pre>
      </Group>
    </Shell>
  )
}
