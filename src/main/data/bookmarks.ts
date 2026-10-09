// Favorites (bookmarks): a folder tree with fractional positions so a move
// is a single-row update. Also Netscape-HTML and Chromium-JSON import/export.
import type { Db } from './db'
import { transaction } from './db'
import type { BookmarkNode } from '../../shared/types'
import { escapeHtml } from '../../shared/url'

export const BAR_ID = 1
export const OTHER_ID = 2

interface Row {
  id: number
  parent_id: number | null
  kind: 'folder' | 'url'
  title: string
  url: string | null
  position: number
  created: number
}

const toNode = (r: Row): BookmarkNode => ({
  id: r.id,
  parentId: r.parent_id,
  kind: r.kind,
  title: r.title,
  url: r.url,
  position: r.position,
  created: r.created
})

export function isBookmarkableUrl(url: string): boolean {
  return /^(https?|file|auralis):/i.test(url) && url.length <= 8192
}

export class BookmarkStore {
  constructor(private readonly db: Db) {}

  get(id: number): BookmarkNode | null {
    const r = this.db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id) as Row | undefined
    return r ? toNode(r) : null
  }

  children(parentId: number): BookmarkNode[] {
    return (this.db.prepare('SELECT * FROM bookmarks WHERE parent_id = ? ORDER BY position, id').all(parentId) as unknown as Row[]).map(toNode)
  }

  tree(): BookmarkNode[] {
    const rows = (this.db.prepare('SELECT * FROM bookmarks ORDER BY position, id').all() as unknown as Row[]).map(toNode)
    const byId = new Map(rows.map((n) => [n.id, { ...n, children: n.kind === 'folder' ? ([] as BookmarkNode[]) : undefined }]))
    const roots: BookmarkNode[] = []
    for (const n of byId.values()) {
      if (n.parentId == null) roots.push(n)
      else byId.get(n.parentId)?.children?.push(n)
    }
    return roots.sort((a, b) => a.position - b.position)
  }

  folders(): { id: number; title: string; depth: number }[] {
    const out: { id: number; title: string; depth: number }[] = []
    const walk = (nodes: BookmarkNode[], depth: number) => {
      for (const n of nodes) {
        if (n.kind !== 'folder') continue
        out.push({ id: n.id, title: n.title, depth })
        walk(n.children ?? [], depth + 1)
      }
    }
    walk(this.tree(), 0)
    return out
  }

  findByUrl(url: string): BookmarkNode | null {
    const r = this.db.prepare("SELECT * FROM bookmarks WHERE url = ? AND kind = 'url' ORDER BY id LIMIT 1").get(url) as Row | undefined
    return r ? toNode(r) : null
  }

  urlSet(): Set<string> {
    return new Set((this.db.prepare("SELECT url FROM bookmarks WHERE kind = 'url'").all() as { url: string }[]).map((r) => r.url))
  }

  search(text: string, limit = 6): BookmarkNode[] {
    const t = text.trim().toLowerCase()
    if (!t) return []
    const like = `%${t.replace(/[\\%_]/g, (c) => '\\' + c)}%`
    return (
      this.db
        .prepare(
          `SELECT * FROM bookmarks WHERE kind = 'url' AND (lower(title) LIKE ? ESCAPE '\\' OR lower(url) LIKE ? ESCAPE '\\') ORDER BY created DESC LIMIT ?`
        )
        .all(like, like, limit) as unknown as Row[]
    ).map(toNode)
  }

  private nextPosition(parentId: number): number {
    const r = this.db.prepare('SELECT MAX(position) AS p FROM bookmarks WHERE parent_id = ?').get(parentId) as { p: number | null }
    return (r.p ?? -1) + 1
  }

  private assertFolder(id: number): void {
    const r = this.db.prepare('SELECT kind FROM bookmarks WHERE id = ?').get(id) as { kind: string } | undefined
    if (!r || r.kind !== 'folder') throw new Error('Not a folder')
  }

  create(input: { parentId: number; kind: 'folder' | 'url'; title: string; url?: string | null; index?: number }): BookmarkNode {
    this.assertFolder(input.parentId)
    if (input.kind === 'url' && (!input.url || !isBookmarkableUrl(input.url))) throw new Error('Invalid URL')
    const position = input.index != null ? this.positionAt(input.parentId, input.index) : this.nextPosition(input.parentId)
    const res = this.db
      .prepare('INSERT INTO bookmarks (parent_id, kind, title, url, position, created) VALUES (?, ?, ?, ?, ?, ?)')
      .run(input.parentId, input.kind, input.title.slice(0, 1024), input.kind === 'url' ? input.url! : null, position, Date.now())
    return this.get(Number(res.lastInsertRowid))!
  }

  update(id: number, patch: { title?: string; url?: string }): void {
    if (id === BAR_ID || id === OTHER_ID) {
      if (patch.url !== undefined) throw new Error('Cannot change a root folder')
    }
    if (patch.title !== undefined) this.db.prepare('UPDATE bookmarks SET title = ? WHERE id = ?').run(patch.title.slice(0, 1024), id)
    if (patch.url !== undefined) {
      if (!isBookmarkableUrl(patch.url)) throw new Error('Invalid URL')
      this.db.prepare("UPDATE bookmarks SET url = ? WHERE id = ? AND kind = 'url'").run(patch.url, id)
    }
  }

  /** Position that places a node at `index` among a folder's current children. */
  private positionAt(parentId: number, index: number, excludeId?: number): number {
    const kids = this.children(parentId).filter((k) => k.id !== excludeId)
    if (kids.length === 0) return 0
    if (index <= 0) return kids[0].position - 1
    if (index >= kids.length) return kids[kids.length - 1].position + 1
    return (kids[index - 1].position + kids[index].position) / 2
  }

  move(id: number, parentId: number, index: number): void {
    if (id === BAR_ID || id === OTHER_ID) throw new Error('Cannot move a root folder')
    this.assertFolder(parentId)
    // A folder may not move into its own subtree.
    let cursor: number | null = parentId
    while (cursor != null) {
      if (cursor === id) throw new Error('Cannot move a folder into itself')
      cursor = (this.db.prepare('SELECT parent_id FROM bookmarks WHERE id = ?').get(cursor) as { parent_id: number | null } | undefined)?.parent_id ?? null
    }
    const position = this.positionAt(parentId, index, id)
    this.db.prepare('UPDATE bookmarks SET parent_id = ?, position = ? WHERE id = ?').run(parentId, position, id)
  }

  remove(id: number): void {
    if (id === BAR_ID || id === OTHER_ID) throw new Error('Cannot delete a root folder')
    this.db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id)
  }

  // ---- import / export -------------------------------------------------

  /** Import a parsed tree under a new folder in "Other favorites". Returns count of links. */
  importTree(label: string, nodes: ImportNode[], intoBar = false): number {
    let count = 0
    transaction(this.db, () => {
      const parent = intoBar && this.children(BAR_ID).length === 0 ? BAR_ID : this.create({ parentId: OTHER_ID, kind: 'folder', title: label }).id
      const walk = (items: ImportNode[], parentId: number) => {
        for (const n of items) {
          if (n.children) {
            const f = this.create({ parentId, kind: 'folder', title: n.title || 'Folder' })
            walk(n.children, f.id)
          } else if (n.url && isBookmarkableUrl(n.url)) {
            this.create({ parentId, kind: 'url', title: n.title || n.url, url: n.url })
            count++
          }
        }
      }
      walk(nodes, parent)
    })
    return count
  }

  exportHtml(): string {
    const lines = [
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
      '<!-- This is an automatically generated file. It will be read and overwritten. DO NOT EDIT! -->',
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
      '<TITLE>Bookmarks</TITLE>',
      '<H1>Bookmarks</H1>',
      '<DL><p>'
    ]
    const walk = (nodes: BookmarkNode[], depth: number) => {
      const pad = '    '.repeat(depth)
      for (const n of nodes) {
        const added = Math.floor(n.created / 1000)
        if (n.kind === 'folder') {
          const bar = n.id === BAR_ID ? ' PERSONAL_TOOLBAR_FOLDER="true"' : ''
          lines.push(`${pad}<DT><H3 ADD_DATE="${added}"${bar}>${escapeHtml(n.title)}</H3>`)
          lines.push(`${pad}<DL><p>`)
          walk(n.children ?? [], depth + 1)
          lines.push(`${pad}</DL><p>`)
        } else {
          lines.push(`${pad}<DT><A HREF="${escapeHtml(n.url ?? '')}" ADD_DATE="${added}">${escapeHtml(n.title)}</A>`)
        }
      }
    }
    walk(this.tree(), 1)
    lines.push('</DL><p>')
    return lines.join('\n')
  }
}

