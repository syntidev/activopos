import { type Aspect, ASPECT_DIMENSIONS } from './brand'
import { type SceneDirection } from './image'
import { ProviderError, withRetry } from './retry'

/**
 * Generación de fondo con Gemini 2.5 Flash Image como motor PRINCIPAL, con
 * dirección de arte (no solo foto documental como NVIDIA FLUX). El route lo
 * intenta primero y cae a generateBackground() (image.ts) si esto falla.
 *
 * Auth: ?key= en la URL, mismo patrón que gemini.ts (copy). La respuesta trae
 * candidates[0].content.parts[]; la imagen está en la parte con inlineData.data
 * (base64). Puede venir además una parte .text descriptiva — se ignora.
 *
 * Colores: los hex viven en el string del prompt (texto libre, no CSS). El resto
 * del módulo lee tokens.css para el compositing; acá no aplica.
 */

const MODEL    = 'gemini-2.5-flash-image'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

// ── Presets de color rotables ────────────────────────────────────────────────
// La marca no cambia (Persian Blue + Amber), pero el fondo y la energía sí, para
// que no salga "todo navy". Los hex son literales de prompt a propósito.

interface ColorPreset {
  background: string
  mood:       string
}

const COLOR_PRESETS: Record<string, ColorPreset> = {
  NAVY_TECH: {
    background: 'deep navy (#0D1B2E) with a subtle tech mesh gradient',
    mood:       'professional, premium SaaS energy',
  },
  SKY_LIGHT: {
    background: 'bright sky blue (#0038BD tinted light) gradient fading to white',
    mood:       'fresh, open, optimistic — daylight energy',
  },
  WARM_SAND: {
    background: 'warm sand/cream gradient with soft amber (#EF8E01) glow accents',
    mood:       'warm, approachable, Venezuelan sunlight feel',
  },
  VIBRANT_AMBER: {
    background: 'bold amber (#EF8E01) as dominant color, deep navy accents',
    mood:       'high energy, bold, attention-grabbing — for CTA/portada slides',
  },
  CLEAN_WHITE: {
    background: 'pure white with Persian Blue (#0038BD) geometric accents',
    mood:       'minimal, editorial, modern startup aesthetic',
  },
}

export type SlideRole = 'portada' | 'problema' | 'beneficio' | 'comparacion' | 'cta'

/**
 * Elige preset de color. La rotación por índice garantiza que dos slides
 * consecutivos del mismo rol nunca repitan preset. Para imagen simple (sin rol)
 * va aleatorio, para que cada post salga distinto.
 *
 * Nota: hoy el único caller es post/story (1 imagen); el carrusel se renderiza
 * como HTML y no pasa por acá, así que la rotación multi-slide queda latente
 * hasta que el carrusel migre a difusión.
 */
export function pickPreset(slideRole: SlideRole | undefined, slideIndex: number): ColorPreset {
  const impact  = ['VIBRANT_AMBER', 'NAVY_TECH']
  const benefit = ['SKY_LIGHT', 'WARM_SAND', 'CLEAN_WHITE']

  if (slideRole === 'portada' || slideRole === 'cta') return COLOR_PRESETS[impact[slideIndex % impact.length]]
  if (slideRole === 'problema')                       return COLOR_PRESETS.NAVY_TECH
  if (slideRole === 'beneficio')                      return COLOR_PRESETS[benefit[slideIndex % benefit.length]]

  const all = Object.keys(COLOR_PRESETS)
  return COLOR_PRESETS[all[Math.floor(Math.random() * all.length)]]
}

// ── Composición según rol de slide ───────────────────────────────────────────

