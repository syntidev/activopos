'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ExternalLink, X } from 'lucide-react'
import { bs, dual, usd } from './money'
import { TIER_LABEL, type PedidoClienteResumen } from './pago'
import d from './PedidoPago.module.css'

interface ClienteFicha {
  name:       string
  phone:      string | null
  email:      string | null
  cedula:     string | null
  address:    string | null
  price_tier: string
  notes:      string | null
}

interface VentaReciente {
  id:            number
  ticket_number: string
  status:        string
  total_usd:     number
  total_bs:      number
  sold_at:       string | null
  created_at:    string
}

interface FichaResponse {
  ok?:         boolean
  error?:      string
  client?:     ClienteFicha
  cxc?:        { balance_usd: number }
  recentSales?: VentaReciente[]
}

const VENTA_ESTADO: Record<string, string> = { paid: 'Pagada', credit: 'A crédito', partial_return: 'Devolución parcial', returned: 'Devuelta' }
const fecha = (iso: string): string => new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })

/** Ficha del cliente en un panel lateral: se abre sin salir del pedido (Esc o el botón la cierran sin cerrar el modal de abajo). */
function ClienteFichaPanel({ clientId, onClose }: { clientId: number; onClose: () => void }) {
  const [data, setData] = useState<FichaResponse | null>(null)
  const [error, setError] = useState('')
  const cerrarRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let vivo = true
    fetch(`/api/clients/${clientId}`)
      .then(r => r.json() as Promise<FichaResponse>)
      .then(j => { if (!vivo) return; if (j.ok && j.client) setData(j); else setError(j.error ?? 'No se pudo cargar el cliente') })
      .catch(() => { if (vivo) setError('Error de conexión') })
    return () => { vivo = false }
  }, [clientId])

  // Foco al abrir y Esc cierra SOLO esta ficha (captura: el modal del pedido no lo recibe).
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    cerrarRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('keydown', onKey, true); previo?.focus() }
  }, [onClose])

  const c = data?.client
  return (
    <div className={d.fichaScrim} onClick={onClose}>
      <aside className={d.ficha} role="dialog" aria-modal="true" aria-label="Ficha del cliente" data-testid="cliente-ficha" onClick={e => e.stopPropagation()}>
        <div className={d.fichaHead}>
          <h2 className={d.fichaTitulo}>{c?.name ?? 'Cliente'}</h2>
          <button ref={cerrarRef} type="button" className={d.cerrar} onClick={onClose} aria-label="Cerrar ficha del cliente"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className={d.fichaCuerpo}>
          {!data && !error && <p className={d.estadoMsg}>Cargando…</p>}
          {error && <p className={d.errorInline} role="alert">{error}</p>}
          {c && (
            <>
              <section className={d.fichaSeccion}>
                <h3 className={d.fichaEtiqueta}>Datos</h3>
                <dl className={d.datos}>
                  <dt>Cédula</dt><dd>{c.cedula ?? '—'}</dd>
                  <dt>Teléfono</dt><dd>{c.phone ?? '—'}</dd>
                  {c.email && <><dt>Correo</dt><dd>{c.email}</dd></>}
                  <dt>Dirección</dt><dd>{c.address ?? '—'}</dd>
                  <dt>Precio</dt><dd>{TIER_LABEL[c.price_tier] ?? c.price_tier}</dd>
                  {c.notes && <><dt>Notas</dt><dd>{c.notes}</dd></>}
                </dl>
              </section>
              {data.cxc && data.cxc.balance_usd > 0 && (
                <section className={d.fichaSeccion}>
                  <h3 className={d.fichaEtiqueta}>Saldo por cobrar (crédito)</h3>
                  <p className={d.saldoAlto}>{usd(data.cxc.balance_usd)}</p>
                </section>
              )}
              <section className={d.fichaSeccion}>
                <h3 className={d.fichaEtiqueta}>Compras recientes</h3>
                {(data.recentSales ?? []).length === 0 ? <p className={d.estadoMsg}>Sin compras registradas.</p> : (
                  <ul className={d.ventas}>
                    {(data.recentSales ?? []).map(v => (
                      <li key={v.id} className={d.venta}>
                        <span>#{v.ticket_number}<small> · {fecha(v.sold_at ?? v.created_at)} · {VENTA_ESTADO[v.status] ?? v.status}</small></span>
                        <span className={d.ventaMonto}>{usd(v.total_usd)}<small>{bs(v.total_bs)}</small></span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

interface ClienteResumenProps {
  /** Cliente enlazado (null = el pedido no tiene cliente: se muestran solo teléfono y cédula del pedido). */
  client:         PedidoClienteResumen | null
  fallbackPhone?: string | null
  fallbackCedula?: string | null
  /** Tasa del pedido, para mostrar el saldo en USD y Bs. */
  rate:           number
}

/** Panel de cliente plegable (detalle del pedido y cobro): datos, pedidos previos y saldo por cobrar (cxc + deuda de financiamiento). */
export function ClienteResumen({ client, fallbackPhone, fallbackCedula, rate }: ClienteResumenProps) {
  const [ficha, setFicha] = useState(false)
  const cerrar = useCallback(() => setFicha(false), [])

  if (!client) {
    return (
      <details className={d.cliente} data-testid="cliente-resumen">
        <summary className={d.clienteResumen}>
          <span className={d.clienteNombre}>Cliente · sin ficha enlazada</span>
          <ChevronDown size={16} className={d.clienteFlecha} aria-hidden="true" />
        </summary>
        <div className={d.clienteCuerpo}>
          <dl className={d.datos}>
            <dt>Teléfono</dt><dd>{fallbackPhone || '—'}</dd>
            <dt>Cédula</dt><dd>{fallbackCedula || '—'}</dd>
          </dl>
          <p className={d.sinCliente}>Este pedido no está enlazado a un cliente registrado.</p>
        </div>
      </details>
    )
  }

  const saldo = client.saldo_por_cobrar_usd
  return (
    <>
      <details className={d.cliente} data-testid="cliente-resumen">
        <summary className={d.clienteResumen}>
          <span className={d.clienteNombre}>Cliente · {client.name}</span>
          <ChevronDown size={16} className={d.clienteFlecha} aria-hidden="true" />
        </summary>
        <div className={d.clienteCuerpo}>
          <dl className={d.datos}>
            <dt>Cédula</dt><dd>{client.cedula ?? fallbackCedula ?? '—'}</dd>
            <dt>Teléfono</dt><dd>{client.phone ?? fallbackPhone ?? '—'}</dd>
            {client.address && <><dt>Dirección</dt><dd>{client.address}</dd></>}
            <dt>Precio</dt><dd>{TIER_LABEL[client.price_tier] ?? client.price_tier}</dd>
            <dt>Pedidos previos</dt><dd data-testid="cliente-previos">{client.pedidos_previos}</dd>
            <dt>Saldo por cobrar</dt>
            <dd data-testid="cliente-saldo" className={saldo > 0 ? d.saldoAlto : undefined}>
              {dual(saldo, rate)}
              {saldo > 0 && (
                <small> · crédito {usd(client.saldo_cxc_usd)} + financiamiento {usd(client.deuda_financiamiento_usd)}</small>
              )}
            </dd>
          </dl>
          <button type="button" className={d.accionSecundaria} onClick={() => setFicha(true)} data-testid="cliente-ver-ficha">
            <ExternalLink size={14} aria-hidden="true" />Ver ficha
          </button>
        </div>
      </details>
      {ficha && <ClienteFichaPanel clientId={client.id} onClose={cerrar} />}
    </>
  )
}
