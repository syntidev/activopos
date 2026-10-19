import sharp from 'sharp'
import { extractRef, normalizeSize } from '@/lib/label-capture-shared'
import type { LabelOcrResult } from '@/types/label-capture'

/**
 * Lectura de la etiqueta con un modelo de visión de NVIDIA (chat/completions).
 * Solo se le pide ref, modelo y talla: el EAN sale del código de barras, y género/prenda
 * del producto. La clave vive en NVIDIA_API_KEY y nunca se loguea ni sale de este módulo.
 */

const MODEL = 'meta/llama-3.2-11b-vision-instruct'
const TIMEOUT_MS = 60_000
const IMAGE_MAX_SIDE = 1000
const MODEL_NAME_MAX = 120
const PROMPT =
  'Lee la etiqueta. Responde solo JSON: {ref, modelo, talla}. No inventes. Si no estás seguro de un dato, déjalo vacío.'
const TITLE_PROMPT =
  'Lee el nombre del producto impreso en la caja. Responde solo JSON: {titulo}. Copia únicamente el texto visible, sin inventar ni completar. Si no se lee con certeza, deja titulo vacío.'

export class VisionError extends Error {}

interface ChatResponse {
  choices?: { message?: { content?: string | null } }[]
}

/** Valor de una clave en un "JSON" tolerante (claves o valores sin comillas). */
function field(text: string, key: string): string {
  const re = new RegExp(`["']?${key}["']?\\s*:\\s*(?:"([^"]*)"|'([^']*)'|([^,}\\n]*))`, 'i')
  const m = re.exec(text)
  return (m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim()
}

export function parseVisionReply(text: string): LabelOcrResult {
  const modelo = field(text, 'modelo').replace(/[\u0000-\u001F\u007F]/g, '').slice(0, MODEL_NAME_MAX)
  return { ref: extractRef(field(text, 'ref')), modelo, talla: normalizeSize(field(text, 'talla')) }
}

function visionEndpoint(): { url: string; key: string } {
  const key = process.env.NVIDIA_API_KEY
  const base = process.env.NVIDIA_BASE_URL
  if (!key || !base) throw new VisionError('OCR no configurado en el servidor')
  const u = new URL(base)
  // La clave solo viaja a un host de NVIDIA, por https.
  if (u.protocol !== 'https:' || !u.hostname.endsWith('.nvidia.com')) {
    throw new VisionError('NVIDIA_BASE_URL no es un host de NVIDIA')
  }
  return { url: `${u.origin}/v1/chat/completions`, key }
}

/** Una pregunta de visión: imagen reducida + prompt → texto crudo del modelo. */
async function askVision(image: Buffer, prompt: string): Promise<string> {
  const { url, key } = visionEndpoint()
  const jpeg = await sharp(image)
    .rotate()
    .resize(IMAGE_MAX_SIDE, IMAGE_MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpeg.toString('base64')}` } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new VisionError('El servicio de lectura no respondió a tiempo')
  }
  if (!res.ok) throw new VisionError(`El servicio de lectura respondió ${res.status}`)

  const json = (await res.json()) as ChatResponse
  const raw = json.choices?.[0]?.message?.content ?? ''
  // Respuesta cruda al log del servidor (sin clave) para medir el acierto de las primeras etiquetas.
  console.info('[label-capture] respuesta cruda del modelo:', JSON.stringify(raw))
  return raw
}

export async function readLabel(image: Buffer): Promise<LabelOcrResult> {
  return parseVisionReply(await askVision(image, PROMPT))
}

/** Título impreso en la caja ('' = no se leyó con certeza). Nunca se deduce de un EAN. */
export async function readBoxTitle(image: Buffer): Promise<string> {
  const raw = await askVision(image, TITLE_PROMPT)
  return field(raw, 'titulo').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MODEL_NAME_MAX)
}
