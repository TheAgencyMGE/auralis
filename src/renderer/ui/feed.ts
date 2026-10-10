// RSS 2.0 / RSS 1.0 / Atom parsing for the feed reader and the headlines
// gadget. Only text and web links come out: markup inside items is reduced
// to its text in an inert document, so nothing from a feed ever executes.

export interface FeedItem {
  title: string
  link: string | null
  date: number | null
  summary: string
}

export interface Feed {
  title: string
  link: string | null
  description: string
  items: FeedItem[]
}

const webLink = (href: string | null | undefined, base: string): string | null => {
  if (!href) return null
  try {
    const u = new URL(href.trim(), base)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

/** Text of an element whose content may itself be (escaped) HTML. */
const plain = (el: Element | null | undefined, max = 600): string => {
  const raw = el?.textContent ?? ''
  if (!raw) return ''
  const text = /<[a-z!/]/i.test(raw) ? (new DOMParser().parseFromString(raw, 'text/html').body.textContent ?? '') : raw
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t
}

const child = (el: Element, ...names: string[]): Element | null => {
  for (const n of names) {
    const found = [...el.children].find((c) => c.localName === n)
    if (found) return found
  }
  return null
}

const when = (el: Element | null): number | null => {
  const t = el?.textContent?.trim()
  if (!t) return null
  const ms = Date.parse(t)
  return Number.isFinite(ms) ? ms : null
}

export function parseFeed(text: string, base: string): Feed | null {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) return null
  const root = doc.documentElement
  if (root.localName === 'feed') {
    const atomLink = (e: Element) => {
      const links = [...e.children].filter((c) => c.localName === 'link')
      const alt = links.find((l) => (l.getAttribute('rel') ?? 'alternate') === 'alternate') ?? links[0]
      return webLink(alt?.getAttribute('href'), base)
    }
    return {
      title: plain(child(root, 'title'), 200) || 'Untitled feed',
      link: atomLink(root),
      description: plain(child(root, 'subtitle'), 400),
      items: [...root.children]
        .filter((c) => c.localName === 'entry')
        .slice(0, 100)
        .map((e) => ({
          title: plain(child(e, 'title'), 300) || 'Untitled',
          link: atomLink(e),
          date: when(child(e, 'updated', 'published')),
          summary: plain(child(e, 'summary', 'content'))
        }))
    }
  }
  // RSS 2.0 keeps items in <channel>; RSS 1.0 (RDF) beside it.
  const channel = root.localName === 'rss' ? child(root, 'channel') : root.localName === 'RDF' ? child(root, 'channel') : null
  if (!channel) return null
  const itemsParent = root.localName === 'RDF' ? root : channel
  return {
    title: plain(child(channel, 'title'), 200) || 'Untitled feed',
    link: webLink(child(channel, 'link')?.textContent, base),
    description: plain(child(channel, 'description'), 400),
    items: [...itemsParent.children]
      .filter((c) => c.localName === 'item')
      .slice(0, 100)
      .map((i) => ({
        title: plain(child(i, 'title'), 300) || 'Untitled',
        link: webLink(child(i, 'link')?.textContent ?? child(i, 'guid')?.textContent, base),
        date: when(child(i, 'pubDate', 'date')),
        summary: plain(child(i, 'description', 'encoded'))
      }))
  }
}
