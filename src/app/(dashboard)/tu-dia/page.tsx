import { redirect } from 'next/navigation'
import { Sun, Moon } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import styles from './tu-dia.module.css'

// ── Helpers ──────────────────────────────────────────────────────

const DAYS_ES   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function formatDate(d: Date): string {
  return `${DAYS_ES[d.getDay()]}, ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} · ${d.getFullYear()}`
}

function fmtUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Data fetching ─────────────────────────────────────────────────

type TopRow = { name: string; qty: string }

async function getTuDiaData(businessId: number) {
  const now         = new Date()
  const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow    = new Date(todayStart.getTime() + 86_400_000)
  const yesterday   = new Date(todayStart.getTime() - 86_400_000)
  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1)
  const bid         = businessId

  const [salesHoy, salesAyer, topRows, cxcAgg, cxcVenceRows, productCount] = await Promise.all([
    // Ventas de hoy (cantidad + monto)
    prisma.sale.aggregate({
      where: { business_id: bid, status: 'paid', sold_at: { gte: todayStart, lt: tomorrow } },
      _sum:   { total_usd: true },
      _count: { id: true },
    }),
    // Ventas de ayer (para calcular tendencia)
    prisma.sale.aggregate({
      where: { business_id: bid, status: 'paid', sold_at: { gte: yesterday, lt: todayStart } },
      _sum:  { total_usd: true },
    }),
    // Producto más vendido este mes (por unidades)
    prisma.$queryRaw<TopRow[]>`
      SELECT p.name, SUM(si.quantity) AS qty
      FROM   sale_items si
      JOIN   sales s    ON s.id  = si.sale_id
      JOIN   products p ON p.id  = si.product_id
      WHERE  s.business_id = ${bid}
        AND  s.status = 'paid'
        AND  s.sold_at >= ${monthStart}
      GROUP  BY si.product_id, p.name
      ORDER  BY qty DESC
      LIMIT  1
    `,
    // CxC total pendiente
    prisma.sale.aggregate({
      where:  { business_id: bid, status: 'credit' },
      _sum:   { total_usd: true },
      _count: { id: true },
    }),
    // CxC que vence mañana: due_date real. Si due_date es null (ventas legacy)
    // pero hay credit_days, cae a created_at + credit_days. Sin due_date NI
    // credit_days no hay forma de saber cuándo vence — se excluye en vez de
    // asumir un default (eso reintroduciría la misma heurística por otra puerta).
    prisma.$queryRaw<{ total_usd: string | null }[]>`
      SELECT SUM(total_usd) AS total_usd
      FROM   sales
      WHERE  business_id = ${bid}
        AND  status = 'credit'
        AND  (
          (due_date IS NOT NULL AND due_date >= ${tomorrow} AND due_date < ${new Date(tomorrow.getTime() + 86_400_000)})
          OR
          (due_date IS NULL AND credit_days IS NOT NULL
            AND DATE_ADD(created_at, INTERVAL credit_days DAY) >= ${tomorrow}
            AND DATE_ADD(created_at, INTERVAL credit_days DAY) <  ${new Date(tomorrow.getTime() + 86_400_000)})
        )
    `,
    // Productos activos (para el estado sin ventas)
    prisma.product.count({
      where: { business_id: bid, active: true },
    }),
  ])

  const salesCount  = salesHoy._count.id
  const totalUsd    = Number(salesHoy._sum.total_usd  ?? 0)
  const ayerUsd     = Number(salesAyer._sum.total_usd ?? 0)
  const trend       = ayerUsd > 0 ? ((totalUsd - ayerUsd) / ayerUsd) * 100 : 0
  const topProduct  = topRows[0]?.name ?? null
  const cxcUsd      = Number(cxcAgg._sum.total_usd ?? 0)
  const cxcVenceUsd = parseFloat(String(cxcVenceRows[0]?.total_usd ?? '0')) || 0

  return {
    now,
    salesCount,
    totalUsd,
    trend,
    topProduct,
    cxcUsd,
    cxcVenceUsd,
    productCount,
  }
}

