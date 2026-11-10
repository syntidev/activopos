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
  Ticket,
  Truck,
  Wallet,
  UtensilsCrossed,
  ChevronLeft,
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
import { TabCobroPrecios }    from './tabs/TabCobroPrecios'
import { TabPlan }            from './tabs/TabPlan'
import { TabLanding }         from './tabs/TabLanding'
import { TabColecciones }     from './tabs/TabColecciones'
import { TabBrands }          from './tabs/TabBrands'
import { TabKit200k }         from './tabs/TabKit200k'
import { TabEnvios }          from './tabs/TabEnvios'
import { TabCarta }           from './tabs/TabCarta'

type TabKey = 'cobroprecios' | 'envios' | 'carta' | 'general' | 'empresa' | 'impresion' | 'cobros' | 'tema' | 'landing' | 'colecciones' | 'marcas' | 'kit200k' | 'usuarios' | 'modulos' | 'notificaciones' | 'plan'

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
  { key: 'cobroprecios', label: 'Cobro y precios', Icon: Wallet  },
  { key: 'envios',    label: 'Envíos',          Icon: Truck      },
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
  /** Kit 200K: mismo flag por negocio que /kit-200k (reservas_enabled). */
  kitEnabled: boolean
  /** catalog_template = 'carta': se ocultan las pestañas que no aplican y aparece "Carta". */
  isCarta: boolean
}

const KIT_TAB: Tab = { key: 'kit200k', label: 'Kit 200K', Icon: Ticket }

// Negocio con plantilla Carta: su vitrina se configura en UNA pestaña "Carta"; no aplican Tema/Landing/Colecciones/Marcas (premium) ni Envíos por encomienda.
const CARTA_TAB: Tab = { key: 'carta', label: 'Carta', Icon: UtensilsCrossed }

export function ConfiguracionView({ session, landingSectionsEnabled, kitEnabled, isCarta }: ConfiguracionViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('general')
  // Móvil: 'menu' = lista de grupos; 'tab' = contenido de la opción elegida (con "Volver"). En escritorio se ven ambos y esto no aplica.
  const [vista, setVista] = useState<'menu' | 'tab'>('menu')
  const elegir = (key: TabKey): void => { setActiveTab(key); setVista('tab') }

  // Gate de plan resuelto server-side (page.tsx) — sin el flag, el grupo
  // completo de Catálogo Público ni aparece en el sidebar (no solo se
  // bloquea al guardar). Tema Visual queda fuera del gate (siempre visible).
  const planTabs     = isCarta ? [CARTA_TAB] : landingSectionsEnabled ? CATALOGO_TABS : CATALOGO_TABS.slice(0, 1)
  const catalogoTabs = kitEnabled ? [...planTabs, KIT_TAB] : planTabs
  const negocioTabs  = isCarta ? NEGOCIO_TABS.filter(t => t.key !== 'envios') : NEGOCIO_TABS

  const GROUPS: { label: string; tabs: Tab[] }[] = [
    { label: 'Negocio',         tabs: negocioTabs },
    { label: 'Catálogo Público', tabs: catalogoTabs },
    { label: 'Sistema',         tabs: SISTEMA_TABS },
  ]

  return (
    <div className={styles.configLayout} data-vista={vista}>
      <aside className={styles.configSidebar} aria-label="Secciones de Configuración">
        <span className={styles.configSidebarTitle}>Configuración</span>

        {GROUPS.map(group => (
          <div key={group.label} className={styles.configGroup}>
            <span className={styles.configGroupLabel}>{group.label}</span>
            {group.tabs.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                data-tab={key}
                aria-current={activeTab === key ? 'page' : undefined}
                className={`${styles.configTab} ${activeTab === key ? styles.configTabActive : ''}`}
                onClick={() => elegir(key)}
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
            data-tab={key}
            aria-current={activeTab === key ? 'page' : undefined}
            className={`${styles.configTab} ${activeTab === key ? styles.configTabActive : ''}`}
            onClick={() => elegir(key)}
          >
            <Icon size={16} strokeWidth={2} aria-hidden="true" />
            {label}
          </button>
        ))}
      </aside>

      <main className={styles.configContent}>
        <button type="button" className={styles.configVolver} onClick={() => setVista('menu')} data-testid="config-volver">
          <ChevronLeft size={20} aria-hidden="true" />Volver a Configuración
        </button>
        {activeTab === 'general'        && <TabGeneral        businessId={session.businessId} />}
        {activeTab === 'empresa'        && <TabEmpresa        businessId={session.businessId} />}
        {activeTab === 'impresion'      && <TabImpresion      businessId={session.businessId} />}
        {activeTab === 'cobros'         && <TabCobros         businessId={session.businessId} />}
        {activeTab === 'cobroprecios'   && <TabCobroPrecios   businessId={session.businessId} />}
        {activeTab === 'envios'         && <TabEnvios         businessId={session.businessId} />}
        {activeTab === 'carta'          && isCarta && <TabCarta />}
        {activeTab === 'tema'           && !isCarta && <TabTema          businessId={session.businessId} />}
        {activeTab === 'landing'     && landingSectionsEnabled && <TabLanding     businessId={session.businessId} />}
        {activeTab === 'colecciones' && landingSectionsEnabled && <TabColecciones businessId={session.businessId} />}
        {activeTab === 'marcas'      && landingSectionsEnabled && <TabBrands      businessId={session.businessId} />}
        {activeTab === 'kit200k'     && kitEnabled             && <TabKit200k     businessId={session.businessId} />}
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
