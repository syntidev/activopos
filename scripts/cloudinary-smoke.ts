/**
 * Smoke test de Fase A: sube una imagen real a Cloudinary y devuelve el secure_url.
 * No gasta cuota de Gemini/FLUX — genera el buffer con sharp local.
 *
 *   npx tsx scripts/cloudinary-smoke.ts
 *   -> imprime la URL; el curl 200 se verifica en el paso siguiente.
 */
import { config } from 'dotenv'
config()

async function main(): Promise<void> {
  const sharp = (await import('sharp')).default
  const { uploadImage } = await import('../src/lib/social/cloudinary')

  const buffer = await sharp({
    create: { width: 1080, height: 1350, channels: 3, background: { r: 0, g: 56, b: 189 } },
  }).webp({ quality: 90 }).toBuffer()

  const url = await uploadImage(buffer)
  console.log('secure_url:', url)
}

main().catch(err => { console.error('FALLO:', err.message); process.exit(1) })
