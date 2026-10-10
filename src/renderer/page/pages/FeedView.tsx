// IE7's feed view: a web feed shown as a readable page, with a box that
// explains what a feed is and lets you follow it in Feed Headlines.
import { useEffect, useMemo, useState } from 'react'
import { call, useSettings } from '@ui/api'
import { parseFeed, type Feed } from '@ui/feed'

export default function FeedView() {
  const s = useSettings()
  const url = new URLSearchParams(location.search).get('url') ?? ''
  const [feed, setFeed] = useState<Feed | null>(null)
  const [error, setError] = useState('')
  const [sort, setSort] = useState<'date' | 'title'>('date')
  const [q, setQ] = useState('')

  useEffect(() => {
    document.title = 'Feed'
    void call<{ text: string; url: string } | { error: string }>('feed.get', url).then((r) => {
      if ('error' in r) return setError(r.error)
      const f = parseFeed(r.text, r.url)
      if (!f) return setError('This address doesn’t contain a feed Auralis can read.')
      document.title = f.title
      setFeed(f)
    })
  }, [url])

  const items = useMemo(() => {
    if (!feed) return []
    const n = q.trim().toLowerCase()
    const list = feed.items.filter((i) => !n || i.title.toLowerCase().includes(n) || i.summary.toLowerCase().includes(n))
    return sort === 'title' ? [...list].sort((a, b) => a.title.localeCompare(b.title)) : [...list].sort((a, b) => (b.date ?? 0) - (a.date ?? 0))
  }, [feed, q, sort])

  const following = s.widgets.news && s.newsFeed === url
  const open = (link: string | null, e?: React.MouseEvent) => {
    if (!link) return
    e?.preventDefault()
    void call('nav.go', link, e && (e.ctrlKey || e.button === 1) ? 'background' : 'current')
  }

  return (
    <div className="fv">
      <header className="fv-head">
        <img src="/art/feed.svg" width={40} height={40} alt="" />
        <div>
          <h1>{feed?.title ?? (error ? 'Feed unavailable' : 'Loading feed…')}</h1>
          {feed?.description && <p>{feed.description}</p>}
        </div>
      </header>
      <div className="fv-body">
        <main className="fv-items">
          <div className="fv-about">
            <p>
              <strong>You are viewing a feed that contains frequently updated content.</strong> Follow it and its newest headlines appear in
              the Feed Headlines gadget, on new tabs and in the Sidebar.
            </p>
            <button className="btn is-default" disabled={following || !feed} onClick={() => void call('settings.set', { newsFeed: url, widgets: { news: true } })}>
              {following ? 'Following in Feed Headlines' : 'Follow in Feed Headlines'}
            </button>
          </div>
          {error && <p className="fv-error">{error}</p>}
          {items.map((it, i) => (
            <article key={i} className="fv-item">
              <h2>
                {it.link ? (
                  <a href={it.link} onClick={(e) => open(it.link, e)} onAuxClick={(e) => e.button === 1 && open(it.link, e)}>
                    {it.title}
                  </a>
                ) : (
                  it.title
                )}
              </h2>
              {it.date && <time dateTime={new Date(it.date).toISOString()}>{new Date(it.date).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}</time>}
              {it.summary && <p>{it.summary}</p>}
            </article>
          ))}
          {feed && items.length === 0 && <p className="fv-error">No items match “{q}”.</p>}
        </main>
        <aside className="fv-side" aria-label="Arrange the feed">
          <div className="fv-count">
            Displaying <strong>{items.length}</strong> / {feed?.items.length ?? 0}
          </div>
          <input className="field" type="search" placeholder="Search this feed" aria-label="Search this feed" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="fv-sort">
            <span>Sort by:</span>
            <button className={sort === 'date' ? 'is-on' : ''} onClick={() => setSort('date')}>
              Date
            </button>
            <button className={sort === 'title' ? 'is-on' : ''} onClick={() => setSort('title')}>
              Title
            </button>
          </div>
          {feed?.link && (
            <a className="fv-site" href={feed.link} onClick={(e) => open(feed.link, e)}>
              Go to the website
            </a>
          )}
        </aside>
      </div>
    </div>
  )
}
