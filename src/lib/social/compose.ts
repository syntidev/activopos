import { readFileSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import { ASSETS, ASPECT_DIMENSIONS, BRAND, type Aspect, type SocialFormat } from './brand'

/**
 * Composición del overlay de marca sobre el fondo generado por Gemini.
 *
 * Reemplaza la composición html2canvas de C:\socialia\App.tsx (L456-529). html2canvas
 * solo corre en el navegador (necesita DOM + getComputedStyle), así que no sirve dentro
 * de un route handler. sharp — ya instalado en el proyecto — hace lo mismo server-side:
 * el endpoint entrega la imagen terminada en una sola llamada, sin round-trip al cliente.
 *
 * Las fuentes se cargan por fontfile desde el repo, no del sistema: el VPS no necesita
 * tener Fraunces ni Inter instaladas y el render es idéntico en Windows y Linux.
 */

const MARGIN     = 72   // margen de seguridad de Instagram
const LOGO_SIZE  = 84
const TEXT_WIDTH = 936  // 1080 - 2*72
const ACCENT_W   = 88
const ACCENT_H   = 5

// El SVG negativo trae un <rect> navy opaco de fondo (L22) porque está pensado como icono
// de app. Sobre una foto eso dibuja un cuadro. Se retira para dejar el isotipo transparente.
const logoSvg = Buffer.from(
  readFileSync(ASSETS.logoNegative, 'utf8').replace(/<rect[^>]*fill="#0D1B2E"[^>]*\/>/, ''),
)

// Variante positiva (isotipo oscuro) para fondos claros — el editor la ofrece
// como logoType 'positive'. Se le quita el <rect> de fondo (navy o blanco) para
// dejar el isotipo transparente sobre la foto, igual que a la negativa.
const logoPositiveSvg = Buffer.from(
  readFileSync(join(process.cwd(), 'public', 'activopos-logo-positive.svg'), 'utf8')
    .replace(/<rect[^>]*(fill="#0D1B2E"|fill="#FFFFFF")[^>]*\/>/i, ''),
)

// Pango interpreta markup: un &, < o > del copy rompería el render.
function escapeMarkup(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function renderText(
  text: string,
  opts: {
    fontfile: string; font: string; size: number; color: string; weight: string
    align?: 'left' | 'center' | 'right'
  },
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const buffer = await sharp({
    text: {
      // dpi 72 → 1pt equivale a 1px, así los tamaños se razonan en píxeles del lienzo.
      dpi:      72,
      text:     `<span foreground="${opts.color}" size="${opts.size}pt" weight="${opts.weight}">${escapeMarkup(text)}</span>`,
      font:     opts.font,
      fontfile: opts.fontfile,
      width:    TEXT_WIDTH,
      align:    opts.align ?? 'left',
      rgba:     true,
    },
  }).png().toBuffer()

  const meta = await sharp(buffer).metadata()
  return { buffer, width: meta.width ?? 0, height: meta.height ?? 0 }
}

export interface ComposeInput {
  background: Buffer
  titulo:     string
  subtitulo:  string
  formato:    SocialFormat   // solo determina tamaño de fuente (story = letras más grandes)
  aspect:     Aspect         // determina el lienzo final -- selector del formulario
  override?:  LayerOverride  // ajustes del editor; ausente = posiciones/estilos fijos de siempre
}

/**
 * Ajustes por capa desde el editor interactivo (Fase B). Cada campo es opcional:
 * el que no venga usa el default de la composición fija actual, así componer sin
 * override reproduce exactamente el resultado anterior (cero regresión).
 *
 * Posiciones (x, y): esquina superior-izquierda de la capa en píxeles del lienzo
 * final (mismo sistema que sharp: 0,0 arriba-izquierda).
 */
export interface LayerOverride {
  titlePos?:       { x: number; y: number }
  subtitlePos?:    { x: number; y: number }
  logoPos?:        { x: number; y: number }
  titleSize?:      number
  subtitleSize?:   number
  logoSize?:       number
  titleColor?:     string
  subtitleColor?:  string
  logoType?:       'negative' | 'positive'
  showLogo?:       boolean
  showTitle?:      boolean
  showSubtitle?:   boolean
  titleAlign?:     'left' | 'center' | 'right'
  subtitleAlign?:  'left' | 'center' | 'right'
  titleShadow?:    boolean
  subtitleShadow?: boolean
}

// Sombra: Pango no tiene text-shadow, así que se compone un duplicado negro
// semitransparente detrás del texto, desplazado unos px. Real, no simulado.
const SHADOW_OFFSET  = 3
const SHADOW_COLOR   = '#00000099'

export async function composeSlide(input: ComposeInput): Promise<Buffer> {
  const { width, height } = ASPECT_DIMENSIONS[input.aspect]
  const ov = input.override ?? {}

  const showTitle    = ov.showTitle    ?? true
  const showSubtitle = ov.showSubtitle ?? true
  const showLogo     = ov.showLogo     ?? true

  const titleSize    = ov.titleSize    ?? (input.formato === 'story' ? 76 : 68)
  const subtitleSize = ov.subtitleSize ?? (input.formato === 'story' ? 36 : 32)

  const [title, subtitle] = await Promise.all([
    renderText(input.titulo, {
      fontfile: ASSETS.fontDisplay, font: 'Fraunces',
      size: titleSize, color: ov.titleColor ?? BRAND.onBrand, weight: 'bold',
      align: ov.titleAlign ?? 'left',
    }),
    renderText(input.subtitulo, {
      fontfile: ASSETS.fontBody, font: 'Inter',
      size: subtitleSize, color: ov.subtitleColor ?? BRAND.onBrand, weight: '600',
      align: ov.subtitleAlign ?? 'left',
    }),
  ])

  // Posiciones default: apilado desde abajo (subtítulo → título → acento). El
  // override pisa la esquina superior-izquierda de cada capa cuando viene.
  const subtitleTop  = ov.subtitlePos?.y ?? (height - MARGIN - subtitle.height)
  const subtitleLeft = ov.subtitlePos?.x ?? MARGIN
  const titleTop     = ov.titlePos?.y    ?? (subtitleTop - 28 - title.height)
  const titleLeft    = ov.titlePos?.x    ?? MARGIN
  const accentTop    = titleTop - 32 - ACCENT_H

  // Rampa larga y con paradas intermedias: un scrim corto produce una banda visible
  // cuando el fondo es plano. Arranca a media imagen y sube despacio.
  const scrimStart = Math.max(0, (accentTop - 60) / height)

  const scrim = Buffer.from(`<svg width="${width}" height="${height}">
    <defs>
      <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.30" stop-color="${BRAND.primaryDark}" stop-opacity="0"/>
        <stop offset="${(scrimStart * 0.75).toFixed(3)}" stop-color="${BRAND.primaryDark}" stop-opacity="0.28"/>
        <stop offset="${scrimStart.toFixed(3)}" stop-color="${BRAND.primaryDark}" stop-opacity="0.72"/>
        <stop offset="1" stop-color="${BRAND.primaryDark}" stop-opacity="0.94"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#s)"/>
  </svg>`)

  const accent = Buffer.from(
    `<svg width="${ACCENT_W}" height="${ACCENT_H}">
      <rect width="${ACCENT_W}" height="${ACCENT_H}" rx="${ACCENT_H / 2}" fill="${BRAND.primaryLight}"/>
    </svg>`,
  )

  const logoSize = ov.logoSize ?? LOGO_SIZE
  const logoSrc  = (ov.logoType ?? 'negative') === 'positive' ? logoPositiveSvg : logoSvg
  const logo     = await sharp(logoSrc).resize({ width: logoSize }).png().toBuffer()
  const logoTop  = ov.logoPos?.y ?? MARGIN
  const logoLeft = ov.logoPos?.x ?? MARGIN

  // La marca no tiene asset de wordmark, solo el isotipo (brackets + círculo).
  // El lockup se arma aquí: isotipo + nombre en Inter.
  const wordmark = await renderText(BRAND.name, {
    fontfile: ASSETS.fontBody, font: 'Inter', size: 34, color: BRAND.onBrand, weight: 'bold',
  })

  const base = await sharp(input.background)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .toBuffer()

  // Sombra opcional por capa: duplicado negro renderizado aparte, compuesto
  // detrás y desplazado. Solo se genera cuando la capa la pide.
  const shadowOf = async (text: string, size: number, align: 'left' | 'center' | 'right', font: string, fontfile: string, weight: string) =>
    (await renderText(text, { fontfile, font, size, color: SHADOW_COLOR, weight, align })).buffer

  const layers: sharp.OverlayOptions[] = [{ input: scrim, top: 0, left: 0 }]

  if (showLogo) {
    layers.push({ input: logo, top: logoTop, left: logoLeft })
    layers.push({
      input: wordmark.buffer,
      top:  logoTop + Math.round((logoSize - wordmark.height) / 2),
      left: logoLeft + logoSize + 20,
    })
  }
  if (showTitle) {
    layers.push({ input: accent, top: accentTop, left: titleLeft })
    if (ov.titleShadow) {
      layers.push({
        input: await shadowOf(input.titulo, titleSize, ov.titleAlign ?? 'left', 'Fraunces', ASSETS.fontDisplay, 'bold'),
        top: titleTop + SHADOW_OFFSET, left: titleLeft + SHADOW_OFFSET,
      })
    }
    layers.push({ input: title.buffer, top: titleTop, left: titleLeft })
  }
  if (showSubtitle) {
    if (ov.subtitleShadow) {
      layers.push({
        input: await shadowOf(input.subtitulo, subtitleSize, ov.subtitleAlign ?? 'left', 'Inter', ASSETS.fontBody, '600'),
        top: subtitleTop + SHADOW_OFFSET, left: subtitleLeft + SHADOW_OFFSET,
      })
    }
    layers.push({ input: subtitle.buffer, top: subtitleTop, left: subtitleLeft })
  }

  return sharp(base).composite(layers).webp({ quality: 92 }).toBuffer()
}
