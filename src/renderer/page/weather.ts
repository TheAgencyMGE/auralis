// WMO weather codes (as returned by Open-Meteo) → label and Fluent Emoji 3D art.
export function weatherInfo(code: number, day = true): { label: string; art: string } {
  const art = (name: string) => `/emoji/${name}.webp`
  if (code === 0) return { label: day ? 'Clear and sunny' : 'Clear', art: art(day ? 'sun' : 'moon') }
  if (code === 1) return { label: 'Mostly clear', art: art(day ? 'sun-small-cloud' : 'moon') }
  if (code === 2) return { label: 'Partly cloudy', art: art(day ? 'sun-cloud' : 'cloud') }
  if (code === 3) return { label: 'Overcast', art: art('cloud') }
  if (code === 45 || code === 48) return { label: 'Fog', art: art('fog') }
  if (code >= 51 && code <= 57) return { label: 'Drizzle', art: art('rain') }
  if (code >= 61 && code <= 67) return { label: code >= 65 ? 'Heavy rain' : 'Rain', art: art('rain') }
  if (code >= 71 && code <= 77) return { label: 'Snow', art: art('snow') }
  if (code >= 80 && code <= 82) return { label: 'Showers', art: art(day ? 'sun-rain' : 'rain') }
  if (code === 85 || code === 86) return { label: 'Snow showers', art: art('snow') }
  if (code >= 95) return { label: 'Thunderstorms', art: art('storm') }
  return { label: 'Weather', art: art('cloud') }
}
