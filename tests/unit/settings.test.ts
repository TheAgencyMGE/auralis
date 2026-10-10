import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, mergeSettings, sanitizeSettings } from '../../src/shared/settings'

describe('settings sanitizer', () => {
  it('returns defaults for garbage', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings('x')).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings([1, 2])).toEqual(DEFAULT_SETTINGS)
  })
  it('rejects wrong types and out-of-range values field by field', () => {
    const s = sanitizeSettings({ searchEngine: 'evil', glassIntensity: 900, showStatusBar: 'yes', sleepAfterMinutes: 7, frameColor: 'leaf' })
    expect(s.searchEngine).toBe(DEFAULT_SETTINGS.searchEngine)
    expect(s.glassIntensity).toBe(100)
    expect(s.showStatusBar).toBe(DEFAULT_SETTINGS.showStatusBar)
    expect(s.sleepAfterMinutes).toBe(DEFAULT_SETTINGS.sleepAfterMinutes)
    expect(s.frameColor).toBe('leaf')
  })
  it('refuses script home pages', () => {
    expect(sanitizeSettings({ homePage: 'javascript:alert(1)' }).homePage).toBe(DEFAULT_SETTINGS.homePage)
    expect(sanitizeSettings({ homePage: 'https://example.com/' }).homePage).toBe('https://example.com/')
  })
  it('filters the shield allowlist to hostnames', () => {
    expect(sanitizeSettings({ shieldAllowlist: ['example.com', '<script>', 5, 'example.com'] }).shieldAllowlist).toEqual(['example.com'])
  })
  it('merges nested widget patches without losing siblings', () => {
    const next = mergeSettings(DEFAULT_SETTINGS, { widgets: { notes: false } })
    expect(next.widgets).toEqual({ ...DEFAULT_SETTINGS.widgets, notes: false })
  })
  it('validates weather location coordinates', () => {
    expect(sanitizeSettings({ weatherLocation: { name: 'Oslo', lat: 59.9, lon: 10.7 } }).weatherLocation).toEqual({ name: 'Oslo', lat: 59.9, lon: 10.7 })
    expect(sanitizeSettings({ weatherLocation: { name: 'X', lat: 200, lon: 0 } }).weatherLocation).toBeNull()
  })
  it('keeps the news feed a web URL', () => {
    expect(sanitizeSettings({ newsFeed: 'javascript:alert(1)' }).newsFeed).toBe(DEFAULT_SETTINGS.newsFeed)
    expect(sanitizeSettings({ newsFeed: 'file:///C:/secret.xml' }).newsFeed).toBe(DEFAULT_SETTINGS.newsFeed)
    expect(sanitizeSettings({ newsFeed: 'https://example.com/feed.xml' }).newsFeed).toBe('https://example.com/feed.xml')
  })
  it('accepts only known currencies, at most four, without repeats', () => {
    const s = sanitizeSettings({ currencyBase: 'XXX', currencyQuotes: ['EUR', 'EUR', 'BTC', 'GBP', 'JPY', 'CAD', 'AUD'] })
    expect(s.currencyBase).toBe(DEFAULT_SETTINGS.currencyBase)
    expect(s.currencyQuotes).toEqual(['EUR', 'GBP', 'JPY', 'CAD'])
  })
  it('filters the pop-up allowlist to hostnames', () => {
    expect(sanitizeSettings({ popupAllowlist: ['example.com', 'a b', null] }).popupAllowlist).toEqual(['example.com'])
  })
  it('accepts the new live wallpapers and rejects unknown ones', () => {
    expect(sanitizeSettings({ wallpaper: 'live:rain' }).wallpaper).toBe('live:rain')
    expect(sanitizeSettings({ wallpaper: 'live:nope' }).wallpaper).toBe(DEFAULT_SETTINGS.wallpaper)
  })
})
