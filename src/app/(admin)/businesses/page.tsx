import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { SuspendToggle } from '../TenantActions'
import styles from '../admin.module.css'

async function getBusinesses() {
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  try {
    const [businesses, salesCounts] = await Promise.all([
      prisma.business.findMany({
        select: {
          id:           true,
          name:         true,
          catalog_plan: true,
          active:       true,
          created_at:   true,
          users:        { where: { role: 'admin' }, select: { email: true }, take: 1 },
          _count:       { select: { products: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.sale.groupBy({
        by:     ['business_id'],
        where:  { status: 'paid', sold_at: { gte: monthStart } },
        _count: { _all: true },
      }),
    ])

    const salesMap = new Map(salesCounts.map(s => [s.business_id, s._count._all]))

    return businesses.map(b => ({
      id:             b.id,
      name:           b.name,
      adminEmail:     b.users[0]?.email ?? null,
      plan:           b.catalog_plan ?? 'trial',
      active:         b.active,
      createdAt:      b.created_at,
      productCount:   b._count.products,
      salesThisMonth: salesMap.get(b.id) ?? 0,
    }))
  } catch {
    return []
  }
}

type Tenant = Awaited<ReturnType<typeof getBusinesses>>[number]

function planBadge(plan: string) {
  const cls = plan === 'pro' ? styles.badgeActive : plan === 'starter' ? styles.badgeTrial : styles.badgeInactive
  return <span className={`${styles.badge} ${cls}`}>{plan}</span>
}

function statusBadge(t: Tenant) {
  if (!t.active) return <span className={`${styles.badge} ${styles.badgeInactive}`}>Suspendido</span>
  const daysSince = (Date.now() - new Date(t.createdAt).getTime()) / 86_400_000
  if (daysSince <= 14) return <span className={`${styles.badge} ${styles.badgeTrial}`}>Trial</span>
  return <span className={`${styles.badge} ${styles.badgeActive}`}>Activo</span>
}

export default async function BusinessesPage() {
  const businesses = await getBusinesses()

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Negocios</h1>
        <p className={styles.pageSubtitle}>
          {businesses.length} tenant{businesses.length !== 1 ? 's' : ''} registrado{businesses.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.tableHeader}>
          <p className={styles.tableTitle}>Todos los negocios</p>
        </div>

        {businesses.length === 0 ? (
          <div className={styles.emptyState}>Sin negocios registrados.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Admin</th>
                <th>Plan</th>
                <th>Estado</th>
                <th>Registro</th>
                <th>Productos</th>
                <th>Ventas mes</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {businesses.map(b => (
                <tr key={b.id}>
                  <td className={styles.tdName}>{b.name}</td>
                  <td>{b.adminEmail ?? '—'}</td>
                  <td>{planBadge(b.plan)}</td>
                  <td>{statusBadge(b)}</td>
                  <td>{new Date(b.createdAt).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>{b.productCount}</td>
                  <td>{b.salesThisMonth}</td>
                  <td>
                    <Link href={`/businesses/${b.id}`} className={styles.actionLink}>
                      Ver detalle →
                    </Link>
                  </td>
                  <td>
                    <SuspendToggle tenantId={b.id} active={b.active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
