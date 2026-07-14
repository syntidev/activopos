import { PRODUCT_CONTEXT, type SocialFormat } from './brand'

/**
 * Cliente Gemini server-side para el generador de contenido social.
 *
 * Adaptado de C:\socialia\services\geminiService.ts (callProxy L53-73, throttle L77-90,
 * withRetry L92-122, generateCreativePost L659-748). Diferencias con el original:
 *  - Socialia era un SPA Vite y hablaba con su propio proxy Express (/api/socialia/gemini)
 *    para ocultar la key del navegador. Aquí ya estamos en el servidor: se llama a Google
 *    directo y la key nunca sale del proceso Node.
 *  - Sin marcas SYNTIweb/Studio/Food/Cat: el contexto es ActivoPOS.
 */

const IMAGE_MODEL = 'gemini-2.5-flash-image'
const TEXT_MODEL  = 'gemini-3-flash-preview'

// Free tier: 10 RPM en el modelo de imagen. 60s/10 = 6s teóricos; 7s da margen.
const IMAGE_MIN_INTERVAL_MS = 7000
// 429 → esperar un ciclo de RPM completo + colchón.
const RATE_LIMIT_BACKOFF_MS = 65000

// Throttle compartido por proceso: post único y slides de carrusel consumen el mismo bucket.
let lastImageCallAt = 0

interface GeminiPart {
  text?:       string
  inlineData?: { mimeType?: string; data: string }
}
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[]
}

class GeminiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'GeminiError'
  }
}

async function call(model: string, body: unknown): Promise<GeminiResponse> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new GeminiError('GEMINI_API_KEY no configurada en el servidor', 500)

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    },
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new GeminiError(`Gemini ${res.status}: ${detail.slice(0, 300)}`, res.status)
  }
  return res.json() as Promise<GeminiResponse>
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const status  = err instanceof GeminiError ? err.status : 0
      const message = err instanceof Error ? err.message : ''

      const isRateLimit = status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(message)
      const isTransient = status === 503 || /UNAVAILABLE|high demand/i.test(message)
      if (!(isRateLimit || isTransient) || attempt === maxRetries - 1) throw err

      const wait = isRateLimit ? RATE_LIMIT_BACKOFF_MS : 2000 * 2 ** attempt
      await new Promise(r => setTimeout(r, wait))
    }
  }
  throw lastError
}

// ── Copy ────────────────────────────────────────────────────────────────────

export interface SlideCopy {
  titulo:    string
  subtitulo: string
  escena:    string   // descripción visual del fondo — alimenta el prompt de imagen
}

export interface SocialCopy {
  slides:   SlideCopy[]
  caption:  string
  hashtags: string[]
}

export interface CopyInput {
  tipo:       SocialFormat
  nicho:      string
  gancho:     string
  beneficio?: string
  objetivo:   string
  slides:     number
}

function extractText(res: GeminiResponse): string {
  return res.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? ''
}

export async function generateCopy(input: CopyInput): Promise<SocialCopy> {
  const { tipo, nicho, gancho, beneficio, objetivo, slides } = input

  const prompt = `${PRODUCT_CONTEXT}

Actúa como copywriter senior de Instagram para ActivoPOS.
FORMATO: ${tipo} (${slides} ${slides === 1 ? 'imagen' : 'slides'}).
NICHO: ${nicho}.
OBJETIVO: ${objetivo}.
GANCHO DE ENTRADA: "${gancho}".${beneficio ? `\nBENEFICIO A DESTACAR: "${beneficio}".` : ''}

Para CADA slide genera:
- titulo: frase de impacto, máximo 6 palabras, en español
- subtitulo: beneficio concreto, máximo 12 palabras, en español
- escena: descripción EN INGLÉS de la escena fotográfica de fondo (sin texto, sin letras,
  sin logos). Debe ser un ambiente venezolano real del nicho "${nicho}". Menciona iluminación,
  encuadre y objetos. NUNCA describas texto ni interfaces con palabras legibles.
${slides > 1 ? 'Los slides deben contar una progresión: problema → tensión → solución → cierre con CTA.' : ''}

Además genera:
- caption: copy para Instagram con emojis, máximo 40 palabras, cierra invitando a activopos.com
- hashtags: 8 hashtags sin el símbolo #

Responde SOLO JSON válido:
{"slides":[{"titulo":"","subtitulo":"","escena":""}],"caption":"","hashtags":[]}`

  const res = await withRetry(() => call(TEXT_MODEL, {
    contents:         [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  }))

  const raw = extractText(res)
  if (!raw) throw new GeminiError('Gemini devolvió copy vacío', 502)

  // Pese a responseMimeType el modelo a veces envuelve el JSON en fences de markdown.
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  return JSON.parse(cleaned) as SocialCopy
}

// ── Imagen de fondo ─────────────────────────────────────────────────────────

/**
 * El fondo se genera SIN texto a propósito: la tipografía la compone sharp después
 * (compose.ts) con las fuentes reales de la marca. Un modelo de imagen no escribe
 * español legible ni respeta el design system.
 */
function buildImagePrompt(escena: string, nicho: string): string {
  return `ROLE: Senior art director producing a premium advertising photograph for Instagram.

SCENE: ${escena}
CONTEXT: A real Venezuelan small business (${nicho}). Authentic, not stock-photo generic.

STYLE:
- Photorealistic, natural light, shallow depth of field, cinematic color grading.
- Cool blue accents are welcome (the brand is deep blue), never neon or oversaturated.
- Composition must leave the LOWER THIRD visually calm and uncluttered — typography goes there.

ABSOLUTE CONSTRAINTS:
- ZERO text, ZERO typography, ZERO words, ZERO numbers, ZERO letters anywhere in the image.
- ZERO logos, ZERO watermarks, ZERO UI copy, ZERO signage with readable characters.
- No cartoon, no 3D render look, no illustration, no template aesthetic, no amateur framing.
- No arepas, no street market stalls, no street vendors.`
}

export async function generateBackground(
  escena: string,
  nicho: string,
  aspect: string,
): Promise<Buffer> {
  // Throttle: el bucket de 10 RPM es compartido por todas las llamadas de imagen.
  const elapsed = Date.now() - lastImageCallAt
  if (lastImageCallAt > 0 && elapsed < IMAGE_MIN_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, IMAGE_MIN_INTERVAL_MS - elapsed))
  }
  lastImageCallAt = Date.now()

  const res = await withRetry(() => call(IMAGE_MODEL, {
    contents:         [{ parts: [{ text: buildImagePrompt(escena, nicho) }] }],
    generationConfig: { imageConfig: { aspectRatio: aspect } },
  }))

  const data = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data
  if (!data) throw new GeminiError('Gemini no devolvió imagen', 502)

  return Buffer.from(data, 'base64')
}
