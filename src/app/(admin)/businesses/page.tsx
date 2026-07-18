import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { SuspendToggle, ImpersonateButton, BusinessFilters } from '../TenantActions'
import styles from '../admin.module.css'
import pageStyles from './businesses.module.css'

const PAGE_SIZE = 25

async function getBusinesses(q: string, plan: string, page: number) {
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const where = {
    ...(q ? { name: { contains: q } } : {}),
    ...(plan ? { catalog_plan: plan } : {}),
  }

  try {
    const [businesses, salesCounts, total] = await Promise.all([
      prisma.business.findMany({
        where,
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
        skip:    (page - 1) * PAGE_SIZE,
        take:    PAGE_SIZE,
      }),
      prisma.sale.groupBy({
        by:     ['business_id'],
        where:  { status: 'paid', sold_at: { gte: monthStart } },
        _count: { _all: true },
      }),
      prisma.business.count({ where }),
    ])

    const salesMap = new Map(salesCounts.map(s => [s.business_id, s._count._all]))

    return {
      businesses: businesses.map(b => ({
        id:             b.id,
        name:           b.name,
        adminEmail:     b.users[0]?.email ?? null,
        plan:           b.catalog_plan ?? 'trial',
        active:         b.active,
        createdAt:      b.created_at,
        productCount:   b._count.products,
        salesThisMonth: salesMap.get(b.id) ?? 0,
      })),
      total,
    }
  } catch {
    return { businesses: [], total: 0 }
  }
}

type Tenant = Awaited<ReturnType<typeof getBusinesses>>['businesses'][number]

function planBadge(plan: string) {
  const cls = plan === 'negocio_activo' ? styles.badgeActive : styles.badgeTrial
  return <span className={`${styles.badge} ${cls}`}>{plan}</span>
}

function statusBadge(t: Tenant) {
  if (!t.active) return <span className={`${styles.badge} ${styles.badgeInactive}`}>Suspendido</span>
  const daysSince = (Date.now() - new Date(t.createdAt).getTime()) / 86_400_000
  if (daysSince <= 14) return <span className={`${styles.badge} ${styles.badgeTrial}`}>Trial</span>
  return <span className={`${styles.badge} ${styles.badgeActive}`}>Activo</span>
}

interface PageProps {
  searchParams: { q?: string; plan?: string; page?: string }
}

export default async function BusinessesPage({ searchParams }: PageProps) {
  const q    = searchParams.q?.trim() ?? ''
  const plan = searchParams.plan ?? ''
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)

  const { businesses, total } = await getBusinesses(q, plan, page)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function pageHref(p: number) {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (plan) params.set('plan', plan)
    params.set('page', String(p))
    return `/businesses?${params.toString()}`
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Negocios</h1>
        <p className={styles.pageSubtitle}>
          {total} tenant{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
        </p>
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.tableHeader}>
          <p className={styles.tableTitle}>Todos los negocios</p>
          <BusinessFilters />
        </div>

        {businesses.length === 0 ? (
          <div className={styles.emptyState}>
            {q || plan ? 'Sin resultados para este filtro.' : 'Sin negocios registrados.'}
          </div>
        ) : (
          <table className={`${styles.table} ${pageStyles.table}`}>
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
                    <ImpersonateButton tenantId={b.id} tenantName={b.name} />
                  </td>
                  <td>
                    <SuspendToggle tenantId={b.id} active={b.active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className={styles.pagination}>
            {page > 1
              ? <Link href={pageHref(page - 1)} className={styles.pageLink}>← Anterior</Link>
              : <span className={`${styles.pageLink} ${styles.pageLinkDisabled}`}>← Anterior</span>}
            <span className={styles.pageInfo}>Página {page} de {totalPages}</span>
            {page < totalPages
              ? <Link href={pageHref(page + 1)} className={styles.pageLink}>Siguiente →</Link>
              : <span className={`${styles.pageLink} ${styles.pageLinkDisabled}`}>Siguiente →</span>}
          </div>
        )}
      </div>
    </div>
  )
}
