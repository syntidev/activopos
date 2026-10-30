/** Parser liviano de user-agent y geo para Pulso. Nunca devuelve ni guarda el UA crudo ni la IP. */

export type PulsoDevice = 'mobile' | 'tablet' | 'desktop'

export interface ParsedUserAgent {
  device:  PulsoDevice
  os:      string | null
  browser: string | null
}

export interface RequestGeo {
  country: string | null
  city:    string | null
}

export interface PulsoRequestContext extends ParsedUserAgent, RequestGeo {}

// "Instagram"/"FBAN" (in-app) NO están aquí: son visitantes reales.
const BOT_RE = /bot|crawl|spider|headless|lighthouse|pagespeed|curl|wget|python-requests|httpclient|facebookexternalhit|preview|slurp|monitor|uptime|axios|node-fetch/i
const MAX_CITY = 80

export function isBotUserAgent(ua: string | null): boolean {
  if (!ua || !ua.trim()) return true
  return BOT_RE.test(ua)
}

function detectDevice(ua: string): PulsoDevice {
  if (/iPad|Tablet/i.test(ua)) return 'tablet'
  // Android sin "Mobile" es tablet.
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet'
  if (/iPhone|iPod|Android|Mobile/i.test(ua)) return 'mobile'
  return 'desktop'
}

function detectOs(ua: string): string | null {
  // iOS antes que macOS: el UA de iPhone dice "like Mac OS X".
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/CrOS/i.test(ua)) return 'ChromeOS'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS'
  if (/Linux|X11/i.test(ua)) return 'Linux'
  return null
}

// Orden importa: Edge/Opera/Samsung dicen "Chrome", y Chrome dice "Safari".
const BROWSERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Instagram/i, 'Instagram'],
  [/FBAN|FBAV|FB_IAB/i, 'Facebook'],
  [/WhatsApp/i, 'WhatsApp'],
  [/Edg(e|A|iOS)?\//i, 'Edge'],
  [/OPR\/|Opera/i, 'Opera'],
  [/SamsungBrowser/i, 'Samsung Internet'],
  [/Firefox|FxiOS/i, 'Firefox'],
  [/Chrome|CriOS|Chromium/i, 'Chrome'],
  [/Safari/i, 'Safari'],
]

function detectBrowser(ua: string): string | null {
  for (const [re, name] of BROWSERS) if (re.test(ua)) return name
  return null
}

export function parseUserAgent(ua: string | null): ParsedUserAgent {
  if (!ua) return { device: 'desktop', os: null, browser: null }
  return { device: detectDevice(ua), os: detectOs(ua), browser: detectBrowser(ua) }
}

export function requestGeo(h: Headers): RequestGeo {
  const rawCountry = h.get('cf-ipcountry')?.trim().toUpperCase() ?? ''
  const country = /^[A-Z]{2}$/.test(rawCountry) && rawCountry !== 'XX' && rawCountry !== 'T1' ? rawCountry : null

  let city = h.get('cf-ipcity')?.trim() || null
  if (city) {
    try { city = decodeURIComponent(city) } catch { /* viene sin codificar */ }
    city = city.trim().slice(0, MAX_CITY) || null
  }
  return { country, city }
}

export function pulsoRequestContext(req: Request): PulsoRequestContext {
  return { ...parseUserAgent(req.headers.get('user-agent')), ...requestGeo(req.headers) }
}
