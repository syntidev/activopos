import {
  type Aspect,
  HUMAN_SCENE_VARIANTS, ILUMINACION_VARIANTS, ANGULO_VARIANTS, normalizeNicho,
} from './brand'
import { ProviderError, withRetry } from './retry'

/**
 * Generación del fondo con NVIDIA NIM. Sustituye a Gemini para imagen: la cuenta de
 * Google tiene cuota free-tier = 0 en todos sus modelos de imagen. El copy sigue en Gemini.
 *
 * Endpoint verificado contra la API real (2026-07-14), no contra la documentación:
 *  - integrate.api.nvidia.com NO expone /v1/images/generations → 404 page not found.
 *  - Las imágenes viven en ai.api.nvidia.com/v1/genai/<org>/<modelo>.
 *  - qwen/qwen-image NO está habilitado en la cuenta ("Function not found for account").
 *    FLUX.1-dev sí, y es el que se usa aquí.
 *  - La respuesta NO sigue el formato OpenAI (data[].b64_json): es artifacts[].base64,
 *    y el binario es JPEG (magic ffd8ff), no PNG.
 */

const ENDPOINT = 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev'

// El modelo solo acepta width/height de una lista discreta (768..1344, paso 64);
// cualquier otro valor devuelve 422. Se elige el par más cercano a cada aspect y
// sharp termina de encuadrar al lienzo final en compose.ts. Independiente del tipo de
// pieza (post/story/carrusel) desde que el selector de formato de salida lo desacopló.
const GEN_SIZE: Record<Aspect, { width: number; height: number }> = {
  '1:1':  { width: 1024, height: 1024 },  // 1.0 exacto
  '4:5':  { width: 1024, height: 1280 },  // 0.8 exacto
  '3:4':  { width: 960,  height: 1280 },  // 0.75 exacto
  '9:16': { width: 768,  height: 1344 },  // 0.571 -- lo más cercano a 0.5625 que admite
}

interface FluxResponse {
  artifacts?: { base64: string; finishReason?: string }[]
}

// Dirección de escena/personaje real (PIEZA 1) -- cuando el usuario llena alguno de estos
// 3 campos en el formulario, reemplazan la escena genérica que arma Gemini (más específicos
// e intencionales que su adivinanza). Vacíos → mismo comportamiento de siempre (fallback).
export interface SceneDirection {
  personaje?: string
  lugar?:     string
  accion?:    string
}

function hasDirection(d?: SceneDirection): d is SceneDirection {
  return !!d && !!(d.personaje?.trim() || d.lugar?.trim() || d.accion?.trim())
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Fallback NVIDIA FLUX. Misma dirección de arte humana venezolana que gemini-image.ts
 * (motor primario), para que un fallback también salga con sujeto real del segmento,
 * no una escena genérica. La dirección manual del formulario gana sobre la variante.
 * El endpoint no acepta negative_prompt (422); las restricciones van en el propio prompt.
 */
function buildPrompt(escena: string, nicho: string, direction?: SceneDirection): string {
  const subject = hasDirection(direction)
    ? [
        direction?.personaje?.trim() ?? '',
        direction?.accion?.trim() ? `, ${direction.accion.trim()}` : '',
        direction?.lugar?.trim()  ? `, at ${direction.lugar.trim()}` : '',
      ].filter(Boolean).join('')
    : pickRandom(HUMAN_SCENE_VARIANTS[normalizeNicho(nicho)] ?? HUMAN_SCENE_VARIANTS.general)
  const light = pickRandom(ILUMINACION_VARIANTS)
  const angle = pickRandom(ANGULO_VARIANTS)

  return `Photorealistic documentary advertising photograph, shot on a 50mm lens at f/1.8.
Scene: ${subject}, ${angle}, ${light}, holding a modern smartphone with the GLASS SCREEN
facing the camera, showing a glowing POS dashboard UI in Persian Blue (#0038BD).
The camera bump is hidden behind the device; never show a camera module on the visible face.

Setting: a real Venezuelan small business (${nicho}). Authentic and lived-in, never stock-photo generic.
Present day, contemporary 2020s. Current-generation devices, modern retail fittings, LED lighting.
Natural light, shallow depth of field, filmic grain, true-to-life colors.
Subtle Persian Blue ambient glow from the screen; a single small Carrot Amber (#EF8E01) accent.

The TOP third of the frame stays calm and uncluttered (wall, ceiling, sky or soft bokeh)
for a text overlay. Bare clean walls. Plain unbranded packaging. Blank surfaces.
No text, letters, logos or watermarks anywhere. No bars or letterboxing.
Context reference (do not render as text): "${escena}".`
}

export async function generateBackground(
  escena: string,
  nicho: string,
  aspect: Aspect,
  direction?: SceneDirection,
): Promise<Buffer> {
  const key = process.env.NVIDIA_API_KEY
  if (!key) throw new ProviderError('NVIDIA_API_KEY no configurada en el servidor', 500)

  const { width, height } = GEN_SIZE[aspect]

  const artifact = await withRetry(async () => {
    const res = await fetch(ENDPOINT, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept:         'application/json',
      },
      body: JSON.stringify({
        prompt: buildPrompt(escena, nicho, direction),
        width,
        height,
        steps: 40,
        // FLUX.1-dev está destilado por guidance: por encima de ~4 satura y se ve plástico.
        cfg_scale: 3.5,
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new ProviderError(`NVIDIA NIM ${res.status}: ${detail.slice(0, 300)}`, res.status)
    }

    const data  = await res.json() as FluxResponse
    const first = data.artifacts?.[0]
    if (!first?.base64) throw new ProviderError('NVIDIA NIM no devolvió imagen', 502)
    if (first.finishReason && first.finishReason !== 'SUCCESS') {
      // Típicamente CONTENT_FILTERED: devuelve un artifact vacío o en negro.
      throw new ProviderError(`NVIDIA NIM rechazó el prompt: ${first.finishReason}`, 422)
    }
    return first.base64
  })

  // JPEG. compose.ts lo pasa por sharp igual, así que no hace falta convertirlo aquí.
  return Buffer.from(artifact, 'base64')
}
