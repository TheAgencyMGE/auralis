import { useEffect, useState } from 'react'
import type { ExtensionInfo } from '@shared/types'
import { bridge, call } from '@ui/api'
import { Icon } from '@ui/icons'
import { Group, Shell } from '../Shell'

const STORE = 'https://chromewebstore.google.com/category/extensions'

export default function Extensions() {
  const [list, setList] = useState<ExtensionInfo[] | null>(null)
  const [msg, setMsg] = useState('')
  const load = () => void call<ExtensionInfo[]>('extensions.list').then(setList)
  useEffect(() => {
    document.title = 'Extensions'
    load()
    return bridge().on('extensions', load)
  }, [])

  const loadUnpacked = async () => {
    const r = await call<{ name?: string; error?: string; canceled?: boolean }>('extensions.loadUnpacked')
    if (r.error) setMsg(r.error)
    else if (r.name) setMsg(`Loaded “${r.name}”.`)
    load()
  }

  const tools = (
    <>
      <button className="btn is-default" onClick={() => void call('nav.go', STORE)}>
        Get extensions
      </button>
    </>
  )

  return (
    <Shell icon="extensions" title="Extensions" subtitle="Add features to Auralis from the Chrome Web Store." tools={tools}>
      <Group title="Installed extensions" intro="Extensions run in normal windows only, never in InPrivate. Click an extension’s button on the toolbar to use it.">
        {list && list.length === 0 && (
          <div className="ext-empty">
            <p>You haven’t added any extensions yet.</p>
            <p>
              Open the{' '}
              <a
                href={STORE}
                onClick={(e) => {
                  e.preventDefault()
                  void call('nav.go', STORE)
                }}
              >
                Chrome Web Store
              </a>
              , pick an extension and click <strong>Add to Chrome</strong>. Auralis installs it.
            </p>
          </div>
        )}
        <div className="ext-list">
          {list?.map((e) => (
            <div key={e.id} className="ext-row">
              {e.icon ? <img className="ext-icon" src={e.icon} width={40} height={40} alt="" /> : <Icon name="extensions" size={32} className="ext-icon" />}
              <div className="ext-text">
                <div className="ext-name">
                  {e.name} <span className="ext-version">{e.version}</span>
                  {e.unpacked && <span className="ext-tag">Unpacked</span>}
                </div>
                {e.description && <div className="ext-desc">{e.description}</div>}
              </div>
              <div className="ext-actions">
                {e.options && (
                  <button className="btn" onClick={() => void call('extensions.options', e.id)}>
                    Options
                  </button>
                )}
                <button className="btn is-danger" onClick={() => void call('extensions.remove', e.id).then(load)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </Group>
      <Group title="Updates" intro="Extensions from the Chrome Web Store update themselves when Auralis starts and every few hours.">
        <button
          className="btn"
          onClick={() => {
            setMsg('Checking for updates…')
            void call('extensions.update').then(() => {
              setMsg('Extensions are up to date.')
              load()
            })
          }}
        >
          Update now
        </button>
      </Group>
      <Group title="Developer mode" intro="Load an extension you’re building from its folder. It loads again each time Auralis starts, until you remove it.">
        <button className="btn" onClick={() => void loadUnpacked()}>
          Load unpacked…
        </button>
        {msg && <p className="ext-msg">{msg}</p>}
      </Group>
    </Shell>
  )
}
