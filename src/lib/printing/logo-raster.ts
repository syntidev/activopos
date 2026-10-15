// Logo del negocio -> imagen monocroma raster para ESC/POS (GS v 0).
// Solo navegador (usa <canvas>). Nunca lanza: sin logo legible, el ticket sale sin él.

import type { RasterImage } from '@/lib/printing/escpos'

const MAX_HEIGHT = 160
const BLACK_BELOW = 140   // luminancia (0-255) bajo la cual el punto se imprime

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error('logo no legible'))
    img.src = url
  })
}

/** `maxWidth` en puntos: 384 en 58mm, 576 en 80mm (ancho imprimible típico). */
export async function loadLogoRaster(url: string, maxWidth: number): Promise<RasterImage | null> {
  try {
    const img = await loadImage(url)
    const scale  = Math.min(1, maxWidth / img.naturalWidth, MAX_HEIGHT / img.naturalHeight)
    const width  = Math.max(8, Math.floor((img.naturalWidth * scale) / 8) * 8)
    const height = Math.max(1, Math.round(img.naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    const { data } = ctx.getImageData(0, 0, width, height)

    const wBytes = width / 8
    const bytes  = new Uint8Array(wBytes * height)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        if (lum < BLACK_BELOW) bytes[y * wBytes + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
    return { width, height, bytes }
  } catch {
    return null
  }
}