// ── Narrativa ─────────────────────────────────────────────────────

type ParaStyle = 'main' | 'secondary' | 'warning' | 'closing'

interface Paragraph {
  text:  string
  style: ParaStyle
}

function buildNarrative(data: Awaited<ReturnType<typeof getTuDiaData>>): Paragraph[] {
  const { salesCount, totalUsd, trend, topProduct, cxcUsd, cxcVenceUsd, productCount } = data

  if (salesCount === 0) {
    return [
      { text: 'Hoy fue un día de preparación.', style: 'main' },
      {
        text:  `Tu inventario tiene ${productCount} producto${productCount !== 1 ? 's' : ''} listo${productCount !== 1 ? 's' : ''}.`,
        style: 'secondary',
      },
      { text: 'Mañana es un nuevo día.', style: 'secondary' },
    ]
  }

  const ps: Paragraph[] = []

  // Cuántos clientes
  ps.push({
    text:  `Hoy atendiste ${salesCount} ${salesCount === 1 ? 'cliente' : 'clientes'}.`,
    style: 'main',
  })

  // Monto + evaluación
  const assessment =
    trend > 25  ? 'mejor día de la semana'
    : trend > 5  ? 'por encima del promedio'
    : trend < -15 ? 'día más tranquilo que ayer'
    : 'día normal'

  ps.push({
    text:  `Vendiste ${fmtUsd(totalUsd)} — ${assessment}.`,
    style: 'main',
  })

  // Producto estrella
  if (topProduct) {
    ps.push({
      text:  `Tu producto estrella fue ${topProduct}.`,
      style: 'secondary',
    })
  }

  // CxC pendiente total
  if (cxcUsd > 0) {
    ps.push({
      text:  `Tienes ${fmtUsd(cxcUsd)} pendientes por cobrar.`,
      style: 'secondary',
    })
  }

  // Vencimiento próximo
  if (cxcVenceUsd > 0) {
    ps.push({
      text:  `Mañana vence un compromiso por ${fmtUsd(cxcVenceUsd)}.`,
      style: 'warning',
    })
  }

  // Cierre
  ps.push({ text: 'Cerraste bien.', style: 'closing' })

  return ps
}

// ── Page ─────────────────────────────────────────────────────────

export default async function TuDiaPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const data  = await getTuDiaData(session.businessId)
  const paras = buildNarrative(data)

  const isNight       = data.now.getHours() >= 18
  const TimeIcon      = isNight ? Moon : Sun
  const iconWrapClass = isNight
    ? `${styles.iconWrapper} ${styles.iconWrapperNight}`
    : styles.iconWrapper

  // Separa el closing del resto (siempre el último si hay ventas)
  const mainParas  = paras.filter(p => p.style !== 'closing')
  const closingPar = paras.find(p => p.style === 'closing')

  return (
    <div className={`${styles.page} page-container`}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={iconWrapClass} aria-hidden="true">
          <TimeIcon size={24} strokeWidth={1.75} />
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.headerTitle}>Tu Día</span>
          <time
            dateTime={data.now.toISOString().split('T')[0]}
            className={styles.headerDate}
          >
            {formatDate(data.now)}
          </time>
        </div>
      </div>

      <div className={styles.divider} />

      {/* ── Narrativa ────────────────────────────────────────── */}
      <div className={styles.narrative}>
        {mainParas.map((p, i) => {
          if (p.style === 'main') {
            return (
              <p key={i} className={styles.paraMain}>
                {p.text}
              </p>
            )
          }
          if (p.style === 'warning') {
            return (
              <p key={i} className={styles.paraWarning}>
                {p.text}
              </p>
            )
          }
          return (
            <p key={i} className={styles.paraSecondary}>
              {p.text}
            </p>
          )
        })}
      </div>

      {/* ── Cierre ───────────────────────────────────────────── */}
      {closingPar && (
        <>
          <div className={styles.divider} />
          <div className={styles.closingWrapper}>
            <p className={styles.closingText}>{closingPar.text}</p>
          </div>
        </>
      )}
    </div>
  )
}
