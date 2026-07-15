import { ProviderError } from './retry'

/**
 * Subida de imágenes a Cloudinary vía unsigned upload preset.
 *
 * Adaptado del patrón de TempSocialia\Referencia_Socialis\App.tsx (uploadToCloudinary):
 * allá corría en el navegador (FormData desde un <img>); aquí ya estamos en el servidor y
 * subimos el Buffer de sharp directo. Unsigned preset = no expone API secret, solo el
 * cloud name y el preset (ambos públicos por diseño en Cloudinary).
 *
 * Reemplaza el storage local en public/uploads/social/, que dependía de que el middleware
 * dejara pasar /uploads (causó el 404 del 14 jul). Una URL de Cloudinary es HTTPS pública
 * y directa — necesaria además para que Buffer pueda descargar la imagen al publicar.
 */

const FOLDER = 'activopos/social' // separa las imágenes de ActivoPOS del resto de la cuenta

interface CloudinaryResponse {
  secure_url?: string
  error?:      { message?: string }
}

export async function uploadImage(buffer: Buffer): Promise<string> {
  const cloud  = process.env.CLOUDINARY_CLOUD_NAME
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET
  if (!cloud || !preset) {
    throw new ProviderError('CLOUDINARY_CLOUD_NAME / CLOUDINARY_UPLOAD_PRESET no configuradas', 500)
  }

  const form = new FormData()
  // Uint8Array (no Buffer directo): Buffer no satisface BlobPart bajo TS strict
  // porque su ArrayBufferLike puede ser SharedArrayBuffer.
  form.append('file', new Blob([new Uint8Array(buffer)], { type: 'image/webp' }))
  form.append('upload_preset', preset)
  form.append('folder', FOLDER)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: 'POST',
    body:   form,
  })

  const data = await res.json() as CloudinaryResponse
  if (!res.ok || !data.secure_url) {
    throw new ProviderError(`Cloudinary ${res.status}: ${data.error?.message ?? 'sin secure_url'}`, res.status)
  }
  return data.secure_url
}
