import { useEffect, useState } from 'react'
import { call } from '@ui/api'

interface Info {
  type: 'network' | 'cert' | 'https' | 'crash' | 'blocked' | 'unsafe'
  url: string
  threat?: 'phishing' | 'malware'
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
  if (info?.type === 'unsafe') return <UnsafeSite info={info} />
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
        <img className="errp-art" src={`/art/icons/${e.warn ? 'warning' : 'web'}.webp`} alt="" />
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

/** IE8's SmartScreen page: the whole tab turns red before anything loads. */
function UnsafeSite({ info }: { info: Info }) {
  const h = host(info.url)
  const phishing = info.threat === 'phishing'
  useEffect(() => {
    document.title = 'Unsafe website blocked'
    document.documentElement.dataset.unsafe = ''
  }, [])
  return (
    <div className="unsafe">
      <div className="unsafe-card">
        <img className="unsafe-art" src="/art/icons/unsafe.webp" width={72} height={72} alt="" />
        <div>
          <h1>This website has been reported as unsafe</h1>
          <p className="unsafe-host">{h}</p>
          <p>
            {phishing
              ? 'This site has been reported for phishing: it may pretend to be a site you trust to steal your passwords, card numbers or other personal information.'
              : 'This site has been reported for distributing malware: it may try to install software that harms your computer or steals your information.'}
          </p>
          <p>Auralis stopped the page before it loaded. We recommend that you do not continue to this website.</p>
          <div className="unsafe-actions">
            <button className="btn is-default" autoFocus onClick={() => void call('error.action', 'back')}>
              Go back to safety
            </button>
          </div>
          <details className="unsafe-more">
            <summary>More information</summary>
            <p>
              Reported {phishing ? 'phishing' : 'malware'} sites come from community blocklists (
              {phishing ? 'OpenPhish, PhishTank and IPThreat' : 'URLhaus by abuse.ch'}) that Auralis downloads and checks on this computer. The sites
              you visit are never sent anywhere for checking.
            </p>
            <p>If you understand the risk and believe this report is wrong, you can open the site for the rest of this session.</p>
            <button className="unsafe-ignore" onClick={() => void call('error.action', 'unsafe-continue')}>
              Disregard and continue (not recommended)
            </button>
          </details>
        </div>
      </div>
    </div>
  )
}
