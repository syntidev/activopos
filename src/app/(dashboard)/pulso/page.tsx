import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Activity, DollarSign, Eye, Filter, Globe, Heart, MessageCircle, MousePointerClick,
  Phone, Radar, Search, ShoppingCart, TrendingUp, Users,
} from 'lucide-react'
import { getSession } from '@/lib/auth'
import { getPulso } from '@/lib/pulso'
import type { PulsoCount, PulsoDias, PulsoVentaOrigen } from '@/types/pulso-panel'
import { Bars, Card, DailyChart, Empty, Kpi, Money, type BarItem } from './blocks'
import styles from './pulso.module.css'

export const dynamic = 'force-dynamic'

const RANGOS: PulsoDias[] = [7, 30]
const DEVICE_LABEL: Record<string, string> = { mobile: 'Celular', tablet: 'Tablet', desktop: 'Computadora', desconocido: 'Sin dato' }

function parseDias(raw: string | string[] | undefined): PulsoDias {
  return raw === '30' ? 30 : 7
}

function fmtDuration(seg: number | null): string {
  if (seg === null) return 'Sin datos'
  const m = Math.floor(seg / 60)
  const s = seg % 60
  return m > 0 ? `${m} min ${s} s` : `${s} s`
}

function fmtPct(a: number, b: number): string {
  return b > 0 ? `${(Math.round((a / b) * 1000) / 10).toLocaleString('es-VE')}%` : '0%'
}

function counts(rows: PulsoCount[], map?: Record<string, string>): BarItem[] {
  return rows.map(r => ({ label: map?.[r.label] ?? r.label, value: r.count }))
}

function VentasList({ rows }: { rows: PulsoVentaOrigen[] }) {
  if (rows.length === 0) return <Empty text="Aún no hay pedidos en este rango" />
  return (
    <ul className={styles.ventaList}>
      {rows.map(r => (
        <li key={r.label} className={styles.ventaRow}>
          <div className={styles.ventaHead}>
            <span className={styles.barLabel}>{r.label}</span>
            <span className={styles.ventaCount}>{r.pedidos} {r.pedidos === 1 ? 'pedido' : 'pedidos'}</span>
          </div>
          <Money usd={r.usd} bs={r.bs} />
        </li>
      ))}
    </ul>
  )
}

