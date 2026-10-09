import { useEffect, useMemo, useState } from 'react'
import type { ProcessRow } from '@shared/types'
import { call } from '@ui/api'
import { Shell } from '../Shell'

type SortKey = 'title' | 'memoryKB' | 'cpu' | 'pid'

export default function TaskManager() {
  const [rows, setRows] = useState<ProcessRow[]>([])
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'memoryKB', dir: -1 })
  const [sel, setSel] = useState<number | null>(null)

  useEffect(() => {
    document.title = 'Task Manager'
    let live = true
    const load = () => !document.hidden && void call<ProcessRow[]>('tasks.list').then((r) => live && setRows(r))
    load()
    const t = window.setInterval(load, 1500)
    return () => {
      live = false
      window.clearInterval(t)
    }
  }, [])

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const va = a[sort.key]
        const vb = b[sort.key]
        return (typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)) * sort.dir
      }),
    [rows, sort]
  )
  const totalMB = rows.reduce((a, r) => a + r.memoryKB, 0) / 1024
  const sleeping = rows.filter((r) => r.asleep).length
  const selected = rows.find((r) => r.tabId === sel)

  const th = (key: SortKey, label: string, num = false) => (
    <th className={num ? 'num' : ''} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className="link-like" onClick={() => setSort({ key, dir: sort.key === key ? ((-sort.dir) as 1 | -1) : num ? -1 : 1 })}>
        {label}
        {sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )

  return (
    <Shell
      icon="gauge"
      title="Task Manager"
      subtitle={`Auralis is using ${totalMB >= 1024 ? `${(totalMB / 1024).toFixed(2)} GB` : `${Math.round(totalMB)} MB`} of memory. ${sleeping} tab${sleeping === 1 ? ' is' : 's are'} asleep and using none.`}
      tools={
        <>
          <button className="btn" disabled={!selected || selected.asleep} onClick={() => selected && void call('tasks.action', selected.tabId, 'sleep')}>
            Put to sleep
          </button>
          <button className="btn" disabled={!selected} onClick={() => selected && void call('tasks.action', selected.tabId, 'end')}>
            End process
          </button>
        </>
      }
    >
      <table className="grid-table">
        <thead>
          <tr>
            {th('title', 'Task')}
            {th('memoryKB', 'Memory', true)}
            {th('cpu', 'CPU', true)}
            {th('pid', 'Process ID', true)}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr
              key={`${r.pid}-${r.tabId ?? i}`}
              className={r.tabId != null && r.tabId === sel ? 'is-selected' : ''}
              onClick={() => setSel(r.tabId)}
              onDoubleClick={() => r.tabId != null && void call('tasks.action', r.tabId, 'focus')}
            >
              <td className="name" title={r.url}>
                {r.type === 'Tab' ? 'Tab: ' : ''}
                {r.title}
                {r.asleep && <span className="pill is-sleep" style={{ marginLeft: 8 }}>Asleep</span>}
              </td>
              <td className="num">{r.asleep ? <span className="muted">0 K</span> : `${Math.round(r.memoryKB).toLocaleString()} K`}</td>
              <td className="num">{r.asleep ? <span className="muted">0</span> : r.cpu.toFixed(1)}</td>
              <td className="num muted">{r.pid || '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  )
}
