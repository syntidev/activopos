import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

// Columnas idénticas a TempSocialia/Referencia_Socialis/calendario-template.xlsx
// (producto = segmento, buffer_id = buffer_post_id — mismo nombre visible que
// la referencia, mapeado a nuestros campos reales al importar/exportar).
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const headers = ['dia', 'tipo', 'producto', 'objetivo', 'titulo', 'subtitulo', 'caption', 'hashtags', 'estado', 'buffer_id', 'slides']

  const examples = [
    ['2026-08-01', 'POST', 'MAIN', 'DAR_A_CONOCER', '¿Tu negocio existe en internet?', 'El 95% de negocios venezolanos no tiene presencia digital', 'Escribe aquí el copy completo del post...', '#activopos #negociosvenezuela', 'pendiente', '', ''],
    ['2026-08-03', 'CARRUSEL', 'FOOD', 'ENSEÑAR', '5 razones para tener menú digital', 'Tus clientes piden desde el teléfono', 'Escribe aquí el copy completo del post...', '#activopos #menudigital', 'pendiente', '', 5],
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples])
  ws['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 30 },
    { wch: 30 }, { wch: 40 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 8 },
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
