import { getSession } from '@/lib/auth'
import { getClientsWithBalance } from '@/lib/clients'
import { ClientesView } from '@/components/clients/ClientesView'
import { HelpButton } from '@/components/help/HelpButton'
import styles from './clientes.module.css'

export const metadata = { title: 'Clientes — ActivoPOS' }

export default async function ClientesPage() {
  const session = await getSession()
  const clients = await getClientsWithBalance(session?.businessId ?? 0)

  return (
    <div className={`${styles.page} page-container`}>
      <ClientesView initialClients={clients} />
      <HelpButton module="clientes" />
    </div>
  )
}