export interface ImportNode {
  title: string
  url?: string
  children?: ImportNode[]
}

const decodeEntities = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

/** Tolerant parser for the Netscape bookmark format every browser exports. */
export function parseNetscapeHtml(html: string): ImportNode[] {
  const root: ImportNode = { title: '', children: [] }
  const stack: ImportNode[] = [root]
  let pendingFolder: ImportNode | null = null
  const tagRe = /<(\/?)(dl|h3|a)\b([^>]*)>/gi
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(html))) {
    const closing = m[1] === '/'
    const tag = m[2].toLowerCase()
    const attrs = m[3]
    // Text content runs up to the next tag.
    const end = html.indexOf('<', tagRe.lastIndex)
    const text = decodeEntities(html.slice(tagRe.lastIndex, end < 0 ? undefined : end).trim())
    const top = stack[stack.length - 1]
    if (tag === 'dl') {
      if (closing) {
        if (stack.length > 1) stack.pop()
      } else if (pendingFolder) {
        stack.push(pendingFolder)
        pendingFolder = null
      }
    } else if (tag === 'h3' && !closing) {
      const folder: ImportNode = { title: text, children: [] }
      top.children!.push(folder)
      pendingFolder = folder
    } else if (tag === 'a' && !closing) {
      const href = /href\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? /href\s*=\s*'([^']*)'/i.exec(attrs)?.[1]
      if (href) top.children!.push({ title: text, url: decodeEntities(href) })
    }
  }
  // Most exports wrap everything in a single top-level folder list.
  return root.children!
}

/** Chromium "Bookmarks" JSON file (Chrome, Edge, Brave, Vivaldi). */
export function parseChromiumJson(json: string): ImportNode[] {
  interface CNode {
    type: 'folder' | 'url'
    name: string
    url?: string
    children?: CNode[]
  }
  const data = JSON.parse(json) as { roots?: Record<string, CNode> }
  const conv = (n: CNode): ImportNode =>
    n.type === 'folder' ? { title: n.name, children: (n.children ?? []).map(conv) } : { title: n.name, url: n.url }
  const roots = data.roots ?? {}
  const out: ImportNode[] = []
  if (roots.bookmark_bar) out.push({ ...conv(roots.bookmark_bar), title: 'Favorites bar' })
  if (roots.other?.children?.length) out.push({ ...conv(roots.other), title: 'Other' })
  if (roots.synced?.children?.length) out.push({ ...conv(roots.synced), title: 'Mobile' })
  return out
}
