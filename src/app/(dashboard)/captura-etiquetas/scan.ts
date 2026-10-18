import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library'
import { EAN_RE, isValidEan13 } from '@/lib/label-capture-shared'

/** Lectura del código de barras en el navegador y reducción de la foto antes de subirla. */

const MAX_SIDE = 1600
const JPEG_QUALITY = 0.85

interface DetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}
type DetectorCtor = new (options: { formats: string[] }) => DetectorLike

export interface ScanResult {
  /** 13 dígitos leídos del código de barras (puede tener dígito de control inválido), o null. */
  ean: string | null
  /** Foto reducida a 1600 px (JPEG) para el OCR del servidor. */
  image: Blob
}

async function toCanvas(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas
}

function rotate90(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = src.height
  out.height = src.width
  const ctx = out.getContext('2d')
  ctx?.translate(src.height, 0)
  ctx?.rotate(Math.PI / 2)
  ctx?.drawImage(src, 0, 0)
  return out
}

async function detectNative(canvas: HTMLCanvasElement): Promise<string | null> {
  const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector
  if (!Ctor) return null
  try {
    const found = await new Ctor({ formats: ['ean_13'] }).detect(canvas)
    return found[0]?.rawValue ?? null
  } catch {
    return null
  }
}

function detectZxing(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const gray = new Uint8ClampedArray(width * height)
  for (let i = 0; i < gray.length; i++) {
    gray[i] = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000
  }
  const reader = new MultiFormatReader()
  reader.setHints(
    new Map<DecodeHintType, unknown>([
      [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]],
      [DecodeHintType.TRY_HARDER, true],
    ]),
  )
  try {
    return reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gray, width, height)))).getText()
  } catch {
    return null
  }
}

/** EAN-13 de la foto: BarcodeDetector si existe, si no zxing; si falla, rota 90° y reintenta. */
async function findEan(canvas: HTMLCanvasElement): Promise<string | null> {
  let invalidChecksum: string | null = null
  for (const view of [canvas, rotate90(canvas)]) {
    for (const text of [await detectNative(view), detectZxing(view)]) {
      if (!text || !EAN_RE.test(text)) continue
      if (isValidEan13(text)) return text
      invalidChecksum ??= text
    }
  }
  return invalidChecksum
}

export async function scanLabel(file: File): Promise<ScanResult> {
  const canvas = await toCanvas(file)
  const image = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!image) throw new Error('No se pudo procesar la foto')
  return { ean: await findEan(canvas), image }
}
