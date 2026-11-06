import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { OG_HEIGHT, OG_WIDTH } from './metadata'
import type { LogoImage } from './images'

/**
 * Tarjeta para compartir (1200×630, JPEG < 250 KB). Satori (next/og) la dibuja a PNG y sharp la comprime a JPEG:
 * WhatsApp descarta previews pesadas y no siempre lee WebP, así que el formato y el peso son parte del contrato.
 * Los colores viven aquí porque el renderizador no entiende variables CSS (no hay tokens.css en una imagen).
 */
export const OG_MAX_BYTES = 245 * 1024
const PHOTO = OG_HEIGHT

export interface Palette { bg: string; panel: string; text: string; muted: string; accent: string }

export const LIGHT: Palette = { bg: '#FFFFFF', panel: '#FFFFFF', text: '#1B1B2B', muted: '#5B5B70', accent: '#0038BD' }

const HEX_RE = /^#[0-9a-f]{6}$/i
/** Color de marca del negocio si es un hex válido; si no, el acento de la paleta. */
export const brandAccent = (color: string | null | undefined, fallback: string): string => (color && HEX_RE.test(color) ? color : fallback)

export interface ProductCard {
  palette:      Palette
  name:         string
  businessName: string
  /** Data URI de la foto ya cuadrada (630×630); null = tarjeta tipográfica. */
  photo:        string | null
  logo:         LogoImage | null
  /** Precio principal ya formateado ("$15.00"); con `consult` se muestra "Consultar precio". */
  priceUsd:     string | null
  priceBs:      string | null
  consult:      boolean
}

const nameSize = (n: string): number => (n.length > 70 ? 40 : n.length > 40 ? 50 : 62)

function ProductLayout({ c }: { c: ProductCard }): JSX.Element {
  const p = c.palette
  const name = c.name.length > 90 ? `${c.name.slice(0, 87)}…` : c.name
  return (
    <div style={{ width: OG_WIDTH, height: OG_HEIGHT, display: 'flex', background: p.bg }}>
      {c.photo && <img src={c.photo} width={PHOTO} height={PHOTO} style={{ width: PHOTO, height: PHOTO }} />}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, padding: '48px 56px', background: p.panel }}>
        <div style={{ display: 'flex', alignItems: 'center', height: 90 }}>
          {c.logo
            ? <img src={c.logo.src} width={c.logo.width} height={c.logo.height} style={{ width: c.logo.width, height: c.logo.height }} />
            : <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: p.accent }}>{c.businessName}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: nameSize(name), fontWeight: 700, color: p.text, lineHeight: 1.12, maxHeight: 270, overflow: 'hidden' }}>{name}</div>
          {c.consult || !c.priceUsd ? (
            <div style={{ display: 'flex', marginTop: 24, fontSize: 46, fontWeight: 700, color: p.accent }}>Consultar precio</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 24 }}>
              <div style={{ display: 'flex', fontSize: 88, fontWeight: 700, color: p.accent, lineHeight: 1 }}>{c.priceUsd}</div>
              {c.priceBs && <div style={{ display: 'flex', marginTop: 8, fontSize: 38, color: p.muted }}>{c.priceBs}</div>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', fontSize: 26, color: p.muted }}>{c.logo ? c.businessName : ' '}</div>
      </div>
    </div>
  )
}

export interface CoverCard {
  palette:      Palette
  businessName: string
  tagline:      string | null
  logo:         LogoImage | null
  /** Data URI de la portada recortada 1200×630; null = fondo de color de marca. */
  background:   string | null
}

function CoverLayout({ c }: { c: CoverCard }): JSX.Element {
  const p = c.palette
  return (
    <div style={{ width: OG_WIDTH, height: OG_HEIGHT, display: 'flex', position: 'relative', background: p.accent }}>
      {c.background && <img src={c.background} width={OG_WIDTH} height={OG_HEIGHT} style={{ position: 'absolute', top: 0, left: 0 }} />}
      {c.background && <div style={{ position: 'absolute', top: 0, left: 0, width: OG_WIDTH, height: OG_HEIGHT, background: 'rgba(0,0,0,0.45)' }} />}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: OG_WIDTH, height: OG_HEIGHT, padding: 80, position: 'relative' }}>
        {c.logo && (
          <div style={{ display: 'flex', padding: 24, borderRadius: 28, background: '#FFFFFF', marginBottom: 36 }}>
            <img src={c.logo.src} width={c.logo.width} height={c.logo.height} style={{ width: c.logo.width, height: c.logo.height }} />
          </div>
        )}
        <div style={{ display: 'flex', fontSize: c.businessName.length > 28 ? 64 : 84, fontWeight: 700, color: '#FFFFFF', textAlign: 'center' }}>{c.businessName}</div>
        {c.tagline && <div style={{ display: 'flex', marginTop: 20, fontSize: 34, color: '#FFFFFF', textAlign: 'center' }}>{c.tagline.slice(0, 110)}</div>}
      </div>
    </div>
  )
}

/** PNG de satori → JPEG bajando calidad hasta entrar en el presupuesto de bytes. */
async function toJpeg(el: JSX.Element): Promise<Buffer> {
  const png = Buffer.from(await new ImageResponse(el, { width: OG_WIDTH, height: OG_HEIGHT }).arrayBuffer())
  let out: Buffer = png
  for (const quality of [88, 78, 68, 58, 48, 38]) {
    out = await sharp(png).flatten({ background: '#FFFFFF' }).jpeg({ quality, mozjpeg: true }).toBuffer()
    if (out.length <= OG_MAX_BYTES) break
  }
  return out
}

export const renderProductCard = (c: ProductCard): Promise<Buffer> => toJpeg(<ProductLayout c={c} />)
export const renderCoverCard = (c: CoverCard): Promise<Buffer> => toJpeg(<CoverLayout c={c} />)

/** Respuesta HTTP de una tarjeta: cache de 1 día; la URL lleva ?v=<updated_at> para que WhatsApp renueve la preview. */
export function jpegResponse(body: Buffer): Response {
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type':   'image/jpeg',
      'Content-Length': String(body.length),
      'Cache-Control':  'public, max-age=86400, s-maxage=86400',
    },
  })
}
