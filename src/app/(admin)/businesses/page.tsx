import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import styles from '../admin.module.css'

async function getBusinesses() {
  try {
    return await prisma.business.findMany({
      select: {
        id:         true,
        name:       true,
        active:     true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    })
  } catch {
    return []
  }
}

type Business = Awaited<ReturnType<typeof getBusinesses>>[number]

function statusBadge(b: Business) {
  if (!b.active) return <span className={`${styles.badge} ${styles.badgeInactive}`}>Inactivo</span>
  const daysSince = (Date.now() - new Date(b.created_at).getTime()) / 86_400_000
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
                <th>Registro</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {businesses.map(b => (
                <tr key={b.id}>
                  <td className={styles.tdName}>{b.name}</td>
                  <td>{new Date(b.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>{statusBadge(b)}</td>
                  <td>
                    <Link href={`/admin/businesses/${b.id}`} className={styles.actionLink}>
                      Ver →
                    </Link>
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
