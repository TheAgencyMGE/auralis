import { describe, expect, it } from 'vitest'
import { displayUrl, internalPage, resolveInput, securityOf, siteKey } from '../../src/shared/url'

const go = (s: string) => resolveInput(s, 'bing')

describe('resolveInput', () => {
  it('navigates to plain domains over https', () => {
    expect(go('example.com')).toEqual({ kind: 'url', url: 'https://example.com/' })
    expect(go('news.ycombinator.com/item?id=1')).toEqual({ kind: 'url', url: 'https://news.ycombinator.com/item?id=1' })
  })
  it('uses http for local development hosts', () => {
    expect(go('localhost:3000')).toEqual({ kind: 'url', url: 'http://localhost:3000/' })
    expect(go('127.0.0.1:8080/x')).toEqual({ kind: 'url', url: 'http://127.0.0.1:8080/x' })
    expect(go('myapp.test')).toEqual({ kind: 'url', url: 'http://myapp.test/' })
  })
  it('keeps explicit schemes', () => {
    expect(go('http://example.com')).toEqual({ kind: 'url', url: 'http://example.com/' })
    expect(go('https://a.b/c d')).toEqual({ kind: 'url', url: 'https://a.b/c%20d' })
  })
  it('searches for words and sentences', () => {
    expect(go('weather tomorrow').kind).toBe('search')
    expect(go('electron').kind).toBe('search')
    expect(go('what is example.com').kind).toBe('search')
    expect(go('weather tomorrow').url).toBe('https://www.bing.com/search?q=weather%20tomorrow')
  })
  it('never navigates to script or data URLs typed into the omnibox', () => {
    expect(go('javascript:alert(1)').kind).toBe('search')
    expect(go('data:text/html,<script>alert(1)</script>').kind).toBe('search')
    expect(go('vbscript:msgbox').kind).toBe('search')
  })
  it('maps about: aliases to internal pages and rejects unknown internal hosts', () => {
    expect(go('about:settings')).toEqual({ kind: 'url', url: 'auralis://settings/' })
    expect(go('auralis://history')).toEqual({ kind: 'url', url: 'auralis://history/' })
    expect(go('auralis://chrome').kind).toBe('search')
    expect(go('auralis://overlay/').kind).toBe('search')
  })
  it('handles Windows paths', () => {
    expect(go('C:\\Users\\me\\a b.html')).toEqual({ kind: 'url', url: 'file:///C:/Users/me/a%20b.html' })
  })
})

describe('displayUrl', () => {
  it('hides https and root slash, keeps http visible', () => {
    expect(displayUrl('https://example.com/')).toBe('example.com')
    expect(displayUrl('http://example.com/a')).toBe('http://example.com/a')
    expect(displayUrl('auralis://newtab/')).toBe('')
  })
  it('does not decode characters that could spoof the URL', () => {
    expect(displayUrl('https://example.com/%E2%80%AEevil')).not.toContain('\u202e')
    expect(displayUrl('https://example.com/caf%C3%A9')).toBe('example.com/café')
  })
})

describe('helpers', () => {
  it('classifies security', () => {
    expect(securityOf('https://a.com')).toBe('secure')
    expect(securityOf('http://a.com')).toBe('insecure')
    expect(securityOf('http://localhost:5173')).toBe('secure')
    expect(securityOf('auralis://newtab')).toBe('internal')
    expect(securityOf('https://a.com', true)).toBe('error')
  })
  it('extracts internal pages and site keys', () => {
    expect(internalPage('auralis://settings/privacy')).toBe('settings')
    expect(internalPage('auralis://chrome/')).toBeNull()
    expect(internalPage('https://settings')).toBeNull()
    expect(siteKey('https://www.example.com/x')).toBe('example.com')
  })
})
