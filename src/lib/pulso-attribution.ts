import type { PulsoAttribution } from '@/types/pulso'

/** Inactividad (ms) tras la cual la sesión de Pulso se renueva. */
export const PULSO_SESSION_TTL_MS = 1_800_000

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

/** Lee utm_* de un query string. source/medium en minúsculas; largos 80 (term 100); vacíos se ignoran. */
export function parseUtm(search: string): PulsoAttribution {
  const params = new URLSearchParams(search)
  const out: PulsoAttribution = {}
  for (const key of UTM_KEYS) {
    let value = (params.get(key) ?? '').trim()
    if (!value) continue
    if (key === 'utm_source' || key === 'utm_medium') value = value.toLowerCase()
    out[key] = value.slice(0, key === 'utm_term' ? 100 : 80)
  }
  return out
}

/** Host del referrer si es externo al sitio actual; sin `www.`. Vacío/inválido → undefined. */
export function externalReferrerHost(referrer: string, currentHost: string): string | undefined {
  if (!referrer) return undefined
  try {
    const strip = (h: string): string => h.toLowerCase().replace(/^www\./, '')
    const host = strip(new URL(referrer).hostname)
    if (!host || host === strip(currentHost.split(':')[0])) return undefined
    return host.slice(0, 120)
  } catch {
    return undefined
  }
}

/** Renueva la sesión si no hay o pasaron > 30 min de inactividad; si no conserva el id. */
export function nextSession(
  stored: { id: string; lastSeen: number } | null,
  now: number,
  newId: () => string,
): { id: string; lastSeen: number; renewed: boolean } {
  if (!stored || now - stored.lastSeen > PULSO_SESSION_TTL_MS) return { id: newId(), lastSeen: now, renewed: true }
  return { id: stored.id, lastSeen: now, renewed: false }
}

function hasUtm(a: PulsoAttribution): boolean {
  return UTM_KEYS.some(k => Boolean(a[k]))
}

/** Sesión nueva → solo `incoming`. Misma sesión → conserva `current`; solo lo reemplaza un `incoming` con utm_*; referrer del primero. */
export function mergeAttribution(
  current: PulsoAttribution | null,
  incoming: PulsoAttribution,
  renewed: boolean,
): PulsoAttribution {
  if (renewed || !current) return { ...incoming }
  const base = hasUtm(incoming) ? { ...incoming } : { ...current }
  const referrer = current.referrer_host ?? incoming.referrer_host
  if (referrer) base.referrer_host = referrer
  else delete base.referrer_host
  return base
}
