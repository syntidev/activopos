import { ProviderError } from '@/lib/social/retry'

/**
 * Conexión única al LLM del blog (NVIDIA NIM chat completions). Extraída de
 * api/admin/blog/generate-ai/route.ts cuando generate-image-prompt necesitó el
 * mismo modelo: una sola definición del endpoint/modelo/API key.
 *
 * Ojo: NO es el mismo endpoint que la imagen. El copy va a
 * integrate.api.nvidia.com (chat); la difusión vive en ai.api.nvidia.com
 * (ver src/lib/social/image.ts). Comparten NVIDIA_API_KEY, nada más.
 */

const ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions'
/** Default del blog. Quien necesite otro modelo lo pasa por `opts.model`. */
const MODEL    = 'meta/llama-3.1-8b-instruct'

// ponytail: reusa ProviderError (message, status) del módulo social en vez de una
// clase propia idéntica — generate-image/route.ts ya la importa para el mismo fin.
// Se reexporta para que las rutas del blog no tengan que conocer lib/social.
export { ProviderError }

interface CallOpts {
  /** Mensaje `system` opcional. Sin él el modelo recibe solo el turno de usuario. */
  system?: string
  /** Aborta la petición — lo usa quien llama durante un render en caliente. */
  signal?: AbortSignal
  /**
   * Modelo NIM alternativo. Vacío o ausente => MODEL (el del blog), así una env
   * var sin configurar en el VPS nunca deja el body con `model: undefined`.
   */
  model?: string
}

/** Devuelve el texto crudo del modelo — el parseo/validación queda en cada ruta. */
export async function callBlogLlm(prompt: string, opts: CallOpts = {}): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) throw new ProviderError('NVIDIA_API_KEY no configurada en el servidor', 500)

  const messages = opts.system
    ? [{ role: 'system', content: opts.system }, { role: 'user', content: prompt }]
    : [{ role: 'user', content: prompt }]

  const res = await fetch(ENDPOINT, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${apiKey}`,
    },
    body:   JSON.stringify({ model: opts.model || MODEL, messages }),
    signal: opts.signal,
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    console.error('NVIDIA NIM error:', res.status, errBody)
    throw new ProviderError('Falló el servicio de generación IA', 502)
  }

  const completion = await res.json() as { choices?: { message?: { content?: string } }[] }
  const raw = completion.choices?.[0]?.message?.content
  if (!raw) throw new ProviderError('Respuesta vacía del modelo', 502)

  return raw
}

/**
 * llama-3.1-8b escribe los saltos de línea del HTML como caracteres de control
 * LITERALES dentro de los strings del JSON, y eso JSON.parse lo rechaza
 * ("Bad control character in string literal"). Verificado contra la API real:
 * el fallo es frecuente en respuestas largas, y era la causa del 502 de
 * generate-ai. Se escapan solo los que caen dentro de comillas — fuera de
 * ellas el salto de línea es whitespace válido y no se toca.
 */
function escapeControlCharsInStrings(s: string): string {
  const ESCAPES: Record<string, string> = { '\n': '\\n', '\r': '\\r', '\t': '\\t' }
  let out = ''
  let inString = false
  let escaped  = false

  for (const ch of s) {
    if (escaped)      { out += ch; escaped = false; continue }
    if (ch === '\\')  { out += ch; escaped = true;  continue }
    if (ch === '"')   { inString = !inString; out += ch; continue }
    out += inString ? (ESCAPES[ch] ?? ch) : ch
  }
  return out
}

/** El modelo a veces envuelve el JSON en fences de markdown pese a la instrucción. */
export function extractJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    return JSON.parse(cleaned)
  } catch {
    return JSON.parse(escapeControlCharsInStrings(cleaned))
  }
}
