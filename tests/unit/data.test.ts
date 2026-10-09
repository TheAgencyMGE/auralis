import { beforeEach, describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { migrate } from '../../src/main/data/db'
import { HistoryStore, ftsQuery } from '../../src/main/data/history'
import { BAR_ID, BookmarkStore, OTHER_ID, parseChromiumJson, parseNetscapeHtml } from '../../src/main/data/bookmarks'
import { PermissionStore } from '../../src/main/data/permissions'

let db: DatabaseSync
beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  migrate(db)
})

describe('history', () => {
  it('records visits and searches titles and urls with prefixes', () => {
    const h = new HistoryStore(db)
    h.addVisit('https://github.com/electron/electron', 'Electron repository')
    h.addVisit('https://example.com/', 'Example Domain')
    expect(h.search('elec').map((e) => e.url)).toEqual(['https://github.com/electron/electron'])
    expect(h.search('git')[0].url).toContain('github.com')
    expect(h.search('')).toHaveLength(2)
  })
  it('ignores non-web schemes', () => {
    const h = new HistoryStore(db)
    h.addVisit('auralis://settings/', 'Settings')
    h.addVisit('javascript:alert(1)', 'x')
    expect(h.count()).toBe(0)
  })
  it('ranks typed, frequent hosts first and completes inline', () => {
    const h = new HistoryStore(db)
    for (let i = 0; i < 5; i++) h.addVisit('https://github.com/', 'GitHub', true)
    h.addVisit('https://gitlab.com/', 'GitLab')
    expect(h.suggest('git')[0].url).toBe('https://github.com/')
    expect(h.inlineCompletion('gi')).toBe('github.com/')
    expect(h.inlineCompletion('nothing')).toBeNull()
  })
  it('builds safe FTS queries from hostile input', () => {
    expect(ftsQuery('"a" OR b*')).toBe('"a"* "or"* "b"*')
    expect(ftsQuery('   ')).toBeNull()
    const h = new HistoryStore(db)
    expect(() => h.search('NEAR( "x')).not.toThrow()
  })
  it('removes recent history and recounts visits', () => {
    const h = new HistoryStore(db)
    h.addVisit('https://a.com/', 'A', false, 1000)
    h.addVisit('https://a.com/', 'A', false, 5000)
    h.addVisit('https://b.com/', 'B', false, 6000)
    h.removeSince(4000)
    const rows = h.search('')
    expect(rows.map((r) => r.url)).toEqual(['https://a.com/'])
    expect(rows[0].visitCount).toBe(1)
  })
  it('groups top sites by host and respects hidden hosts', () => {
    const h = new HistoryStore(db)
    for (let i = 0; i < 3; i++) h.addVisit('https://www.news.com/a', 'News A')
    h.addVisit('https://www.news.com/', 'News')
    h.addVisit('https://other.com/', 'Other')
    h.addVisit('https://search.com/?q=x', 'Search')
    const top = h.topSites(8)
    expect(top.map((t) => new URL(t.url).hostname)).toEqual(['www.news.com', 'other.com'])
    h.hideTopSite('news.com')
    expect(h.topSites(8).map((t) => t.url)).toEqual(['https://other.com/'])
  })
})

describe('bookmarks', () => {
  it('creates, orders, moves and removes', () => {
    const b = new BookmarkStore(db)
    const a = b.create({ parentId: BAR_ID, kind: 'url', title: 'A', url: 'https://a.com/' })
    const c = b.create({ parentId: BAR_ID, kind: 'url', title: 'C', url: 'https://c.com/' })
    const m = b.create({ parentId: BAR_ID, kind: 'url', title: 'B', url: 'https://b.com/', index: 1 })
    expect(b.children(BAR_ID).map((n) => n.title)).toEqual(['A', 'B', 'C'])
    b.move(c.id, BAR_ID, 0)
    expect(b.children(BAR_ID).map((n) => n.title)).toEqual(['C', 'A', 'B'])
    const f = b.create({ parentId: OTHER_ID, kind: 'folder', title: 'F' })
    b.move(m.id, f.id, 0)
    expect(b.children(f.id).map((n) => n.title)).toEqual(['B'])
    expect(b.findByUrl('https://a.com/')?.id).toBe(a.id)
    b.remove(f.id)
    expect(b.get(m.id)).toBeNull()
  })
  it('refuses invalid operations', () => {
    const b = new BookmarkStore(db)
    expect(() => b.create({ parentId: BAR_ID, kind: 'url', title: 'x', url: 'javascript:alert(1)' })).toThrow()
    expect(() => b.remove(BAR_ID)).toThrow()
    const f = b.create({ parentId: OTHER_ID, kind: 'folder', title: 'F' })
    const g = b.create({ parentId: f.id, kind: 'folder', title: 'G' })
    expect(() => b.move(f.id, g.id, 0)).toThrow()
  })
  it('round-trips Netscape HTML export and import', () => {
    const b = new BookmarkStore(db)
    const f = b.create({ parentId: BAR_ID, kind: 'folder', title: 'Dev & "Tools"' })
    b.create({ parentId: f.id, kind: 'url', title: 'MDN <docs>', url: 'https://developer.mozilla.org/?a=1&b=2' })
    b.create({ parentId: BAR_ID, kind: 'url', title: 'Example', url: 'https://example.com/' })
    const parsed = parseNetscapeHtml(b.exportHtml())
    const bar = parsed.find((n) => n.title === 'Favorites bar')!
    expect(bar.children!.map((n) => n.title)).toEqual(['Dev & "Tools"', 'Example'])
    expect(bar.children![0].children![0]).toEqual({ title: 'MDN <docs>', url: 'https://developer.mozilla.org/?a=1&b=2' })
    expect(b.importTree('Imported', parsed)).toBe(2)
  })
  it('parses Chromium bookmark JSON', () => {
    const json = JSON.stringify({
      roots: {
        bookmark_bar: { type: 'folder', name: 'Bookmarks bar', children: [{ type: 'url', name: 'A', url: 'https://a.com/' }] },
        other: { type: 'folder', name: 'Other', children: [{ type: 'folder', name: 'F', children: [{ type: 'url', name: 'B', url: 'https://b.com/' }] }] },
        synced: { type: 'folder', name: 'Mobile', children: [] }
      }
    })
    const nodes = parseChromiumJson(json)
    expect(nodes.map((n) => n.title)).toEqual(['Favorites bar', 'Other'])
    const b = new BookmarkStore(db)
    expect(b.importTree('Chrome', nodes)).toBe(2)
  })
})

describe('permissions', () => {
  it('remembers and forgets decisions', () => {
    const p = new PermissionStore(db)
    p.set('https://maps.example', 'geolocation', 'allow')
    p.set('https://maps.example', 'notifications', 'deny')
    expect(p.get('https://maps.example', 'geolocation')).toBe('allow')
    p.set('https://maps.example', 'geolocation', 'deny')
    expect(p.get('https://maps.example', 'geolocation')).toBe('deny')
    p.remove('https://maps.example', 'geolocation')
    expect(p.forOrigin('https://maps.example')).toEqual([{ permission: 'notifications', decision: 'deny' }])
  })
})
