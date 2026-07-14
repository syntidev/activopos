import { readFileSync } from 'fs'
import sharp from 'sharp'
import { ASSETS, BRAND, FORMATS, type SocialFormat } from './brand'

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

// Pango interpreta markup: un &, < o > del copy rompería el render.
function escapeMarkup(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function renderText(
  text: string,
  opts: { fontfile: string; font: string; size: number; color: string; weight: string },
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const buffer = await sharp({
    text: {
      // dpi 72 → 1pt equivale a 1px, así los tamaños se razonan en píxeles del lienzo.
      dpi:      72,
      text:     `<span foreground="${opts.color}" size="${opts.size}pt" weight="${opts.weight}">${escapeMarkup(text)}</span>`,
      font:     opts.font,
      fontfile: opts.fontfile,
      width:    TEXT_WIDTH,
      align:    'left',
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
  formato:    SocialFormat
}

export async function composeSlide(input: ComposeInput): Promise<Buffer> {
  const { width, height } = FORMATS[input.formato]

  const [title, subtitle] = await Promise.all([
    renderText(input.titulo, {
      fontfile: ASSETS.fontDisplay,
      font:     'Fraunces',
      size:     input.formato === 'story' ? 76 : 68,
      color:    BRAND.onBrand,
      weight:   'bold',
    }),
    renderText(input.subtitulo, {
      fontfile: ASSETS.fontBody,
      font:     'Inter',
      size:     input.formato === 'story' ? 36 : 32,
      color:    '#FFFFFF',
      weight:   '600',
    }),
  ])

  // Apilado desde abajo: subtítulo → título → barra de acento.
  const subtitleTop = height - MARGIN - subtitle.height
  const titleTop    = subtitleTop - 28 - title.height
  const accentTop   = titleTop - 32 - ACCENT_H

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

  const logo = await sharp(logoSvg).resize({ width: LOGO_SIZE }).png().toBuffer()

  // La marca no tiene asset de wordmark, solo el isotipo (brackets + círculo).
  // El lockup se arma aquí: isotipo + nombre en Inter.
  const wordmark = await renderText(BRAND.name, {
    fontfile: ASSETS.fontBody,
    font:     'Inter',
    size:     34,
    color:    BRAND.onBrand,
    weight:   'bold',
  })

  const base = await sharp(input.background)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .toBuffer()

  return sharp(base)
    .composite([
      { input: scrim,            top: 0,           left: 0 },
      { input: logo,             top: MARGIN,      left: MARGIN },
      // Centrado óptico respecto al isotipo.
      { input: wordmark.buffer,  top: MARGIN + Math.round((LOGO_SIZE - wordmark.height) / 2), left: MARGIN + LOGO_SIZE + 20 },
      { input: accent,           top: accentTop,   left: MARGIN },
      { input: title.buffer,     top: titleTop,    left: MARGIN },
      { input: subtitle.buffer,  top: subtitleTop, left: MARGIN },
    ])
    .webp({ quality: 92 })
    .toBuffer()
}
