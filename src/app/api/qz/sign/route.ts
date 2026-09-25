import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { qzSignLimiter } from '@/lib/rate-limit'
import { getQzCredentials, signQzMessage } from '@/lib/qz-signing'

const BodySchema = z.object({
  // QZ manda la llamada serializada (JSON corto). Tope generoso pero acotado.
  message: z.string().min(1).max(20_000),
})

// Firma un mensaje de QZ Tray con la clave privada del servidor. Cualquier rol
// con sesión: el cajero imprime desde el POS. La firma solo sirve frente a un
// QZ Tray que confíe en QZ_CERTIFICATE y que corra en la máquina de quien
// pregunta, así que el riesgo se acota con sesión + límite por usuario.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  try {
    await qzSignLimiter.consume(String(session.userId))
  } catch {
    return NextResponse.json({ error: 'Demasiadas solicitudes de firma' }, { status: 429 })
  }

  const credentials = getQzCredentials()
  if (!credentials) return NextResponse.json({ error: 'Firma de QZ Tray no configurada' }, { status: 404 })

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Mensaje inválido' }, { status: 400 })

  let signature: string
  try {
    signature = signQzMessage(parsed.data.message, credentials.privateKey)
  } catch (err) {
    // Clave mal formada en el entorno: se registra para el operador, sin filtrar detalle al cliente.
    console.error('[qz] no se pudo firmar: revisa QZ_PRIVATE_KEY (PKCS#8 RSA, PEM)', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error al firmar' }, { status: 500 })
  }

  return new Response(signature, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
