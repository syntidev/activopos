import { Monitor, ShoppingBag, Activity, Check } from 'lucide-react'
import styles from './EcosystemSection.module.css'

const COLS = [
  {
    layer: 'Capa 1 · Núcleo',
    layerIcon: Monitor,
    icon: Monitor,
    title: 'ActivoPOS',
    promise: 'Domina tu mostrador',
    desc: 'POS completo con caja, inventario, variantes por especificación, clientes, cotizaciones, devoluciones y cierre del día. Deja de operar a ciegas.',
    feats: [
      'POS táctil en cualquier pantalla',
      'BCV + paralelo + USDT automático',
      'Variantes: talla, peso, medida, tiempo, color',
      'Pago Móvil, Zelle, Efectivo, USDT',
      'Módulo Fábrica: combos y productos con receta',
      'Cotizaciones y devoluciones integradas',
    ],
    variant: 'brand',
    featured: false,
    extra: null,
  },
  {
    layer: 'Capa 2 · Digital',
    layerIcon: ShoppingBag,
    icon: ShoppingBag,
    title: 'Catálogo Activo',
    promise: 'Tu mostrador abierto 24/7',
    desc: 'Vitrina web conectada al inventario del POS en tiempo real. Pedidos por WhatsApp, con delivery, sin mover un dedo. Tu código QR propio para compartir donde quieras.',
    feats: [
      'tutienda.activopos.com',
      'Inventario sincronizado automáticamente',
      'Pedidos directo al WhatsApp del negocio',
      'Delivery con zonas y precios configurables',
      'QR propio para imprimir, compartir o publicar',
      'Pedidos kanban: recibido → listo → despachado',
    ],
    variant: 'success',
    featured: true,
    extra: null,
  },
  {
    layer: 'Capa 3 · Inteligencia',
    layerIcon: Activity,
    icon: Activity,
    title: 'Pulso del Negocio',
    promise: 'Lo que tu catálogo ve, tú lo sabes',
    desc: 'Tu QR rastrea cada escaneo. Tu catálogo registra cada clic. Sabes qué producto está caliente antes de que se agote y qué casi compraron pero no cerraron.',
    feats: [
      'Escaneos de QR por día y por fuente',
      'Productos más vistos vs más vendidos',
      'Intención de compra sin conversión',
      'Único en Venezuela',
    ],
    variant: 'purple',
    featured: false,
    extra: { url: 'tucafe.activopos.com', scans: '247', orders: '18', conv: '73%' },
  },
] as const

export default function EcosystemSection() {
  return (
    <section className={styles.section} id="ecosystem">
      <div className={styles.container}>
        <h2 className={styles.title} data-reveal>
          No compras software.<br />Compras una progresión.
        </h2>
        <p className={styles.subtitle} data-reveal>
          Empiezas con el mostrador. Cuando estés listo, abres el catálogo digital.
          Cuando quieras crecer, activas el pulso del negocio.
        </p>

        <div className={styles.grid} data-reveal>
          {COLS.map(({ layer, layerIcon: LayerIcon, icon: Icon, title, promise, desc, feats, variant, featured, extra }) => (
            <div
              key={title}
              className={`${styles.col} ${styles[`col_${variant}`]} ${featured ? styles.colFeatured : ''}`}
            >
              <div className={`${styles.layer} ${styles[`layer_${variant}`]}`}>
                <LayerIcon size={11} aria-hidden />
                {layer}
              </div>
              <div className={`${styles.iconWrap} ${styles[`iconWrap_${variant}`]}`}>
                <Icon size={22} aria-hidden />
              </div>
              <div className={styles.colTitle}>{title}</div>
              <div className={styles.promise}>{promise}</div>
              <p className={styles.desc}>{desc}</p>
              <ul className={styles.feats}>
                {feats.map((f) => (
                  <li key={f}>
                    <Check size={12} aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              {extra && (
                <div className={styles.qrDemo}>
                  <div className={styles.qrUrl}>{extra.url}</div>
                  <div className={styles.qrStats}>
                    <div className={styles.qrStat}><span>{extra.scans}</span>Escaneos hoy</div>
                    <div className={styles.qrStat}><span>{extra.orders}</span>Pedidos</div>
                    <div className={styles.qrStat}><span>{extra.conv}</span>Conversión</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
