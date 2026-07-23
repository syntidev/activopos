import {
  type Aspect, ASPECT_DIMENSIONS,
  HUMAN_SCENE_VARIANTS, ILUMINACION_VARIANTS, ANGULO_VARIANTS, normalizeNicho,
} from './brand'
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
  // Fríos/neutros para balancear el sesgo amarillo/sepia de WARM_SAND + VIBRANT_AMBER.
  PURPLE_TECH: {
    background: 'deep purple-violet gradient with subtle tech glow',
    mood:       'modern, distinctive, premium innovation feel',
  },
  MINT_FRESH: {
    background: 'soft mint/teal gradient with clean geometric accents',
    mood:       'fresh, trustworthy, calm professionalism',
  },
}

export type PresetKey = 'NAVY_TECH' | 'SKY_LIGHT' | 'WARM_SAND' | 'VIBRANT_AMBER' | 'CLEAN_WHITE' | 'PURPLE_TECH' | 'MINT_FRESH'

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
  const benefit = ['SKY_LIGHT', 'WARM_SAND', 'CLEAN_WHITE', 'PURPLE_TECH', 'MINT_FRESH']

  if (slideRole === 'portada' || slideRole === 'cta') return COLOR_PRESETS[impact[slideIndex % impact.length]]
  if (slideRole === 'problema')                       return COLOR_PRESETS.NAVY_TECH
  if (slideRole === 'beneficio')                      return COLOR_PRESETS[benefit[slideIndex % benefit.length]]

  const all = Object.keys(COLOR_PRESETS)
  return COLOR_PRESETS[all[Math.floor(Math.random() * all.length)]]
}

// ── Prompt ────────────────────────────────────────────────────────────────────

export interface ArtDirectionInput {
  escena:      string
  nicho:       string
  slideRole?:  SlideRole
  /** Posición en el carrusel/serie — decide la rotación de preset. */
  slideIndex?: number
  /** Preset forzado desde el formulario. Si se da, ignora pickPreset. */
  presetKey?:  PresetKey
  direction?:  SceneDirection
  aspect:      Aspect
  /** Paneles glassmorphism flotantes. Si no se da, default por rol: 'valor' → true, resto false. */
  floatingElements?: boolean
}

function hasDirection(d?: SceneDirection): boolean {
  return !!d && !!(d.personaje?.trim() || d.lugar?.trim() || d.accion?.trim())
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function buildPrompt(input: ArtDirectionInput): string {
  const { width, height } = ASPECT_DIMENSIONS[input.aspect]
  // Preset forzado por el usuario, o automático por rol de slide. Se usa solo como
  // ambiente/mood — la escena la manda el sujeto humano venezolano.
  const preset = input.presetKey
    ? COLOR_PRESETS[input.presetKey]
    : pickPreset(input.slideRole, input.slideIndex ?? 0)

  // Sujeto: la dirección manual del formulario (personaje/acción/lugar) gana si
  // viene; si no, una variante humana venezolana según el segmento normalizado.
  const subject = hasDirection(input.direction)
    ? [
        input.direction?.personaje?.trim() ?? '',
        input.direction?.accion?.trim() ? `, ${input.direction.accion.trim()}` : '',
        input.direction?.lugar?.trim()  ? `, at ${input.direction.lugar.trim()}` : '',
      ].filter(Boolean).join('')
    : pickRandom(HUMAN_SCENE_VARIANTS[normalizeNicho(input.nicho)] ?? HUMAN_SCENE_VARIANTS.general)
  const light = pickRandom(ILUMINACION_VARIANTS)
  const angle = pickRandom(ANGULO_VARIANTS)

  // Paneles flotantes: el usuario los pide explícito (posts) o, en carrusel, se activan
  // solos en el slide de valor. Nota: carrusel.ts mapea 'valor'→'beneficio' (toArtRole)
  // antes de llegar acá, así que el rol que vemos es 'beneficio'. Iconográficos — sin
  // texto/números, para no romper ZERO TEXT ni depender de cifras IA legibles.
  const floating = input.floatingElements ?? (input.slideRole === 'beneficio')

  const handsBlock = `

HANDS AND FINGERS (HYPER-CRITICAL — rejection risk):
Hands must be anatomically perfect:
- Exactly 5 fingers per hand, no more, no less
- Natural finger proportions, no elongated or fused joints
- No extra knuckles, no melting skin, no horror-movie distortion
- Fingers clearly separated and individually defined
- Wrist at a natural angle — no twisted or broken wrist
- Hands rest naturally at the sides, gesture, or interact with the environment`

  const floatingBlock = floating ? `

FLOATING UI ELEMENTS (glassmorphism — iconographic, NO text or numbers):
Around the person, floating in 3D at natural distances, add 3-4 semi-transparent glassmorphism panels (rgba(255,255,255,0.12) blurred fill, 1px rgba(255,255,255,0.25) border, soft drop shadow, slight 3D tilt), lit by Persian Blue (#0038BD) ambient light, floating in the space around the person:
- Upper right: a sales card with a small abstract bar-chart motif.
- Left side: a pill with an upward green (#16A34A) arrow and a Carrot Amber (#EF8E01) accent dot.
- Lower right: a row of payment-method chips as plain white icons (mobile payment, card, cash).
- Optional upper left: a small badge with a package/box icon and a green status dot, only if it does not cover the face.
Panels must NOT cover the person's face and stay iconographic — no letters, numbers, words or logos (all real text is composited later).` : ''

  return `ROLE: Senior Art Director producing a premium, photorealistic Instagram advertising image for ActivoPOS, a Venezuelan small-business point-of-sale software.

CRITICAL — ZERO TEXT IN IMAGE:
Do NOT render any text, typography, words, labels, letters or numbers anywhere. Text is composited afterward. Clean art only.

FORMAT: ${width}x${height} px. Fill the entire canvas. No bars, no letterboxing.

SCENE: ${subject}, ${angle}, ${light}. Hands rest naturally at the sides or gesture expressively — NO phone, tablet or device in the hands. The person interacts naturally with the environment (behind a counter, arranging products, or talking to the camera) in an authentic Venezuelan small-business setting. The product (ActivoPOS) is composited later as a digital overlay — do NOT draw any phone, tablet or screen.${handsBlock}

COMPOSITION (CRITICAL):
Leave the TOP 35% of the canvas calm and uncluttered for a text overlay — ceiling, wall, sky or soft bokeh, NOT a flat colored panel.
Subject occupies the lower-center 60% of the frame. Bottom stays readable but not busy.
Natural bokeh of the environment on the sides — never a flat colored block.

BRAND INTEGRATION:
Subtle Persian Blue (#0038BD) ambient glow in the scene. Carrot Amber (#EF8E01) as a single small accent (a notification dot or badge). Ambient mood: ${preset.mood}.${floatingBlock}

HUMAN DIRECTION:
Authentic Venezuelan features — diverse, real, warm expressions. Natural candid success, not a forced stock-photo smile. Modern casual clothing for a ${input.nicho} business owner in Venezuela. Background: a recognizable, warm Venezuelan small-business environment.

FORBIDDEN:
No flat color panels filling any zone — use natural bokeh for the text zone.
No street stalls, no outdoor markets, no arepas, no fiscal/SENIAT machines.
No text, words, letters, logos or watermarks anywhere.
No phone, tablet or screen in the hands or the scene. No bars or letterboxing.
No generic stock-photo look — it must feel authentically Venezuelan.

QUALITY: Photorealistic, 8K, cinematic professional lighting, shallow depth of field.`
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
