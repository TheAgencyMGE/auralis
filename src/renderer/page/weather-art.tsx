// Glossy weather illustrations in the spirit of the Vista weather gadget,
// keyed by WMO weather interpretation codes (as returned by Open-Meteo).

export function weatherInfo(code: number, day = true): { label: string; kind: Kind } {
  if (code === 0) return { label: day ? 'Clear and sunny' : 'Clear', kind: day ? 'sun' : 'moon' }
  if (code === 1) return { label: 'Mostly clear', kind: day ? 'sun-cloud' : 'moon-cloud' }
  if (code === 2) return { label: 'Partly cloudy', kind: day ? 'sun-cloud' : 'moon-cloud' }
  if (code === 3) return { label: 'Overcast', kind: 'cloud' }
  if (code === 45 || code === 48) return { label: 'Fog', kind: 'fog' }
  if (code >= 51 && code <= 57) return { label: 'Drizzle', kind: 'rain' }
  if (code >= 61 && code <= 67) return { label: code >= 65 ? 'Heavy rain' : 'Rain', kind: 'rain' }
  if (code >= 71 && code <= 77) return { label: 'Snow', kind: 'snow' }
  if (code >= 80 && code <= 82) return { label: 'Showers', kind: day ? 'sun-rain' : 'rain' }
  if (code === 85 || code === 86) return { label: 'Snow showers', kind: 'snow' }
  if (code >= 95) return { label: 'Thunderstorms', kind: 'storm' }
  return { label: 'Unknown', kind: 'cloud' }
}

type Kind = 'sun' | 'moon' | 'sun-cloud' | 'moon-cloud' | 'cloud' | 'fog' | 'rain' | 'snow' | 'sun-rain' | 'storm'

const Defs = () => (
  <defs>
    <radialGradient id="wa-sun" cx="40%" cy="35%" r="65%">
      <stop offset="0" stopColor="#fff7c2" />
      <stop offset=".45" stopColor="#ffd23a" />
      <stop offset="1" stopColor="#f08a12" />
    </radialGradient>
    <radialGradient id="wa-moon" cx="40%" cy="35%" r="70%">
      <stop offset="0" stopColor="#ffffff" />
      <stop offset="1" stopColor="#b9c9e0" />
    </radialGradient>
    <linearGradient id="wa-cloud" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#ffffff" />
      <stop offset=".6" stopColor="#e6f0f8" />
      <stop offset="1" stopColor="#a9c0d6" />
    </linearGradient>
    <linearGradient id="wa-dark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#d3dbe3" />
      <stop offset="1" stopColor="#7d8b99" />
    </linearGradient>
    <linearGradient id="wa-drop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#bfe9ff" />
      <stop offset="1" stopColor="#2a8ad6" />
    </linearGradient>
  </defs>
)

const Sun = ({ x = 32, y = 30, r = 14 }) => (
  <g>
    {Array.from({ length: 10 }, (_, i) => {
      const a = (i * 36 * Math.PI) / 180
      return <line key={i} x1={x + Math.cos(a) * (r + 4)} y1={y + Math.sin(a) * (r + 4)} x2={x + Math.cos(a) * (r + 9)} y2={y + Math.sin(a) * (r + 9)} stroke="#ffc43a" strokeWidth="2.6" strokeLinecap="round" opacity=".85" />
    })}
    <circle cx={x} cy={y} r={r} fill="url(#wa-sun)" />
    <ellipse cx={x - 3} cy={y - 6} rx={r * 0.6} ry={r * 0.35} fill="rgba(255,255,255,.55)" />
  </g>
)

const Moon = ({ x = 30, y = 28 }) => (
  <g>
    <path d={`M${x + 8} ${y - 14}a15 15 0 1 0 8 25 12 12 0 0 1-8-25z`} fill="url(#wa-moon)" stroke="#8ea4c2" strokeWidth=".8" />
  </g>
)

const Cloud = ({ dx = 0, dy = 0, dark = false, s = 1 }) => (
  <g transform={`translate(${dx} ${dy}) scale(${s})`}>
    <path
      d="M16 50h34a11 11 0 0 0 1-22 15 15 0 0 0-28-4 11 11 0 0 0-7 26z"
      fill={dark ? 'url(#wa-dark)' : 'url(#wa-cloud)'}
      stroke={dark ? '#5d6b78' : '#8aa6c0'}
      strokeWidth="1"
    />
    <path d="M22 30a12 12 0 0 1 20-3" stroke="rgba(255,255,255,.9)" strokeWidth="2" fill="none" strokeLinecap="round" />
  </g>
)

export function WeatherArt({ code, day = true, size = 64 }: { code: number; day?: boolean; size?: number }) {
  const { kind } = weatherInfo(code, day)
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="weather-art">
      <Defs />
      {kind === 'sun' && <Sun />}
      {kind === 'moon' && <Moon />}
      {kind === 'sun-cloud' && (
        <>
          <Sun x={24} y={22} r={11} />
          <Cloud dx={6} dy={6} />
        </>
      )}
      {kind === 'moon-cloud' && (
        <>
          <Moon x={20} y={20} />
          <Cloud dx={6} dy={6} />
        </>
      )}
      {kind === 'cloud' && (
        <>
          <Cloud dx={-6} dy={-6} s={0.8} dark />
          <Cloud dx={2} dy={0} />
        </>
      )}
      {kind === 'fog' && (
        <>
          <Cloud dx={0} dy={-8} />
          {[46, 52, 58].map((y, i) => (
            <line key={y} x1={12 + i * 3} y1={y} x2={52 - i * 2} y2={y} stroke="#b8c8d6" strokeWidth="3" strokeLinecap="round" />
          ))}
        </>
      )}
      {(kind === 'rain' || kind === 'sun-rain' || kind === 'storm') && (
        <>
          {kind === 'sun-rain' && <Sun x={22} y={20} r={10} />}
          <Cloud dx={2} dy={-6} dark={kind === 'storm'} />
          {[22, 32, 42].map((x, i) => (
            <path key={x} d={`M${x} ${50 + (i % 2) * 3}q-2 4 0 6a2 2 0 0 0 2-6z`} fill="url(#wa-drop)" />
          ))}
          {kind === 'storm' && <path d="M34 42l-6 10h5l-3 9 9-12h-5l3-7z" fill="#ffd23a" stroke="#c48a00" strokeWidth=".8" />}
        </>
      )}
      {kind === 'snow' && (
        <>
          <Cloud dx={2} dy={-6} />
          {[22, 32, 42].map((x, i) => (
            <g key={x} stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" transform={`translate(${x} ${53 + (i % 2) * 4})`}>
              <line x1="-3.5" y1="0" x2="3.5" y2="0" />
              <line x1="-1.8" y1="-3" x2="1.8" y2="3" />
              <line x1="-1.8" y1="3" x2="1.8" y2="-3" />
            </g>
          ))}
        </>
      )}
    </svg>
  )
}
