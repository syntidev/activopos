/**
 * Bot de soporte del dashboard. Extraído de (dashboard)/ayuda/page.tsx para que
 * la lógica de matching y la llamada a la IA vivan fuera del componente.
 *
 * La IA corre en el servidor (POST /api/ai/chat, NVIDIA NIM) — nunca acá. Este
 * módulo se bundlea al cliente, así que jamás debe tocar NVIDIA_API_KEY ni
 * llamar a integrate.api.nvidia.com directo: filtraría la key al browser.
 */

export interface BotRule {
  keywords: string[]
  response: string
}

/** `source` alimenta el badge IA/Rápida del chat; undefined = mensaje del sistema. */
export interface BotAnswer {
  text:    string
  source?: 'ai' | 'fallback'
}

export const DEFAULT_REPLY =
  'No encontré información sobre eso. Puedes preguntarme sobre: ventas, métodos de pago, ' +
  'código de barras, BCV, variantes, catálogo digital, caja, inventario, clientes, ' +
  'finanzas, reportes, configuración o planes.'

// 12s: el modelo con contexto de negocio a veces pasa de 8s y caía a fallback de más.
const AI_TIMEOUT_MS = 12_000

function normalizeText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Límite de palabra (\b) — antes era substring plano, por eso 'pro' (Planes)
// matcheaba dentro de "producto"/"proveedor". Con \b, un keyword corto que
// es prefijo de una palabra más larga en la query (ej. 'cliente' dentro de
// "clientes") tampoco matchea — como efecto secundario, ya no infla el score
// contando singular Y plural de la misma idea por separado.
function keywordMatches(query: string, keyword: string): boolean {
  return new RegExp(`\\b${escapeRegex(normalizeText(keyword))}\\b`).test(query)
}

/** Matching por keywords — el fallback offline cuando la IA no responde. */
export function matchRules(text: string, rules: BotRule[]): string {
  const q = normalizeText(text)
  let bestScore = 0
  let bestRules: BotRule[] = []

  for (const rule of rules) {
    const matched = rule.keywords.filter(k => keywordMatches(q, k))
    if (matched.length === 0) continue

    // Defensa extra: si una keyword matcheada es substring de otra keyword
    // matcheada de la MISMA regla, se cuenta solo la más larga (cubre casos
    // que \b no deduplica, ej. 'ropa' y una futura 'ropa deportiva').
    const deduped = matched.filter(k =>
      !matched.some(other => other !== k && other.includes(k) && other.length > k.length)
    )

    // Score = suma de longitud de las keywords matcheadas, no cantidad —
    // favorece matches largos/específicos ("metodos de pago") sobre
    // coincidencias cortas genéricas, y es el desempate real entre reglas
    // (antes: primera regla del array ganaba siempre en empate).
    const score = deduped.reduce((sum, k) => sum + k.length, 0)

    if (score > bestScore) {
      bestScore = score
      bestRules = [rule]
    } else if (score === bestScore && score > 0) {
      bestRules.push(rule)
    }
  }

  if (bestRules.length === 0) return DEFAULT_REPLY
  // Empate real entre 2+ tópicos igual de específicos — se mencionan ambos
  // en vez de descartar arbitrariamente al que aparece primero en el array.
  return bestRules.map(r => r.response).join('\n\n')
}

/**
 * Pregunta a la IA; ante CUALQUIER falla (timeout, 5xx, red, API key ausente)
 * devuelve la respuesta de `fallbackRules`. La ayuda nunca queda muda.
 */
export async function botReplyAI(question: string, fallbackRules: BotRule[]): Promise<BotAnswer> {
  const fallback = matchRules(question, fallbackRules)

  try {
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS)

    const res = await fetch('/api/ai/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: question }),
      signal:  ctrl.signal,
    })
    clearTimeout(timeoutId)

    if (res.status === 403) {
      return { text: 'Solo administradores pueden usar el asistente IA.' }
    }

    if (res.ok) {
      const data = await res.json() as { response?: string }
      if (data.response) return { text: data.response, source: 'ai' }
    }
  } catch {
    // Red caída o timeout — cae al fallback de abajo.
  }

  return { text: fallback, source: 'fallback' }
}