function compositionFor(slideRole: SlideRole | undefined, nicho: string, escena: string): string {
  switch (slideRole) {
    case 'portada':
    case 'cta':
      return `MAXIMUM IMPACT — a 3D glossy smartphone floating at an elegant angle, screen showing a modern POS dashboard UI in Persian Blue tones. Floating translucent icons around the device (charts, currency symbols). Subtle tech mesh pattern. Glassmorphism panels as decorative elements. Warm amber glow (#EF8E01) emanating softly from the screen. Depth layers: background gradient, floating icons, device hero, light effects.`
    case 'problema':
      return `TENSION — desaturated, dim lighting, cluttered paper receipts and a calculator on a counter, suggesting manual chaos before the solution. Muted colors, slight vignette. No people, just the scene.`
    case 'comparacion':
      return `SPLIT composition — left half dim and cluttered (paper receipts, disorder), right half bright and organized (clean digital screen, Persian Blue UI).`
    case 'beneficio':
      return `BALANCED — a tablet or phone showing the POS screen tilted naturally on a store counter, warm ambient light, Venezuelan small business setting (${nicho}). Product or inventory visible in soft focus background.`
    default:
      return `Photorealistic, cinematic lighting, shot as a premium advertising photograph, not a casual snapshot. Venezuelan ${nicho} business setting. ${escena}`
  }
}

// ── Prompt ────────────────────────────────────────────────────────────────────

export interface ArtDirectionInput {
  escena:      string
  nicho:       string
  slideRole?:  SlideRole
  /** Posición en el carrusel/serie — decide la rotación de preset. */
  slideIndex?: number
  direction?:  SceneDirection
  aspect:      Aspect
}

function hasDirection(d?: SceneDirection): boolean {
  return !!d && !!(d.personaje?.trim() || d.lugar?.trim() || d.accion?.trim())
}

function buildPrompt(input: ArtDirectionInput): string {
  const { width, height } = ASPECT_DIMENSIONS[input.aspect]
  const preset = pickPreset(input.slideRole, input.slideIndex ?? 0)

  // Dirección de escena real (mismo criterio que buildPrompt de image.ts): si el
  // usuario llenó personaje/lugar/acción, se inyecta explícito.
  const directionLine = hasDirection(input.direction)
    ? [
        input.direction?.personaje?.trim() ? `Subject: ${input.direction.personaje.trim()}.` : '',
        input.direction?.accion?.trim()    ? `Action: ${input.direction.accion.trim()}.`     : '',
        input.direction?.lugar?.trim()     ? `Setting: ${input.direction.lugar.trim()}.`      : '',
      ].filter(Boolean).join(' ')
    : ''

  return `ROLE: Senior Art Director producing a premium Instagram advertising image for a Venezuelan small business point-of-sale software.

CRITICAL — ZERO TEXT IN IMAGE:
Do NOT render any text, typography, words, labels or numbers. Text is composited afterward. Clean art only.

FORMAT: ${width}x${height} px. Fill the entire canvas. No bars, no letterboxing.

BRAND COLORS:
Primary: #0038BD (Persian Blue). Accent: #EF8E01 (Carrot Amber), use sparingly as a highlight only.

COLOR SCHEME (this image): ${preset.background}. Mood: ${preset.mood}.

VISUAL STYLE: ${compositionFor(input.slideRole, input.nicho, input.escena)}

CONTEXT: ${input.nicho} — real Venezuelan small business, present day 2020s. ${directionLine}

Positive constraints (diffusion models ignore negation): clean unbranded surfaces, no visible text or logos on products, modern current-generation devices only.`
}

// ── Generación ────────────────────────────────────────────────────────────────

interface GeminiImageResponse {
  candidates?: {
    content?: { parts?: { text?: string; inlineData?: { data?: string; mimeType?: string } }[] }
    finishReason?: string
  }[]
}

export async function generateBackgroundGemini(input: ArtDirectionInput): Promise<Buffer> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new ProviderError('GEMINI_API_KEY no configurada en el servidor', 500)

  const b64 = await withRetry(async () => {
    const res = await fetch(`${ENDPOINT}?key=${key}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(input) }] }],
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new ProviderError(`Gemini image ${res.status}: ${detail.slice(0, 300)}`, res.status)
    }

    const data      = await res.json() as GeminiImageResponse
    const candidate = data.candidates?.[0]
    // La imagen puede no ser la primera parte: puede venir una parte .text antes.
    const imagePart = candidate?.content?.parts?.find(p => p.inlineData?.data)
    if (!imagePart?.inlineData?.data) {
      throw new ProviderError(`Gemini image no devolvió imagen (finishReason: ${candidate?.finishReason ?? 'desconocido'})`, 502)
    }
    return imagePart.inlineData.data
  })

  // PNG/JPEG base64. compose.ts lo pasa por sharp igual, sin conversión previa.
  return Buffer.from(b64, 'base64')
}
