import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getQzCredentials } from '@/lib/qz-signing'

// Certificado PÚBLICO que QZ Tray usa para verificar las firmas. 404 = firma no
// configurada en este servidor: el cliente sigue en modo sin firma (QZ Tray
// mostrará su aviso de sitio no confiable). Con sesión, para no exponer ni
// siquiera lo público a anónimos.
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const credentials = getQzCredentials()
  if (!credentials) return NextResponse.json({ error: 'Firma de QZ Tray no configurada' }, { status: 404 })

  return new Response(credentials.certificate, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
