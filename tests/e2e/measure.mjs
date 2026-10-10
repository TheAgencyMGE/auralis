// Measures startup time and idle memory with one new tab open.
import { _electron as electron } from 'playwright'
const profile = process.argv[2]
const t0 = Date.now()
const app = await electron.launch({ args: ['.'], env: { ...process.env, AURALIS_E2E: '1', AURALIS_USER_DATA: profile } })
const chrome = await app.firstWindow()
await chrome.waitForSelector('.omnibox')
const ready = Date.now() - t0
await new Promise((r) => setTimeout(r, 8000))
const mem = await app.evaluate(({ app }) => {
  const m = app.getAppMetrics()
  return { totalMB: Math.round(m.reduce((a, x) => a + x.memory.workingSetSize, 0) / 1024), privateMB: Math.round(m.reduce((a, x) => a + (x.memory.privateBytes ?? 0), 0) / 1024), cpu: +m.reduce((a, x) => a + x.cpu.percentCPUUsage, 0).toFixed(1), processes: m.length, byType: m.map((x) => x.type + (x.serviceName ? ":" + x.serviceName : "") + "=" + Math.round(x.memory.workingSetSize / 1024) + "/" + Math.round((x.memory.privateBytes ?? 0) / 1024)) }
})
console.log(JSON.stringify({ readyMs: ready, ...mem }))
await app.close()
