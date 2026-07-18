import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { SuspendToggle, PlanSelect, ImpersonateButton } from '../../TenantActions'
import styles from '../../admin.module.css'

async function getTenantDetail(id: number) {
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const business = await prisma.business.findUnique({
    where:  { id },
    select: {
      id:           true,
      name:         true,
      city:         true,
      segment:      true,
      catalog_slug: true,
      catalog_plan: true,
      active:       true,
      created_at:   true,
      _count:       { select: { products: true, users: true, orders: true } },
    },
  })
  if (!business) return null

  const [salesMonth, recentActivity] = await Promise.all([
    prisma.sale.count({ where: { business_id: id, status: 'paid', sold_at: { gte: monthStart } } }),
    prisma.activityLog.findMany({
      where:   { business_id: id },
      orderBy: { created_at: 'desc' },
      take:    15,
      select:  { id: true, action: true, model_type: true, created_at: true, user: { select: { name: true } } },
    }),
  ])

  return { business, salesMonth, recentActivity }
}

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  if (!Number.isInteger(id)) notFound()

  const data = await getTenantDetail(id)
  if (!data) notFound()

  const { business, salesMonth, recentActivity } = data

  return (
    <div>
      <Link href="/businesses" className={styles.backLink}>
        <ArrowLeft size={14} aria-hidden="true" /> Volver a Negocios
      </Link>

      <div className={styles.detailHeaderRow}>
        <div>
          <h1 className={styles.pageTitle}>{business.name}</h1>
          <p className={styles.pageSubtitle}>
            {business.city ?? 'Sin ciudad'} · {business.segment ?? 'Sin segmento'} · /{business.catalog_slug ?? 'sin-slug'}
          </p>
        </div>
        <div className={styles.detailActions}>
          <ImpersonateButton tenantId={business.id} tenantName={business.name} />
          <PlanSelect tenantId={business.id} plan={business.catalog_plan ?? 'gratis'} />
          <SuspendToggle tenantId={business.id} active={business.active} />
        </div>
      </div>

      <div className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Métricas</h2>
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <p className={styles.kpiLabel}>Productos</p>
            <p className={styles.kpiValue}>{business._count.products}</p>
          </div>
          <div className={styles.kpiCard}>
            <p className={styles.kpiLabel}>Ventas este mes</p>
            <p className={`${styles.kpiValue} ${styles.kpiAccent}`}>{salesMonth}</p>
          </div>
          <div className={styles.kpiCard}>
            <p className={styles.kpiLabel}>Pedidos</p>
            <p className={styles.kpiValue}>{business._count.orders}</p>
          </div>
          <div className={styles.kpiCard}>
            <p className={styles.kpiLabel}>Usuarios</p>
            <p className={styles.kpiValue}>{business._count.users}</p>
          </div>
        </div>
      </div>

      <div className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Información del negocio</h2>
        <div className={styles.infoGrid}>
          <div>
            <p className={styles.infoLabel}>Ciudad</p>
            <p className={styles.infoValue}>{business.city ?? '—'}</p>
          </div>
          <div>
            <p className={styles.infoLabel}>Segmento</p>
            <p className={styles.infoValue}>{business.segment ?? '—'}</p>
          </div>
          <div>
            <p className={styles.infoLabel}>Slug del catálogo</p>
            <p className={styles.infoValue}>{business.catalog_slug ?? '—'}</p>
          </div>
          <div>
            <p className={styles.infoLabel}>Registrado</p>
            <p className={styles.infoValue}>
              {new Date(business.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      <div className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Actividad reciente</h2>
        {recentActivity.length === 0 ? (
          <div className={styles.emptyState}>Sin actividad registrada.</div>
        ) : (
          <div className={styles.activityList}>
            {recentActivity.map(a => (
              <div key={a.id} className={styles.activityItem}>
                <span className={styles.activityAction}>
                  {a.user.name} — {a.action}{a.model_type ? ` (${a.model_type})` : ''}
                </span>
                <span className={styles.activityMeta}>
                  {new Date(a.created_at).toLocaleString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
