// Google's sign-in page and the user agent it gets.
//
// Everywhere else Auralis sends Chromium's user agent without the Electron
// token. On accounts.google.com that backfires: Google takes it for desktop
// Chrome, runs Chrome's integrity checks, and refuses with "This browser or
// app may not be secure". With the Electron token left in, Google serves the
// sign-in flow it uses for embedded browsers, which works.
import { app } from 'electron'

const SIGN_IN_HOSTS = new Set(['accounts.google.com'])

export function isSignInUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && SIGN_IN_HOSTS.has(u.hostname)
  } catch {
    return false
  }
}

/** Chromium's UA with Electron's token kept and only the app's own token removed. */
export function signInUserAgent(base = app.userAgentFallback): string {
  return base.replace(/\s?auralis\/[\w.-]+/i, '')
}
