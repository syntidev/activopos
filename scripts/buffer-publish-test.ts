import { config } from 'dotenv'
config()
async function main() {
  const sharp = (await import('sharp')).default
  const { uploadImage } = await import('../src/lib/social/cloudinary')
  const { createPost, getPostsByChannel, BUFFER_IG_CHANNEL } = await import('../src/lib/social/buffer')

  const png = await sharp({ create: { width: 1080, height: 1350, channels: 3, background: { r: 0, g: 56, b: 189 } } }).png().toBuffer()
  const imageUrl = await uploadImage(png, 'image/png')
  console.log('imagen Cloudinary:', imageUrl)

  const dueAt = '2027-12-31T12:00:00.000Z'  // programado lejos: NO sale publico
  const text  = 'Test API — borrar (verificacion Fase E ActivoPOS)'
  const res = await createPost({ channelId: BUFFER_IG_CHANNEL, text, imageUrls: [imageUrl], dueAt })
  console.log('createPost OK -> buffer id:', res.id, '| status:', res.status)

  const posts = await getPostsByChannel(BUFFER_IG_CHANNEL)
  const mine  = posts.find(p => p.id === res.id)
  console.log('query posts: total', posts.length, '| el de prueba aparece:', !!mine)
  if (mine) console.log('  ->', mine.status, '|', mine.dueAt, '|', mine.text.slice(0, 45))
}
main().catch(e => { console.error('FALLO:', e.message) })
