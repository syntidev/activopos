import sharp from 'sharp'
import { FAVICON_SIZES, OG_H, OG_W } from '@/lib/web-identity'

/**
 * Procesado de la identidad web con sharp. Solo trabaja en memoria: devuelve buffers y el endpoint los escribe.
 * El SVG NUNCA se sirve: se rasteriza a PNG (y antes se rechaza si trae referencias externas o scripts).
 */

export const MAX_BYTES = 5 * 1024 * 1024
const MIN_FAVICON = 512
const MIN_OG_W = 600
const MIN_OG_H = Math.round((MIN_OG_W * OG_H) / OG_W)
/** Tolerancia de "cuadrado": 2 % entre ancho y alto. */
const SQUARE_TOLERANCE = 0.02
const SVG_UNSAFE = /<!ENTITY|<!DOCTYPE[^>]*\[|<script|<foreignObject|<image|<use[\s>]|<iframe|\bon[a-z]+\s*=|(?:xlink:)?href\s*=\s*["'](?!#)/i

export class IdentityImageError extends Error {}

type Meta = Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>

async function inspect(buf: Buffer, formats: readonly string[]): Promise<Meta> {
  let meta: Meta
  try {
    meta = await sharp(buf).metadata()
  } catch {
    throw new IdentityImageError('El archivo no es una imagen válida')
  }
  if (!meta.format || !formats.includes(meta.format)) {
    throw new IdentityImageError(`Formato no permitido. Usa ${formats.map(f => f.toUpperCase().replace('JPEG', 'JPG')).join(', ')}`)
  }
  if (meta.format === 'svg' && SVG_UNSAFE.test(buf.toString('utf8'))) {
    throw new IdentityImageError('El SVG contiene elementos no permitidos (scripts o enlaces externos). Expórtalo como PNG.')
  }
  return meta
}

export interface FaviconSet { size: (typeof FAVICON_SIZES)[number]; data: Buffer }

/** Favicon cuadrado ≥512 px → PNG 32, 180 (apple-touch, sobre blanco: iOS pinta lo transparente de negro), 192 y 512. */
export async function buildFavicon(buf: Buffer): Promise<FaviconSet[]> {
  const meta = await inspect(buf, ['png', 'jpeg', 'svg', 'webp'])
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  if (!w || !h || Math.abs(w - h) / Math.max(w, h) > SQUARE_TOLERANCE) throw new IdentityImageError('El favicon debe ser cuadrado (mismo ancho y alto)')
  if (meta.format !== 'svg' && Math.min(w, h) < MIN_FAVICON) throw new IdentityImageError(`El favicon debe medir al menos ${MIN_FAVICON}×${MIN_FAVICON} px`)
  const src = (): sharp.Sharp => sharp(buf, meta.format === 'svg' ? { density: 300 } : {}).rotate()
  return Promise.all(FAVICON_SIZES.map(async size => {
    const base = src().resize(size, size, { fit: 'cover' })
    const out = size === 180 ? base.flatten({ background: '#ffffff' }) : base
    return { size, data: await out.png({ compressionLevel: 9 }).toBuffer() }
  }))
}

export interface OgSet { webp: Buffer; jpg: Buffer }

/** Imagen para compartir: recorte "cover" a 1200×630 alrededor del punto de enfoque (0–100 %); webp + jpg (WhatsApp lee mejor jpg). */
export async function buildOg(buf: Buffer, focusX: number, focusY: number): Promise<OgSet> {
  const meta = await inspect(buf, ['png', 'jpeg', 'webp'])
  const girada = (meta.orientation ?? 1) >= 5 // EXIF de teléfono: rotate() intercambia ancho y alto
  const w = (girada ? meta.height : meta.width) ?? 0
  const h = (girada ? meta.width : meta.height) ?? 0
  if (w < MIN_OG_W || h < MIN_OG_H) throw new IdentityImageError(`La imagen es muy pequeña (mínimo ${MIN_OG_W}×${MIN_OG_H} px; ideal ${OG_W}×${OG_H})`)
  const scale = Math.max(OG_W / w, OG_H / h)
  const rw = Math.max(OG_W, Math.round(w * scale))
  const rh = Math.max(OG_H, Math.round(h * scale))
  const clamp = (n: number, max: number): number => Math.min(max, Math.max(0, Math.round(n)))
  const left = clamp(((rw - OG_W) * focusX) / 100, rw - OG_W)
  const top = clamp(((rh - OG_H) * focusY) / 100, rh - OG_H)
  const card = (): sharp.Sharp => sharp(buf).rotate().resize(rw, rh, { fit: 'fill' }).extract({ left, top, width: OG_W, height: OG_H }).flatten({ background: '#ffffff' })
  const [webp, jpg] = await Promise.all([card().webp({ quality: 85 }).toBuffer(), card().jpeg({ quality: 86, mozjpeg: true }).toBuffer()])
  return { webp, jpg }
}
