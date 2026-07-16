import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

// Columnas = campos reales de SocialCalendarEntry (schema.prisma), mismo orden.
// segmento debe ser un slug real de la tabla Segment (ver /api/marketing/segments) --
// no es FK forzada en DB, pero el generador y el resto del sistema esperan slugs reales.
// content_engine: 'diffusion' (post/story de imagen) o 'html_render' (carrusel) --
// libre en Zod (z.string().max(40)), estos son los dos valores reales que usa el sistema.
// "slides" no es un campo del modelo -- ya se mapea a "notas" en el import (import/route.ts),
// así que no hace falta una columna aparte: quien necesite anotar slides lo escribe en notas.
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const headers = ['dia', 'tipo', 'segmento', 'objetivo', 'titulo', 'subtitulo', 'caption', 'hashtags', 'estado', 'content_engine', 'buffer_post_id', 'notas']

  const examples = [
    ['2026-08-01', 'post', 'abastos', 'Que prueben ActivoPOS gratis', '¿Tu negocio existe en internet?', 'El 95% de negocios venezolanos no tiene presencia digital', 'Escribe aquí el copy completo del post...', '#activopos #negociosvenezuela', 'pendiente', 'diffusion', '', ''],
    ['2026-08-03', 'carrusel', 'tiendas-ropa', 'Que prueben ActivoPOS gratis', '5 razones para tener menú digital', 'Tus clientes piden desde el teléfono', 'Escribe aquí el copy completo del post...', '#activopos #menudigital', 'pendiente', 'html_render', '', '4 slides'],
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples])
  ws['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 28 }, { wch: 30 },
    { wch: 30 }, { wch: 40 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 20 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Calendario')

  const raw    = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[]
  const buffer = new Uint8Array(raw)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla_calendario_social.xlsx"',
    },
  })
}
