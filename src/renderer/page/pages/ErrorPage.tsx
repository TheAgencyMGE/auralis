import { useEffect, useState } from 'react'
import { call } from '@ui/api'

interface Info {
  type: 'network' | 'cert' | 'https' | 'crash' | 'blocked'
  url: string
  code: number
  description: string
}

function host(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/** Plain-language explanations for the errors people actually hit. */
function explain(info: Info): { title: string; lede: string; tips: string[]; warn?: boolean } {
  const h = host(info.url)
  switch (info.type) {
    case 'https':
      return {
        title: `${h} doesn’t support a secure connection`,
        lede: 'Auralis tried to open this site over HTTPS and couldn’t. If you continue, anything you send or receive on this site could be read or changed by someone on your network.',
        tips: [],
        warn: true
      }
    case 'cert':
      return {
        title: 'This site’s certificate isn’t valid',
        lede: `Auralis couldn’t confirm that this is really ${h}. Someone may be impersonating the site, or it may be misconfigured. Auralis didn’t load the page to keep your information safe.`,
        tips: ['Check that your computer’s date and time are correct.', 'If you’re on public Wi-Fi, sign in to the network first, then try again.', 'Try again later; the site owner may fix this.'],
        warn: true
      }
    case 'blocked':
      return { title: 'This page was blocked', lede: `Something on this computer or network blocked ${h}.`, tips: ['Check your firewall or parental controls.'] }
    default:
      if (info.code === -105 || info.code === -137)
        return {
          title: `Can’t find ${h}`,
          lede: 'The address might be mistyped, or the site might no longer exist.',
          tips: ['Check the spelling of the address.', 'Search for the site instead.', 'If other sites don’t load either, check your internet connection.']
        }
      if (info.code === -106 || info.code === -21)
        return { title: 'You’re offline', lede: 'Auralis can’t reach the internet right now.', tips: ['Check your network cables, modem and router.', 'Reconnect to Wi-Fi.', 'Try again once you’re back online.'] }
      if (info.code === -102)
        return { title: `${h} refused to connect`, lede: 'The site is reachable but isn’t accepting connections.', tips: ['The site may be down for maintenance; try again shortly.', 'If you use a proxy or VPN, check that it’s running.'] }
      if (info.code === -118 || info.code === -7)
        return { title: `${h} took too long to respond`, lede: 'The site might be busy, or your connection is slow.', tips: ['Try again in a moment.', 'Check your internet connection.'] }
      return { title: 'Auralis can’t display this page', lede: `There was a problem loading ${h}.`, tips: ['Try again.', 'Check your internet connection.'] }
  }
}

export default function ErrorPage() {
  const [info, setInfo] = useState<Info | null | undefined>(undefined)
  useEffect(() => {
    void call<Info | null>('error.info').then((i) => {
      setInfo(i)
      if (i) document.title = host(i.url)
    })
  }, [])
  if (info === undefined) return null
  if (!info) {
    return (
      <div className="errp">
        <h1>Nothing to show</h1>
        <p className="errp-lede">This error page has expired. Use Back or type an address.</p>
      </div>
    )
  }
  const e = explain(info)
  return (
    <div className="errp">
      <div className="errp-head">
        <img className="errp-art" src={`/emoji/${e.warn ? 'warning' : 'globe'}.webp`} alt="" />
        <div>
          <h1>{e.title}</h1>
          <p className="errp-lede">{e.lede}</p>
        </div>
      </div>
      {e.tips.length > 0 && (
        <>
          <h2>What you can try</h2>
          <ul>
            {e.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}
      <div className="errp-actions">
        {info.type === 'https' ? (
          <>
            <button className="btn is-default" onClick={() => void call('error.action', 'back')}>
              Go back
            </button>
            <button className="btn" onClick={() => void call('error.action', 'http')}>
              Continue to site (not secure)
            </button>
          </>
        ) : info.type === 'cert' ? (
          <button className="btn is-default" onClick={() => void call('error.action', 'back')}>
            Go back to safety
          </button>
        ) : (
          <>
            <button className="btn is-default" onClick={() => void call('error.action', 'retry')}>
              Try again
            </button>
            <button className="btn" onClick={() => void call('nav.go', host(info.url))}>
              Search for {host(info.url)}
            </button>
          </>
        )}
      </div>
      <details className="errp-code">
        <summary>Technical details</summary>
        <p>
          {info.description} ({info.code}) while loading {info.url}
        </p>
      </details>
    </div>
  )
}
