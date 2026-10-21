import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { userAgentFallback: '' } }))
const { isSignInUrl, signInUserAgent } = await import('../../src/main/sign-in')

const FALLBACK =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) auralis/1.0.1 Chrome/152.0.7706.0 Electron/44.7.0 Safari/537.36'

describe('Google sign-in', () => {
  it('matches only Google accounts pages over HTTPS', () => {
    expect(isSignInUrl('https://accounts.google.com/v3/signin/identifier?continue=x')).toBe(true)
    expect(isSignInUrl('http://accounts.google.com/')).toBe(false)
    expect(isSignInUrl('https://www.youtube.com/')).toBe(false)
    expect(isSignInUrl('https://accounts.google.com.evil.example/')).toBe(false)
    expect(isSignInUrl('not a url')).toBe(false)
  })

  it('keeps the Electron token and drops only the app token', () => {
    const ua = signInUserAgent(FALLBACK)
    expect(ua).toContain('Electron/44.7.0')
    expect(ua).toContain('Chrome/152.0.7706.0')
    expect(ua).not.toMatch(/auralis/i)
  })
})
