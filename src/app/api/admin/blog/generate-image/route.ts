import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { z } from 'zod'
import { generateBackground } from '@/lib/social/image'
import { generateBackgroundGemini } from '@/lib/social/gemini-image'
import { ProviderError } from '@/lib/social/retry'
import { saveBlogImage } from '@/lib/blog/image-storage'
import { uploadLimiter, getClientIp } from '@/lib/rate-limit'

// La difusión tarda ~9s por imagen — pasa de largo el default de Next.js.
export const runtime     = 'nodejs'
export const maxDuration = 120

const bodySchema = z.object({
  // Dirección de escena, mismo contrato que el módulo social. `lugar` viaja como
  // `escena` (1er arg) y personaje/lugar/accion como SceneDirection: así se activa
  // hasDirection() y buildPrompt arma "Subject: … Action: … Setting: …".
  personaje: z.string().min(1).max(300),
  lugar:     z.string().min(1).max(300),
  accion:    z.string().min(1).max(300),
  nicho:     z.string().min(1).max(80).default('pyme venezolana'),
})

/**
 * Imagen destacada del blog por IA. Reusa el motor de difusión del módulo social
 * (NVIDIA FLUX.1-dev) pero NO su storage: el social sube a Cloudinary, el blog
 * guarda local en public/uploads/blog/ vía saveBlogImage().
 *
 * Nota de contrato: generateBackground(escena, nicho, aspect, direction) arma el
 * prompt internamente. Con `direction` toma la rama dirigida (hasDirection() en
 * lib/social/image.ts:43) que compone "Subject: … Action: … Setting: …" — la
 * misma que usan los presets de social. Sin ella caía al camino degradado y
 * producía fotos genéricas de archivo. Se pide en 1:1 porque su lista de tamaños
 * admitidos no tiene formato horizontal; saveBlogImage recorta a 1200x630 (cover).
 */
export async function POST(req: NextRequest) {
  try {
    await uploadLimiter.consume(getClientIp(req))
  } catch {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
  }

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  try {
    const { personaje, lugar, accion, nicho } = bodySchema.parse(await req.json())

    // Gemini (dirección de arte) como motor principal, mismo que Social; NVIDIA
    // FLUX como fallback si Gemini falla — el blog nunca queda sin imagen. Sin
    // preset forzado → automático (pickPreset), igual que Social.
    let background: Buffer
    try {
      background = await generateBackgroundGemini({ escena: lugar, nicho, aspect: '1:1', direction: { personaje, lugar, accion } })
    } catch (err) {
      console.error('Gemini imagen falló, fallback a NVIDIA:', err)
      background = await generateBackground(lugar, nicho, '1:1', { personaje, lugar, accion })
    }
    const url = await saveBlogImage(background)

    return NextResponse.json({ ok: true, url }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    // ProviderError trae el status real del proveedor (422 prompt rechazado,
    // 500 API key ausente) — se propaga en vez de aplanarlo todo a 500.
    if (err instanceof ProviderError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('Blog generate-image error:', err)
    return NextResponse.json({ error: 'No se pudo generar la imagen' }, { status: 500 })
  }
}
