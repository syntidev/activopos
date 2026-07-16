import { type Aspect } from './brand'
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

/**
 * El endpoint no acepta negative_prompt (422 extra_forbidden), y los modelos de difusión
 * ignoran la negación de todos modos: pedir "no text" produce texto. Por eso las
 * restricciones van formuladas en POSITIVO — paredes lisas, envases sin etiqueta —
 * que es lo único que un difusor sabe seguir.
 */
function buildPrompt(escena: string, nicho: string, direction?: SceneDirection): string {
  // Mismo patrón de composición que Socialia (persona + escena + acción + contexto de
  // marca) -- pero construido acá directo, no delegado a Gemini: son más específicos e
  // intencionales que la "escena" genérica que el copy adivina por nicho.
  const subjectLine = hasDirection(direction)
    ? [
        direction.personaje?.trim() ? `Subject: ${direction.personaje.trim()}.` : '',
        direction.accion?.trim()    ? `Action: ${direction.accion.trim()}.`     : '',
      ].filter(Boolean).join(' ')
    : escena
  const settingLine = hasDirection(direction) && direction.lugar?.trim()
    ? `Setting: ${direction.lugar.trim()}, a real Venezuelan small business (${nicho}).`
    : `Setting: a real Venezuelan small business (${nicho}).`

  return `Photorealistic documentary photograph, shot on a 50mm lens at f/1.8. ${subjectLine}

${settingLine} Authentic and lived-in, never stock-photo generic.
Natural window light, shallow depth of field, filmic grain, true-to-life colors.
Bare clean walls. Plain unbranded packaging. Blank surfaces. Empty picture frames.
The lower third of the frame stays calm, dark and uncluttered.`
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
