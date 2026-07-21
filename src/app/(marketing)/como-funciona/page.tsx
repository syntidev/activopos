import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Workflow, ScanBarcode, Layers, Scale, Ruler, Wallet, CalendarClock, ShieldCheck, FileText,
  Globe, QrCode, MessageCircle, Columns3, Palette, Images,
  Upload, PackagePlus, ClipboardList, History, Shuffle, Warehouse,
  ChartColumn, Target, CalendarRange, Banknote, FileSpreadsheet, Bell,
  LayoutPanelLeft, ListChecks, FileBadge2, RefreshCw,
  Users, EyeOff, KeyRound,
  DollarSign, CheckCircle2, Sparkles, UserPlus,
  type LucideIcon,
} from 'lucide-react'
import MarketingHero from '@/components/marketing/MarketingHero'
import RevealSection from '@/components/marketing/shared/RevealSection'
import styles from './como-funciona.module.css'

export const metadata: Metadata = {
  title: 'Cómo funciona',
  description:
    'Todo lo que necesita tu negocio en un solo sistema: POS, catálogo digital, inventario, finanzas, cotizaciones y más. 225 funciones reales, diseñadas para Venezuela.',
  alternates: {
    canonical: 'https://activopos.com/como-funciona',
  },
  openGraph: {
    title: 'Cómo funciona ActivoPOS',
    description: 'Desde el primer producto hasta el cierre de caja — ActivoPOS cubre cada paso del día de tu negocio.',
    url: 'https://activopos.com/como-funciona',
  },
}

/* ── Feature grid — bloque reusado por las 8 secciones ── */

interface FeatureItem {
  Icon: LucideIcon
  text: string
}

function FeatureGrid({ items }: { items: FeatureItem[] }) {
  return (
    <div className={styles.grid}>
      {items.map((item, i) => (
        <div key={i} className={styles.item}>
          <item.Icon size={20} className={styles.itemIcon} aria-hidden="true" />
          <p className={styles.itemText}>{item.text}</p>
        </div>
      ))}
    </div>
  )
}

interface FeatureSectionProps {
  title: string
  items: FeatureItem[]
  alt?: boolean
}

function FeatureSection({ title, items, alt }: FeatureSectionProps) {
  return (
    <section className={`${styles.section} ${alt ? styles.sectionAlt : ''}`}>
      <div className={styles.container}>
        <RevealSection>
          <h2 className={styles.sectionTitle}>{title}</h2>
          <FeatureGrid items={items} />
        </RevealSection>
      </div>
    </section>
  )
}

/* ── Contenido por sección ── */

const POS_ITEMS: FeatureItem[] = [
  { Icon: ScanBarcode,   text: 'Escáner triple: cámara del celular, manual o pistola USB — sin comprar hardware' },
  { Icon: Layers,        text: 'Multi-ticket: hasta 5 ventas abiertas en paralelo sin perder ninguna' },
  { Icon: Scale,         text: 'Venta por peso en kg: ideal para carnicería, charcutería y víveres' },
  { Icon: Ruler,         text: 'Variantes: talla + color, sabor + tamaño — generadas automáticamente' },
  { Icon: Wallet,        text: 'Pago mixto: Pago Móvil + Zelle + efectivo en una sola venta' },
  { Icon: CalendarClock, text: 'Venta a crédito con plazos 7/14/21/30 días' },
  { Icon: ShieldCheck,   text: 'Descuento y override de precio con PIN del administrador' },
  { Icon: FileText,      text: 'Cotización desde el POS → PDF → convertir a venta con un clic' },
]

const CATALOGO_ITEMS: FeatureItem[] = [
  { Icon: Globe,         text: 'URL pública única: activopos.com/catalogo/tu-negocio' },
  { Icon: QrCode,        text: 'Código QR descargable para compartir donde quieras' },
  { Icon: MessageCircle, text: 'Pedidos por WhatsApp automático — el cliente arma el pedido, te llega listo' },
  { Icon: Columns3,      text: 'Panel Kanban: Recibido → Preparando → Listo → Despachado' },
  { Icon: Palette,       text: '10 temas visuales curados por segmento de negocio' },
  { Icon: Images,        text: 'Portada personalizable con 3 banners' },
]

const INVENTARIO_ITEMS: FeatureItem[] = [
  { Icon: Upload,        text: 'Importación masiva desde Excel — sube 1000 productos en minutos' },
  { Icon: PackagePlus,   text: 'Entradas de stock con proveedor y costo real' },
  { Icon: ClipboardList, text: 'Consumo interno con nota (control de merma)' },
  { Icon: History,       text: 'Historial completo de movimientos con exportación a Excel' },
  { Icon: Shuffle,       text: 'Variantes con generador automático de combinaciones' },
  { Icon: Warehouse,     text: 'Precio mayorista automático por tipo de cliente' },
]

