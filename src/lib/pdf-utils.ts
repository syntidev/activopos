import { readFile } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

export interface Logo {
  dataUrl: string
  width:   number
  height:  number
}

// Logo es decorativo — si falla la lectura/conversión, se omite en vez de romper el PDF
export async function loadLogo(logoPath: string): Promise<Logo | null> {
  try {
    const resolved = path.resolve(process.cwd(), '.' + logoPath)
    if (!resolved.startsWith(path.resolve(process.cwd()) + path.sep)) return null

    const buffer = await readFile(resolved)
    const png    = await sharp(buffer).resize(160, 160, { fit: 'inside' }).png().toBuffer()
    const meta   = await sharp(png).metadata()

    const width  = 22
    const height = meta.width && meta.height ? (width * meta.height) / meta.width : 12

    return { dataUrl: `data:image/png;base64,${png.toString('base64')}`, width, height }
  } catch {
    return null
  }
}
