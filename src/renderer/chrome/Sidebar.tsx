// The Sidebar: Vista's gadget column, docked on the glass beside the page.
// The page view shrinks to make room, so nothing is ever covered.
import { useState } from 'react'
import { NEW_GADGETS, type Settings } from '@shared/settings'
import { call } from '@ui/api'
import { Icon } from '@ui/icons'
import { GADGETS, Gadgets, NewBadge, hasSidebarGadgets } from '@ui/gadgets'

export function SidePanel({ settings }: { settings: Settings }) {
  const [gallery, setGallery] = useState(false)
  const empty = !hasSidebarGadgets(settings.widgets)
  return (
    <aside className="side-panel" aria-label="Sidebar">
      <div className="side-head">
        <button className={`side-btn${gallery ? ' is-on' : ''}`} title="Add gadgets" aria-label="Add gadgets" aria-expanded={gallery} onClick={() => setGallery((g) => !g)}>
          <Icon name="plus" size={13} />
        </button>
        <span className="side-title glow-text">Sidebar</span>
        <button className="side-btn" title="Close the Sidebar" aria-label="Close the Sidebar" onClick={() => void call('settings.set', { sidebar: false })}>
          <Icon name="close" size={11} />
        </button>
      </div>
      {gallery && (
        <div className="side-gallery" role="group" aria-label="Gadgets">
          {GADGETS.filter((g) => g.sidebar).map((g) => (
            <label key={g.key} className="side-gallery-row">
              <input type="checkbox" checked={settings.widgets[g.key]} onChange={(e) => void call('settings.set', { widgets: { [g.key]: e.target.checked } })} />
              <span>
                {g.label}
                {NEW_GADGETS.includes(g.key) && <NewBadge />}
              </span>
            </label>
          ))}
        </div>
      )}
      <div className="side-scroll">
        {empty && !gallery && <p className="side-empty glow-text">Click + to add gadgets.</p>}
        <Gadgets s={settings} />
      </div>
    </aside>
  )
}