const FINANZAS_ITEMS: FeatureItem[] = [
  { Icon: ChartColumn,     text: 'Estado de resultados visual con barras proporcionales' },
  { Icon: Target,          text: 'Punto de equilibrio con proyección de fin de mes' },
  { Icon: CalendarRange,   text: 'P&L por período seleccionable' },
  { Icon: Banknote,        text: 'Cuentas por cobrar y por pagar en un solo lugar' },
  { Icon: FileSpreadsheet, text: 'Reporte del día con exportación Excel y PDF' },
  { Icon: Bell,            text: 'Reporte mensual automático con aviso en el dashboard' },
]

const COTIZACIONES_ITEMS: FeatureItem[] = [
  { Icon: LayoutPanelLeft, text: 'Editor de dos paneles igual que el POS' },
  { Icon: ListChecks,      text: 'Estados: Borrador → Enviada → Aceptada → Cobrada' },
  { Icon: FileBadge2,      text: 'PDF profesional con logo y datos del negocio' },
  { Icon: MessageCircle,   text: 'Enviar por WhatsApp con un clic' },
  { Icon: RefreshCw,       text: 'Convertir a venta: abre el POS con los ítems precargados' },
]

const EQUIPO_ITEMS: FeatureItem[] = [
  { Icon: Users,    text: 'Roles: Administrador y Cajero con permisos granulares' },
  { Icon: EyeOff,   text: 'El cajero no ve costos ni ganancias — solo lo que necesita para vender' },
  { Icon: KeyRound, text: 'PIN para descuentos, anulaciones y ajustes de precio' },
  { Icon: History,  text: 'Historial de quién hizo cada venta y en qué turno' },
]

const PAGOS_ITEMS: FeatureItem[] = [
  { Icon: Wallet,       text: 'Pago Móvil, Zelle, Binance/USDT, Zinli, Efectivo USD y Bs' },
  { Icon: RefreshCw,    text: 'Tasa BCV automática — se congela en cada venta' },
  { Icon: DollarSign,   text: 'Precio en USD y Bs simultáneamente, siempre' },
  { Icon: CheckCircle2, text: 'Sin toggle, sin conversión manual' },
]

export default function ComoFuncionaPage() {
  return (
    <>
      <MarketingHero icon={Workflow} maxWidth={800} className={styles.hero}>
        <p className={styles.eyebrow}>Cómo funciona</p>
        <h1 className={styles.title}>Todo lo que necesita tu negocio, en un solo lugar.</h1>
        <p className={styles.subtitle}>
          Desde el primer producto hasta el cierre de caja — ActivoPOS cubre cada paso del día de tu negocio.
        </p>
        <Link href="/registro" className={styles.heroCta}>
          <UserPlus size={18} aria-hidden="true" />
          Empezar gratis →
        </Link>
      </MarketingHero>

      <FeatureSection title="Cobra en segundos. Sin complicaciones." items={POS_ITEMS} />
      <FeatureSection title="Tu vitrina abierta 24/7, sin app que descargar." items={CATALOGO_ITEMS} alt />
      <FeatureSection title="Tu stock siempre al día, sin contar a mano." items={INVENTARIO_ITEMS} />
      <FeatureSection title="Sabe exactamente cuánto ganaste hoy." items={FINANZAS_ITEMS} alt />
      <FeatureSection title="Presupuesta, convence y cobra — sin salir del sistema." items={COTIZACIONES_ITEMS} />

      <section className={styles.tuDiaSection}>
        <div className={styles.container}>
          <RevealSection>
            <span className={styles.tuDiaBadge}>
              <Sparkles size={13} aria-hidden="true" />
              Solo en ActivoPOS
            </span>
            <h2 className={styles.tuDiaTitle}>Cada mañana, tu negocio te habla.</h2>
            <p className={styles.tuDiaSubtitle}>
              Una narrativa generada por IA con tus datos reales: ventas del día, producto estrella,
              cobros pendientes. Ningún competidor venezolano tiene esto.
            </p>
          </RevealSection>
        </div>
      </section>

      <FeatureSection title="Tú decides quién ve qué." items={EQUIPO_ITEMS} alt />
      <FeatureSection title="Como ya te pagan tus clientes." items={PAGOS_ITEMS} />

      <section className={styles.ctaFinal}>
        <div className={styles.container}>
          <RevealSection>
            <h2 className={styles.ctaFinalTitle}>¿Listo para ordenar tu negocio?</h2>
            <Link href="/registro" className={styles.ctaFinalBtn}>
              <UserPlus size={18} aria-hidden="true" />
              Crear cuenta gratis →
            </Link>
            <p className={styles.ctaFinalNote}>Sin tarjeta de crédito. Sin contratos.</p>
          </RevealSection>
        </div>
      </section>
    </>
  )
}
