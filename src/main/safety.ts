// Dangerous-site warnings. Two community blocklists from the malware-filter
// project are downloaded and refreshed every 12 hours: phishing domains
// (OpenPhish, PhishTank, IPThreat; CC BY-SA 4.0) and malware domains
// (URLhaus by abuse.ch; CC0). Nothing about the pages you visit is sent
// anywhere: every check is a local lookup.
//
// The lists hold ~55k hosts. They're kept as sorted 64-bit hashes (about
// half a megabyte) rather than strings, and looked up by binary search.
import { net } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { settings, userFile } from './context'
import { logger } from './log'

const log = logger('safety')
const FILE = () => userFile('safety-lists.bin')
const MAX_AGE = 12 * 3_600_000

export type Threat = 'phishing' | 'malware'
const KINDS: Threat[] = ['phishing', 'malware']

const LISTS: { kind: Threat; urls: string[] }[] = [
  {
    kind: 'phishing',
    urls: ['https://malware-filter.gitlab.io/malware-filter/phishing-filter-domains.txt', 'https://phishing-filter.pages.dev/phishing-filter-domains.txt']
  },
  {
    kind: 'malware',
    urls: ['https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-domains.txt', 'https://urlhaus-filter.pages.dev/urlhaus-filter-domains.txt']
  }
]

let hashes = new BigUint64Array(0)
let kinds = new Uint8Array(0)
let updated = 0

/** Hosts the user chose to visit anyway, for this session only. */
const bypass = new Set<string>()
export const allowUnsafeHost = (host: string) => bypass.add(host)

/** webContentsId → the dangerous navigation that was stopped. */
const stopped = new Map<number, { url: string; threat: Threat }>()
export const stoppedNavigation = (id: number) => stopped.get(id) ?? null
export const clearStopped = (id: number) => stopped.delete(id)

const hash = (host: string): bigint => crypto.createHash('sha1').update(host).digest().readBigUInt64BE(0)

function find(h: bigint): number {
  let lo = 0
  let hi = hashes.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const v = hashes[mid]
    if (v === h) return mid
    if (v < h) lo = mid + 1
    else hi = mid - 1
  }
  return -1
}

/** The threat a URL's host (or any parent domain of it) is listed for. */
export function threatFor(url: string): Threat | null {
  if (!hashes.length || !settings.get().safeBrowsing) return null
  let host: string
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    host = u.hostname.toLowerCase().replace(/\.$/, '')
  } catch {
    return null
  }
  if (bypass.has(host)) return null
  const labels = host.split('.')
  // a.b.example.com → a.b.example.com, b.example.com, example.com (never a bare TLD)
  for (let i = 0; i < labels.length - 1; i++) {
    const at = find(hash(labels.slice(i).join('.')))
    if (at >= 0) return KINDS[kinds[at]] ?? 'malware'
  }
  return null
}

/** Called by the request pipeline for top-level navigations it stops. */
export function noteStopped(webContentsId: number | undefined, url: string, threat: Threat): void {
  if (webContentsId != null) stopped.set(webContentsId, { url, threat })
}

export function safetyStats() {
  return { hosts: hashes.length, updated }
}

function build(entries: [string, number][]): void {
  const sorted = entries.map(([h, k]) => [hash(h), k] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  hashes = BigUint64Array.from(sorted.map((e) => e[0]))
  kinds = Uint8Array.from(sorted.map((e) => e[1]))
}

async function load(): Promise<number> {
  const buf = await fs.readFile(FILE())
  const n = buf.readUInt32LE(0)
  if (buf.length !== 4 + n * 9) throw new Error('corrupt safety list')
  const h = new BigUint64Array(n)
  for (let i = 0; i < n; i++) h[i] = buf.readBigUInt64LE(4 + i * 8)
  hashes = h
  kinds = Uint8Array.from(buf.subarray(4 + n * 8))
  return n
}

async function save(): Promise<void> {
  const n = hashes.length
  const buf = Buffer.alloc(4 + n * 9)
  buf.writeUInt32LE(n, 0)
  for (let i = 0; i < n; i++) buf.writeBigUInt64LE(hashes[i], 4 + i * 8)
  Buffer.from(kinds.buffer, kinds.byteOffset, kinds.length).copy(buf, 4 + n * 8)
  await fs.writeFile(FILE(), buf)
}

async function fetchList(urls: string[]): Promise<string[]> {
  for (const url of urls) {
    try {
      const res = await net.fetch(url)
      if (!res.ok) continue
      const lines = (await res.text()).split('\n').map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#') && l.includes('.'))
      if (lines.length > 100) return lines
    } catch {
      /* try the mirror */
    }
  }
  throw new Error('no list source reachable')
}

async function refresh(): Promise<void> {
  try {
    const entries: [string, number][] = []
    for (const list of LISTS) for (const host of await fetchList(list.urls)) entries.push([host, KINDS.indexOf(list.kind)])
    build(entries)
    updated = Date.now()
    await save()
    log.info(`lists updated: ${hashes.length} hosts`)
  } catch (err) {
    log.warn('list update failed (offline?)', err)
  }
}

export async function initSafety(): Promise<void> {
  try {
    const stat = await fs.stat(FILE()).catch(() => null)
    if (stat) {
      await load()
      updated = stat.mtimeMs
    }
    if (!stat || Date.now() - stat.mtimeMs > MAX_AGE) void refresh()
  } catch (err) {
    log.warn('cached lists unusable, refetching', err)
    void refresh()
  }
  setInterval(() => Date.now() - updated > MAX_AGE && void refresh(), 3_600_000).unref()
}

/** Test hook: replace the lists with a known set. */
export function setSafetyListsForTest(entries: [string, Threat][]): void {
  build(entries.map(([h, k]) => [h, KINDS.indexOf(k)]))
  updated = Date.now()
}
