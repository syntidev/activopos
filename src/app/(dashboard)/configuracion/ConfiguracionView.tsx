'use client'

import { useState } from 'react'
import {
  Settings,
  Building2,
  Printer,
  CreditCard,
  Palette,
  Users,
  Puzzle,
  Bell,
  Crown,
} from 'lucide-react'
import type { SessionUser } from '@/types'
import { HelpButton } from '@/components/help/HelpButton'
import styles from './configuracion.module.css'
import { TabGeneral }         from './tabs/TabGeneral'
import { TabEmpresa }         from './tabs/TabEmpresa'
import { TabImpresion }       from './tabs/TabImpresion'
import { TabTema }            from './tabs/TabTema'
import { TabUsuarios }        from './tabs/TabUsuarios'
import { TabModulos }         from './tabs/TabModulos'
import { TabNotificaciones }  from './tabs/TabNotificaciones'
import { TabCobros }          from './tabs/TabCobros'
import { TabPlan }            from './tabs/TabPlan'

type TabKey = 'general' | 'empresa' | 'impresion' | 'cobros' | 'tema' | 'usuarios' | 'modulos' | 'notificaciones' | 'plan'

interface Tab {
  key: TabKey
  label: string
  Icon: React.ElementType
}

const MAIN_TABS: Tab[] = [
  { key: 'general',        label: 'General',             Icon: Settings   },
  { key: 'empresa',        label: 'Empresa',             Icon: Building2  },
  { key: 'impresion',      label: 'Impresión',           Icon: Printer    },
  { key: 'cobros',         label: 'Medios de Cobro',     Icon: CreditCard },
  { key: 'tema',           label: 'Tema Visual',         Icon: Palette    },
  { key: 'modulos',        label: 'Módulos',             Icon: Puzzle     },
  { key: 'notificaciones', label: 'Notificaciones',      Icon: Bell       },
]

const BOTTOM_TABS: Tab[] = [
  { key: 'plan',     label: 'Tu Plan',  Icon: Crown },
  { key: 'usuarios', label: 'Usuarios', Icon: Users },
]

interface ConfiguracionViewProps {
  session: SessionUser
}

export function ConfiguracionView({ session }: ConfiguracionViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('general')

  return (
    <div className={styles.configLayout}>
      <aside className={styles.configSidebar}>
        <span className={styles.configSidebarTitle}>Configuración</span>

        {MAIN_TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            className={`${styles.configTab} ${activeTab === key ? styles.configTabActive : ''}`}
            onClick={() => setActiveTab(key)}
          >
            <Icon size={16} strokeWidth={2} aria-hidden="true" />
            {label}
          </button>
        ))}

        <div className={styles.tabDivider} />

        {BOTTOM_TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            className={`${styles.configTab} ${activeTab === key ? styles.configTabActive : ''}`}
            onClick={() => setActiveTab(key)}
          >
            <Icon size={16} strokeWidth={2} aria-hidden="true" />
            {label}
          </button>
        ))}
      </aside>

      <main className={styles.configContent}>
        {activeTab === 'general'        && <TabGeneral        businessId={session.businessId} />}
        {activeTab === 'empresa'        && <TabEmpresa        businessId={session.businessId} />}
        {activeTab === 'impresion'      && <TabImpresion      businessId={session.businessId} />}
        {activeTab === 'cobros'         && <TabCobros         businessId={session.businessId} />}
        {activeTab === 'tema'           && <TabTema           businessId={session.businessId} />}
        {activeTab === 'modulos'        && <TabModulos        businessId={session.businessId} />}
        {activeTab === 'notificaciones' && <TabNotificaciones businessId={session.businessId} />}
        {activeTab === 'plan'           && <TabPlan     businessId={session.businessId} />}
        {activeTab === 'usuarios'       && (
          <TabUsuarios
            businessId={session.businessId}
            currentUserId={session.userId}
          />
        )}
      </main>
      <HelpButton module="configuracion" />
    </div>
  )
}
