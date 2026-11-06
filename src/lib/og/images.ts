import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

/**
 * Carga de imágenes para las tarjetas OG. SOLO lee:
 *  - rutas propias del negocio: /storage/tenants/<id>/… (storage/) y /uploads/<id>/… (public/uploads/), y el <id> de la ruta DEBE ser
 *    el del negocio (nunca la foto de otro tenant); sin "..", sin barras invertidas, sin NUL;
 *  - https://images.unsplash.com/… (las fotos de los demos), con tiempo y tamaño acotados.
 * Cualquier otra URL se ignora: la ruta no es un proxy abierto (sin SSRF). Lo que no se pueda leer devuelve null (tarjeta tipográfica).
 */
const MAX_BYTES = 12 * 1024 * 1024
const LOCAL_RE = /^\/(storage\/tenants|uploads)\/(\d{1,9})\/(.+)$/
const UNSPLASH_HOST = 'images.unsplash.com'

async function readLocal(src: string, businessId: number): Promise<Buffer | null> {
  const m = LOCAL_RE.exec(src)
  if (!m || Number(m[2]) !== businessId) return null
  const rel = m[3]
  if (rel.includes('..') || rel.includes('\\') || rel.includes('\0')) return null
  const root = m[1] === 'uploads'
    ? path.join(process.cwd(), 'public', 'uploads', String(businessId))
    : path.join(process.cwd(), 'storage', 'tenants', String(businessId))
  const full = path.resolve(root, rel)
  if (!full.startsWith(root + path.sep)) return null
  try {
    const st = await fs.stat(full)
    if (!st.isFile() || st.size > MAX_BYTES) return null
    return await fs.readFile(full)
  } catch {
    return null
  }
}

async function readUnsplash(src: string): Promise<Buffer | null> {
  let url: URL
  try { url = new URL(src) } catch { return null }
  if (url.protocol !== 'https:' || url.hostname !== UNSPLASH_HOST) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), redirect: 'error' })
    if (!res.ok) return null
    const len = Number(res.headers.get('content-length') ?? 0)
    if (len > MAX_BYTES) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return buf.length <= MAX_BYTES ? buf : null
  } catch {
    return null
  }
}

/** Bytes crudos de la imagen (o null si no se puede/permite leer). */
export async function loadImageBytes(src: string, businessId: number): Promise<Buffer | null> {
  return src.startsWith('/') ? readLocal(src, businessId) : readUnsplash(src)
}

/** Primera imagen legible de una lista (las 3 primeras). */
export async function firstReadable(srcs: readonly string[], businessId: number): Promise<Buffer | null> {
  for (const s of srcs.slice(0, 3)) {
    const b = await loadImageBytes(s, businessId)
    if (b) return b
  }
  return null
}

const toDataUri = (mime: string, buf: Buffer): string => `data:${mime};base64,${buf.toString('base64')}`

/** Foto del producto: "contain" centrada sobre `bg` en un cuadrado (JPEG, como data URI para el renderizador). */
export async function photoSquare(buf: Buffer, size: number, bg: string): Promise<string | null> {
  try {
    const out = await sharp(buf).rotate().resize(size, size, { fit: 'contain', background: bg }).flatten({ background: bg }).jpeg({ quality: 86 }).toBuffer()
    return toDataUri('image/jpeg', out)
  } catch {
    return null
  }
}

export interface LogoImage { src: string; width: number; height: number }

/** Logo con transparencia conservada, acotado a `w`×`h`; devuelve también su tamaño real para maquetarlo sin recuadro. */
export async function logoPng(buf: Buffer, w: number, h: number): Promise<LogoImage | null> {
  try {
    const { data, info } = await sharp(buf).resize(w, h, { fit: 'inside' }).png().toBuffer({ resolveWithObject: true })
    return { src: toDataUri('image/png', data), width: info.width, height: info.height }
  } catch {
    return null
  }
}

/** Imagen de fondo a pantalla completa (recortada "cover"). */
export async function coverFill(buf: Buffer, w: number, h: number): Promise<string | null> {
  try {
    const out = await sharp(buf).rotate().resize(w, h, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer()
    return toDataUri('image/jpeg', out)
  } catch {
    return null
  }
}
