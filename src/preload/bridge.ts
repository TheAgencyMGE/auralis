/// <reference lib="dom" />
// Builds the narrow API exposed to trusted Auralis renderers. Nothing from
// Electron leaks through: no ipcRenderer, no event objects, only a method
// call with a fixed name list and a subscription to named events.
import { contextBridge, ipcRenderer } from 'electron'
import { EVENTS, IPC_CALL, IPC_EVENT, type AuralisBridge, type EventName, type Method } from '../shared/ipc'

export function exposeBridge(allowed: readonly string[]): void {
  const listeners = new Map<EventName, Set<(p: unknown) => void>>()
  ipcRenderer.on(IPC_EVENT, (_e, name: EventName, payload: unknown) => {
    listeners.get(name)?.forEach((cb) => {
      try {
        cb(payload)
      } catch (err) {
        console.error(err)
      }
    })
  })
  const bridge: AuralisBridge = {
    call: (method: Method, ...args: unknown[]) => {
      if (!allowed.includes(method)) return Promise.reject(new Error(`Method not allowed: ${method}`))
      return ipcRenderer.invoke(IPC_CALL, method, ...args)
    },
    on: (event: EventName, cb: (payload: unknown) => void) => {
      if (!(EVENTS as readonly string[]).includes(event) || typeof cb !== 'function') return () => {}
      let set = listeners.get(event)
      if (!set) listeners.set(event, (set = new Set()))
      set.add(cb)
      return () => set!.delete(cb)
    },
    platform: process.platform
  }
  contextBridge.exposeInMainWorld('auralis', bridge)
}
