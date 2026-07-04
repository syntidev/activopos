import packageJson from '../../../../package.json'
import { BcvRateSection } from './BcvRateSection'
import { QaCleanupSection } from './QaCleanupSection'
import adminStyles from '../admin.module.css'
import styles from './settings.module.css'

const SUPPORT_EMAIL    = process.env.SUPPORT_EMAIL ?? 'soporte@activopos.com'
const SUPPORT_WHATSAPP = process.env.SUPPORT_WHATSAPP ?? '584243244788'

export default function AdminSettingsPage() {
  return (
    <div>
      <div className={adminStyles.pageHeader}>
        <h1 className={adminStyles.pageTitle}>Configuración global</h1>
        <p className={adminStyles.pageSubtitle}>Información de la plataforma y herramientas de soporte</p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Información SaaS</h2>
        <p className={styles.sectionSubtitle}>Solo lectura por ahora</p>
        <div className={styles.infoGrid}>
          <div>
            <p className={styles.infoLabel}>Plataforma</p>
            <p className={styles.infoValue}>ActivoPOS</p>
          </div>
          <div>
            <p className={styles.infoLabel}>Email de soporte</p>
            <p className={styles.infoValue}>{SUPPORT_EMAIL}</p>
          </div>
          <div>
            <p className={styles.infoLabel}>WhatsApp de soporte</p>
            <p className={styles.infoValue}>+{SUPPORT_WHATSAPP}</p>
          </div>
          <div>
            <p className={styles.infoLabel}>Versión</p>
            <p className={styles.infoValue}>{packageJson.version}</p>
          </div>
        </div>
      </div>

      <BcvRateSection />
      <QaCleanupSection />
    </div>
  )
}
