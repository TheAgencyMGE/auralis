// The Control Panel layout: a task pane on the left, content on the right.
import type { ReactNode } from 'react'
import { Icon } from '@ui/icons'
import { Orb } from '@ui/Orb'

const PAGES = [
  { host: 'settings', label: 'Settings', icon: 'settings' },
  { host: 'bookmarks', label: 'Favorites', icon: 'star' },
  { host: 'history', label: 'History', icon: 'history' },
  { host: 'downloads', label: 'Downloads', icon: 'download' },
  { host: 'taskmanager', label: 'Task Manager', icon: 'gauge' },
  { host: 'about', label: 'About Auralis', icon: 'info' }
]

export function Shell({
  icon,
  title,
  subtitle,
  tools,
  pane,
  children
}: {
  icon: string
  title: string
  subtitle?: string
  tools?: ReactNode
  pane?: ReactNode
  children: ReactNode
}) {
  const here = location.hostname
  return (
    <div className="cp">
      <aside className="cp-pane">
        <div className="cp-brand">
          <Orb size={26} />
          Auralis
        </div>
        {pane}
        {pane && <div className="cp-pane-sep" />}
        <nav className="cp-nav" aria-label="Auralis pages">
          {PAGES.filter((p) => p.host !== here || !pane).map((p) => (
            <a key={p.host} href={`auralis://${p.host}/`} className={p.host === here ? 'is-on' : ''} aria-current={p.host === here ? 'page' : undefined}>
              <Icon name={p.icon} />
              {p.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="cp-main">
        <header className="cp-head">
          <span className="cp-head-icon">
            <Icon name={icon} size={26} />
          </span>
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {tools && <div className="cp-head-tools">{tools}</div>}
        </header>
        {children}
      </main>
    </div>
  )
}

export function Group({ id, title, intro, children }: { id?: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className="cp-group" id={id} aria-labelledby={id ? `${id}-h` : undefined}>
      <h2 id={id ? `${id}-h` : undefined}>{title}</h2>
      {intro && <p>{intro}</p>}
      {children}
    </section>
  )
}

export function Row({ label, help, children, htmlFor }: { label: ReactNode; help?: ReactNode; children?: ReactNode; htmlFor?: string }) {
  return (
    <div className="cp-row">
      <label className="cp-row-text" htmlFor={htmlFor}>
        {label}
        {help && <small>{help}</small>}
      </label>
      {children}
    </div>
  )
}
