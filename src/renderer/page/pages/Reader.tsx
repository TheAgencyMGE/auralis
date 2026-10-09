// Reader view. Article HTML comes from Readability; it is sanitised again
// here and the page's CSP forbids scripts, so nothing from the source runs.
import { useEffect, useMemo, useState } from 'react'
import { call } from '@ui/api'
import { Icon } from '@ui/icons'

interface Article {
  title: string
  byline: string | null
  siteName: string | null
  content: string
  length: number
  dir: string | null
  lang: string | null
  url: string
}

const ALLOWED = new Set(['P', 'A', 'EM', 'STRONG', 'B', 'I', 'U', 'S', 'SUB', 'SUP', 'BR', 'HR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'IMG', 'FIGURE', 'FIGCAPTION', 'PICTURE', 'SOURCE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'DIV', 'SPAN', 'SECTION', 'ARTICLE', 'DL', 'DT', 'DD', 'MARK', 'SMALL', 'TIME', 'ABBR', 'CITE', 'Q', 'KBD'])
const ATTRS = new Set(['href', 'src', 'alt', 'title', 'width', 'height', 'srcset', 'colspan', 'rowspan', 'datetime'])

export function sanitize(html: string, base: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const walk = (el: Element) => {
    for (const child of [...el.children]) {
      if (!ALLOWED.has(child.tagName)) {
        // Drop dangerous elements entirely; unwrap harmless unknown ones.
        if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|FORM|INPUT|BUTTON|TEXTAREA|SELECT|LINK|META|SVG|MATH|NOSCRIPT|TEMPLATE|FRAME|FRAMESET)$/.test(child.tagName)) child.remove()
        else {
          walk(child)
          child.replaceWith(...child.childNodes)
        }
        continue
      }
      for (const attr of [...child.attributes]) {
        if (!ATTRS.has(attr.name)) child.removeAttribute(attr.name)
      }
      for (const name of ['href', 'src']) {
        const v = child.getAttribute(name)
        if (!v) continue
        try {
          const u = new URL(v, base)
          if (!/^https?:$/.test(u.protocol)) child.removeAttribute(name)
          else child.setAttribute(name, u.href)
        } catch {
          child.removeAttribute(name)
        }
      }
      if (child.hasAttribute('srcset') && /javascript:/i.test(child.getAttribute('srcset')!)) child.removeAttribute('srcset')
      walk(child)
    }
  }
  walk(doc.body)
  return doc.body.innerHTML
}

const THEMES = ['light', 'paper', 'dusk'] as const

export default function Reader() {
  const id = new URLSearchParams(location.search).get('id') ?? ''
  const [article, setArticle] = useState<Article | null | undefined>(undefined)
  const [size, setSize] = useState(() => Number(localStorage.getItem('reader.size')) || 19)
  const [theme, setTheme] = useState<(typeof THEMES)[number]>(() => (localStorage.getItem('reader.theme') as (typeof THEMES)[number]) || 'light')

  useEffect(() => {
    void call<Article | null>('reader.get', id).then((a) => {
      setArticle(a)
      if (a) document.title = a.title
    })
  }, [id])
  useEffect(() => {
    document.documentElement.dataset.reader = theme
    localStorage.setItem('reader.theme', theme)
  }, [theme])
  useEffect(() => localStorage.setItem('reader.size', String(size)), [size])

  const html = useMemo(() => (article ? sanitize(article.content, article.url) : ''), [article])
  const minutes = article ? Math.max(1, Math.round(article.length / 1100)) : 0

  if (article === undefined) return null
  if (!article) {
    return (
      <div className="errp">
        <h1>This article is no longer available</h1>
        <p className="errp-lede">Reader view keeps recent articles only while Auralis is open. Go back and open Reader view again.</p>
      </div>
    )
  }
  return (
    <div className="reader" style={{ '--reader-size': `${size}px` } as React.CSSProperties}>
      <div className="reader-bar">
        <button className="btn" onClick={() => history.back()}>
          <Icon name="back" size={13} /> Back to page
        </button>
        <span className="spacer" />
        <button className="btn" style={{ minWidth: 0 }} aria-label="Smaller text" onClick={() => setSize((s) => Math.max(14, s - 1))}>
          A−
        </button>
        <button className="btn" style={{ minWidth: 0 }} aria-label="Larger text" onClick={() => setSize((s) => Math.min(28, s + 1))}>
          A+
        </button>
        <select className="field" value={theme} onChange={(e) => setTheme(e.target.value as (typeof THEMES)[number])} aria-label="Page color">
          <option value="light">Light</option>
          <option value="paper">Paper</option>
          <option value="dusk">Dusk</option>
        </select>
      </div>
      <article lang={article.lang ?? undefined} dir={article.dir ?? undefined}>
        <a
          className="r-site"
          href={article.url}
          onClick={(e) => {
            e.preventDefault()
            void call('nav.go', article.url)
          }}
        >
          {article.siteName || new URL(article.url).hostname}
        </a>
        <h1 className="r-title">{article.title}</h1>
        <div className="r-byline">
          {article.byline ? `${article.byline}. ` : ''}
          {minutes} minute read
        </div>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </div>
  )
}