export default async function PulsoPage({ searchParams }: { searchParams: { dias?: string | string[] } }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin' && session.role !== 'super_admin') redirect('/escritorio')

  const dias = parseDias(searchParams.dias)
  const d = await getPulso(session.businessId, dias)
  const { trafico, origen, interes, embudo, ventas, contacto } = d
  const rangoTxt = dias === 7 ? '7 días' : '30 días'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Pulso</h1>
          <p className={styles.subtitle}>Lo que pasa en tu catálogo, de la visita a la venta</p>
        </div>
        <nav className={styles.range} aria-label="Rango de fechas">
          {RANGOS.map(r => (
            <Link
              key={r}
              href={`/pulso?dias=${r}`}
              className={r === dias ? `${styles.rangeLink} ${styles.rangeActive}` : styles.rangeLink}
              aria-current={r === dias ? 'page' : undefined}
            >
              {r} días
            </Link>
          ))}
        </nav>
      </header>

      <div className={styles.kpis}>
        <Kpi hero icon={Users} tone="blue" label={`Visitantes · ${rangoTxt}`}>
          <span className={styles.kpiBig}>{trafico.visitantesRango.toLocaleString('es-VE')}</span>
        </Kpi>
        <Kpi icon={ShoppingCart} tone="blue" label="Pedidos">
          <span className={styles.kpiBig}>{ventas.pedidos.toLocaleString('es-VE')}</span>
        </Kpi>
        <Kpi icon={DollarSign} tone="green" label="Valor de pedidos del catálogo">
          <Money usd={ventas.usd} bs={ventas.bs} />
        </Kpi>
        <Kpi icon={TrendingUp} tone="purple" label="Visita a pedido">
          <span className={styles.kpiBig}>{fmtPct(embudo[3].sessions, embudo[0].sessions)}</span>
        </Kpi>
      </div>

      <div className={styles.grid}>
        <Card title="Búsquedas sin resultados" icon={Search} accent wide>
          <p className={styles.hint}>Lo que tus clientes buscan y no encuentran: agrégalo a tu catálogo.</p>
          <Bars
            items={counts(interes.busquedasSinResultado)}
            tone="warning"
            empty="Aún no hay búsquedas sin resultados en este rango"
          />
        </Card>

        <Card title="Tráfico" icon={Activity}>
          <dl className={styles.stats}>
            <div><dt>Visitantes hoy</dt><dd>{trafico.visitantesHoy.toLocaleString('es-VE')}</dd></div>
            <div><dt>Visitantes en {rangoTxt}</dt><dd>{trafico.visitantesRango.toLocaleString('es-VE')}</dd></div>
            <div><dt>Tiempo promedio por sesión</dt><dd>{fmtDuration(trafico.tiempoPromedioSeg)}</dd></div>
          </dl>
          <DailyChart days={trafico.serieDiaria} />
        </Card>

        <Card title="Equipo y lugar" icon={Globe}>
          <h3 className={styles.sub}>Equipo</h3>
          <Bars items={counts(trafico.equipos, DEVICE_LABEL)} />
          <h3 className={styles.sub}>Países</h3>
          <Bars items={counts(trafico.paises)} empty="Sin datos de país" />
          <h3 className={styles.sub}>Ciudades</h3>
          <Bars items={counts(trafico.ciudades)} empty="Sin datos de ciudad" />
        </Card>

        <Card title="Origen de las visitas" icon={MousePointerClick}>
          <h3 className={styles.sub}>Fuente</h3>
          <Bars items={counts(origen.fuentes)} />
          <h3 className={styles.sub}>Campaña</h3>
          <Bars items={counts(origen.campanas)} empty="Aún no hay visitas desde campañas en este rango" />
        </Card>

        <Card title="Interés" icon={Heart}>
          <h3 className={styles.sub}>Productos más vistos</h3>
          <Bars items={interes.productos.map(p => ({ label: p.name, value: p.count }))} />
          <h3 className={styles.sub}>Marcas</h3>
          <Bars items={counts(interes.marcas)} />
          <h3 className={styles.sub}>Deportes elegidos</h3>
          <Bars items={counts(interes.deportes)} />
          <h3 className={styles.sub}>Búsquedas más frecuentes</h3>
          <Bars items={counts(interes.busquedasTop)} empty="Aún no hay búsquedas en este rango" />
        </Card>

        <Card title="Embudo" icon={Filter}>
          <Bars
            items={embudo.map(s => ({
              label: s.label,
              value: s.sessions,
              display: `${s.sessions.toLocaleString('es-VE')} · ${s.pctVisitas.toLocaleString('es-VE')}%${
                s.pctPaso === null ? '' : ` (${s.pctPaso.toLocaleString('es-VE')}% del paso anterior)`
              }`,
            }))}
          />
        </Card>

        <Card title="Ventas por origen" icon={Eye}>
          <h3 className={styles.sub}>Por fuente</h3>
          <VentasList rows={ventas.porFuente} />
          <h3 className={styles.sub}>Por campaña</h3>
          <VentasList rows={ventas.porCampana} />
        </Card>

        <Card title="Cómo pagan" icon={DollarSign}>
          <VentasList rows={ventas.porMetodo.filter(m => m.pedidos > 0)} />
          {ventas.pedidos > 0 && (
            <div className={styles.total}>
              <span>Total del rango</span>
              <Money usd={ventas.usd} bs={ventas.bs} />
            </div>
          )}
        </Card>

        <Card title="Contacto" icon={Radar} wide>
          <div className={styles.contact}>
            <div className={styles.contactItem}>
              <MessageCircle size={20} strokeWidth={1.75} aria-hidden="true" />
              <span className={styles.kpiBig}>{contacto.whatsapp.toLocaleString('es-VE')}</span>
              <span className={styles.kpiLabel}>Clics a WhatsApp</span>
            </div>
            <div className={styles.contactItem}>
              <Phone size={20} strokeWidth={1.75} aria-hidden="true" />
              <span className={styles.kpiBig}>{contacto.llamadas.toLocaleString('es-VE')}</span>
              <span className={styles.kpiLabel}>Llamadas</span>
            </div>
          </div>
          <DailyChart
            label="Clics de contacto por día"
            empty="Aún no hay clics de contacto en este rango"
            days={contacto.porDia.map(c => ({ fecha: c.fecha, visitantes: c.whatsapp + c.llamadas }))}
          />
        </Card>
      </div>
    </div>
  )
}
