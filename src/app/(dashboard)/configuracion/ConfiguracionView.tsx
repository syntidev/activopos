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
  LayoutTemplate,
  Layers,
  Tag,
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
import { TabLanding }         from './tabs/TabLanding'
import { TabColecciones }     from './tabs/TabColecciones'
import { TabBrands }          from './tabs/TabBrands'

type TabKey = 'general' | 'empresa' | 'impresion' | 'cobros' | 'tema' | 'landing' | 'colecciones' | 'marcas' | 'usuarios' | 'modulos' | 'notificaciones' | 'plan'

interface Tab {
  key: TabKey
  label: string
  Icon: React.ElementType
}

const NEGOCIO_TABS: Tab[] = [
  { key: 'general',   label: 'General',         Icon: Settings   },
  { key: 'empresa',   label: 'Empresa',         Icon: Building2  },
  { key: 'impresion', label: 'Impresión',       Icon: Printer    },
  { key: 'cobros',    label: 'Medios de Cobro', Icon: CreditCard },
]

// Todo lo que forma la vitrina pública vive junto: texto+banners (Tema),
// secciones editoriales (Landing), agrupaciones (Colecciones) y ahora Marcas
// -- antes texto/banners/marcas quedaban repartidos en tabs sin relación
// visual entre sí (hallazgo de la auditoría de Configuración).
const CATALOGO_TABS: Tab[] = [
  { key: 'tema',        label: 'Tema Visual', Icon: Palette        },
  { key: 'landing',     label: 'Landing',     Icon: LayoutTemplate },
  { key: 'colecciones', label: 'Colecciones', Icon: Layers         },
  { key: 'marcas',      label: 'Marcas',      Icon: Tag            },
]

const SISTEMA_TABS: Tab[] = [
  { key: 'modulos',        label: 'Módulos',       Icon: Puzzle },
  { key: 'notificaciones', label: 'Notificaciones', Icon: Bell  },
]

const CUENTA_TABS: Tab[] = [
  { key: 'plan',     label: 'Tu Plan',  Icon: Crown },
  { key: 'usuarios', label: 'Usuarios', Icon: Users },
]

interface ConfiguracionViewProps {
  session: SessionUser
  landingSectionsEnabled: boolean
}

export function ConfiguracionView({ session, landingSectionsEnabled }: ConfiguracionViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('general')

  // Gate de plan resuelto server-side (page.tsx) — sin el flag, el grupo
  // completo de Catálogo Público ni aparece en el sidebar (no solo se
  // bloquea al guardar). Tema Visual queda fuera del gate (siempre visible).
  const catalogoTabs = landingSectionsEnabled ? CATALOGO_TABS : CATALOGO_TABS.slice(0, 1)

  const GROUPS: { label: string; tabs: Tab[] }[] = [
    { label: 'Negocio',         tabs: NEGOCIO_TABS },
    { label: 'Catálogo Público', tabs: catalogoTabs },
    { label: 'Sistema',         tabs: SISTEMA_TABS },
  ]

  return (
    <div className={styles.configLayout}>
      <aside className={styles.configSidebar}>
        <span className={styles.configSidebarTitle}>Configuración</span>

        {GROUPS.map(group => (
          <div key={group.label}>
            <span className={styles.configGroupLabel}>{group.label}</span>
            {group.tabs.map(({ key, label, Icon }) => (
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
          </div>
        ))}

        <div className={styles.tabDivider} />
        <span className={styles.configGroupLabel}>Cuenta</span>

        {CUENTA_TABS.map(({ key, label, Icon }) => (
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
        {activeTab === 'landing'     && landingSectionsEnabled && <TabLanding     businessId={session.businessId} />}
        {activeTab === 'colecciones' && landingSectionsEnabled && <TabColecciones businessId={session.businessId} />}
        {activeTab === 'marcas'      && landingSectionsEnabled && <TabBrands      businessId={session.businessId} />}
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
