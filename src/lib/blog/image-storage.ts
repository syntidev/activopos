import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import sharp from 'sharp'

/**
 * Guardado canónico de imágenes destacadas del blog. Extraído de
 * api/admin/blog/upload-image/route.ts cuando generate-image (IA) necesitó el
 * mismo pipeline: 1200x630 WebP en public/uploads/blog/. Una sola definición
 * del formato — si cambia la proporción OG, cambia acá y aplica a ambas rutas.
 *
 * El blog NO usa el Cloudinary del módulo social: su storage es local y las
 * URLs son relativas (/uploads/blog/...), servidas por el propio Next.
 */

const OG_WIDTH     = 1200
const OG_HEIGHT    = 630
const WEBP_QUALITY = 85

/** Devuelve la URL pública relativa ya lista para BlogPost.featured_image. */
export async function saveBlogImage(buffer: Buffer): Promise<string> {
  const filename  = `${randomUUID()}.webp`
  const uploadDir = join(process.cwd(), 'public', 'uploads', 'blog')
  await mkdir(uploadDir, { recursive: true, mode: 0o755 })

  const webpBuffer = await sharp(buffer)
    .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover' })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()

  await writeFile(join(uploadDir, filename), webpBuffer)

  return `/uploads/blog/${filename}`
}
