import { describe, expect, it, vi } from 'vitest'

// shortcuts.ts imports commands.ts, which needs Electron; only the pure
// resolver is under test here.
vi.mock('../../src/main/commands', () => ({ runCommand: () => true, COMMANDS: [] }))
const { resolveShortcut } = await import('../../src/main/shortcuts')
import fs from 'node:fs'

// Command ids, read from source so this test can't drift from the registry.
const COMMANDS_FOR_TEST = [...fs.readFileSync('src/main/commands.ts', 'utf8').matchAll(/\{ id: '([a-z0-9-]+)'/g)].map((m) => m[1])

const k = (key: string, mods: Partial<{ control: boolean; shift: boolean; alt: boolean }> = {}) =>
  resolveShortcut({ key, control: false, shift: false, alt: false, meta: false, ...mods })

describe('keyboard shortcuts', () => {
  it('maps the classic browser keys', () => {
    expect(k('t', { control: true })).toBe('new-tab')
    expect(k('T', { control: true, shift: true })).toBe('reopen-tab')
    expect(k('w', { control: true })).toBe('close-tab')
    expect(k('l', { control: true })).toBe('focus-address')
    expect(k('d', { alt: true })).toBe('focus-address')
    expect(k('F5')).toBe('reload')
    expect(k('ArrowLeft', { alt: true })).toBe('back')
    expect(k('Tab', { control: true, shift: true })).toBe('prev-tab')
    expect(k('=', { control: true })).toBe('zoom-in')
    expect(k('0', { control: true })).toBe('zoom-reset')
  })
  it('keeps tab-number jumps distinct from tab commands', () => {
    expect(k('A', { control: true, shift: true })).toBe('tab-flip')
    expect(k('3', { control: true })).toBe('goto-tab:3')
  })
  it('ignores plain typing', () => {
    expect(k('a')).toBeNull()
    expect(k('Escape')).toBeNull()
    expect(k('Enter')).toBeNull()
  })
  it('only resolves to commands that exist', () => {
    const keys: [string, Partial<{ control: boolean; shift: boolean; alt: boolean }>][] = []
    for (const key of 'abcdefghijklmnopqrstuvwxyz0123456789=-,/[]{}'.split('')) {
      keys.push([key, { control: true }], [key, { control: true, shift: true }], [key, { alt: true }])
    }
    for (const key of ['F3', 'F5', 'F6', 'F9', 'F11', 'F12', 'Escape', 'Tab', 'PageUp', 'PageDown', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'F4']) {
      keys.push([key, {}], [key, { control: true }], [key, { shift: true }], [key, { alt: true }], [key, { control: true, shift: true }])
    }
    const special = new Set(['find-next', 'find-prev'])
    for (const [key, mods] of keys) {
      const id = k(key, mods)
      if (!id || id.startsWith('goto-tab:') || special.has(id)) continue
      expect(COMMANDS_FOR_TEST, `${key} ${JSON.stringify(mods)} -> ${id}`).toContain(id)
    }
  })
})
