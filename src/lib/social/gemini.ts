import { PRODUCT_CONTEXT, type SocialFormat } from './brand'
import { ProviderError, withRetry } from './retry'

/**
 * Cliente Gemini server-side para el COPY del generador de contenido social.
 *
 * Adaptado de C:\socialia\services\geminiService.ts (callProxy L53-73, withRetry L92-122,
 * generateCreativePost L659-748). Diferencias con el original:
 *  - Socialia era un SPA Vite y hablaba con su propio proxy Express (/api/socialia/gemini)
 *    para ocultar la key del navegador. Aquí ya estamos en el servidor: se llama a Google
 *    directo y la key nunca sale del proceso Node.
 *  - Sin marcas SYNTIweb/Studio/Food/Cat: el contexto es ActivoPOS.
 *  - La generación de IMAGEN ya no vive aquí: la cuenta de Google tiene cuota free-tier = 0
 *    en todos sus modelos de imagen. Ver src/lib/social/image.ts (NVIDIA NIM / FLUX.1-dev).
 */

const TEXT_MODEL = 'gemini-3-flash-preview'

interface GeminiPart {
  text?: string
}
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[]
}

async function call(model: string, body: unknown): Promise<GeminiResponse> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new ProviderError('GEMINI_API_KEY no configurada en el servidor', 500)

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
    throw new ProviderError(`Gemini ${res.status}: ${detail.slice(0, 300)}`, res.status)
  }
  return res.json() as Promise<GeminiResponse>
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
- escena: descripción EN INGLÉS de la escena fotográfica de fondo. Debe ser un ambiente
  venezolano real del nicho "${nicho}". Menciona iluminación, encuadre y objetos.
  NUNCA menciones carteles, letreros, afiches, etiquetas, pantallas ni marcas: el modelo de
  imagen los dibuja con texto ilegible. Describe superficies limpias y envases sin marca.
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
  if (!raw) throw new ProviderError('Gemini devolvió copy vacío', 502)

  // Pese a responseMimeType el modelo a veces envuelve el JSON en fences de markdown.
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  return JSON.parse(cleaned) as SocialCopy
}
