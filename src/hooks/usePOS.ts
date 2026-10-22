'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  TicketState,
  TicketTotals,
  ProductForPOS,
  ProductPrices,
  ClientForPOS,
  PaymentInput,
  SaleResult,
  QuoteOptions,
  PriceMode,
  ServerPricedLine,
  limpiarTicket,
  cambiarModoPrecio,
  hidratarPreciosBase,
  aplicarPreciosServidor,
  calcularTotales,
  agregarItem,
  agregarItemConVariante,
  actualizarCantidad,
  eliminarItem,
  aplicarDescuentoGlobal,
  aplicarCargoGlobal,
  buildSalePayload,
  overridePrecioItem,
} from '@/lib/pos'
import type { ProductVariant } from '@/components/products/VariantSelector'
import type { CreditTerms } from '@/components/pos/CreditoModal'

export interface PaymentMethod {
  id: number
  name: string
  type: string
  /** Financiadora: exige cédula (V/E) antes de cobrar. */
  is_financing?: boolean
}

const FALLBACK_RATE = 36.50

const HYDRATE_ATTEMPTS = 3
const HYDRATE_RETRY_MS = 1000

const HYDRATE_MAX_IDS = 50

/**
 * Precios base por id exacto: GET /api/products/search?id=12,15,40 (máx. 50, apto para cajero). Los ids ausentes de la
 * respuesta ya no están disponibles. Devuelve null si la consulta falla (el llamador reintenta).
 */
async function fetchProductPrices(ids: number[]): Promise<ProductPrices[] | null> {
  try {
    const res = await fetch(`/api/products/search?id=${ids.join(',')}`)
    if (!res.ok) return null
    const json = await res.json() as { products?: ProductPrices[] }
    return json.products ?? null
  } catch {
    return null
  }
}

export function usePOS() {
  const [rate, setRate]         = useState(FALLBACK_RATE)
  const [ivaPct, setIvaPct]     = useState(0)
  const [ticket, setTicket]     = useState<TicketState>(() => limpiarTicket(FALLBACK_RATE, 0))
  const [search, setSearch]     = useState('')
  const [searchResults, setSearchResults] = useState<ProductForPOS[]>([])
  const [isSearching, setIsSearching]     = useState(false)
  const [cajaStatus, setCajaStatus]       = useState<'open' | 'closed' | 'loading'>('loading')
  const [paymentMethods, setPaymentMethods]                 = useState<PaymentMethod[]>([])
  const [allowCashierPriceOverride, setAllowCashierPriceOverride] = useState(false)
  const [priceModeBusy, setPriceModeBusy]   = useState(false)
  const [priceModeError, setPriceModeError] = useState('')

  /* ── Modal visibility ── */
  const [showCobro, setShowCobro]               = useState(false)
  const [showCliente, setShowCliente]           = useState(false)
  const [showCotizacion, setShowCotizacion]     = useState(false)
  const [showDescuento, setShowDescuento]       = useState(false)
  const [showPinDescuento, setShowPinDescuento] = useState(false)
  const [showCargo, setShowCargo]               = useState(false)
  const [showCreditoModal, setShowCreditoModal] = useState(false)

  /* Pending sale created for authorize-discount flow */
  const [pendingSaleId, setPendingSaleId] = useState<number | null>(null)

  /* ── Variant selector state ── */
  const [showVariantSelector, setShowVariantSelector]       = useState(false)
  const [pendingVariantProduct, setPendingVariantProduct]   = useState<ProductForPOS | null>(null)

  const searchTimer            = useRef<NodeJS.Timeout | null>(null)
  const pendingOverridePinRef  = useRef<string | undefined>(undefined)

  const fetchCajaStatus = useCallback(async () => {
    const [rateRes, cajaRes, methodsRes, configRes, cajaModeRes] = await Promise.all([
      fetch('/api/rates/bcv').catch(() => null),
      fetch('/api/cash/status').catch(() => null),
      fetch('/api/payment-methods').catch(() => null),
      fetch('/api/config/business').catch(() => null),
      fetch('/api/config/caja-mode').catch(() => null),
    ])

    if (rateRes?.ok) {
      const json = await rateRes.json().catch(() => null)
      if (json?.rate) {
        const r = Number(json.rate)
        setRate(r)
        setTicket(prev => ({ ...prev, rate: r }))
      }
    }

    if (configRes?.ok) {
      const json = await configRes.json().catch(() => null)
      if (json?.iva_enabled && json?.iva_pct) {
        const pct = Number(json.iva_pct)
        setIvaPct(pct)
        setTicket(prev => ({ ...prev, iva_pct: pct }))
      }
      setAllowCashierPriceOverride(Boolean(json?.business?.allow_cashier_price_override))
    }

    // caja_mode vive en /api/config/caja-mode (endpoint dedicado) — ya no en
    // /api/config/business, que dejó de exponerlo. Se resuelve antes de decidir
    // cajaStatus para poder saltar el chequeo de isOpen cuando es 'nocash'.
    const cajaModeData = cajaModeRes?.ok ? await cajaModeRes.json().catch(() => null) : null
    const cajaMode: 'cash' | 'nocash' = cajaModeData?.caja_mode === 'nocash' ? 'nocash' : 'cash'

    if (cajaMode === 'nocash') {
      // Negocio sin manejo de efectivo/turnos — la caja nunca bloquea la venta.
      setCajaStatus('open')
    } else if (cajaRes?.ok) {
      const json = await cajaRes.json().catch(() => null)
      setCajaStatus(json?.isOpen ? 'open' : 'closed')
    } else {
      setCajaStatus('closed')
    }

    if (methodsRes?.ok) {
      const json = await methodsRes.json().catch(() => null)
      setPaymentMethods(json?.methods ?? [])
    }
  }, [])

  useEffect(() => {
    fetchCajaStatus()
  }, [fetchCajaStatus])

  // Búsqueda con debounce 300ms — desde 3 caracteres dispara inmediato (delay=0),
  // clave para pistolas de código de barras que vuelcan el código completo de un
  // solo golpe en el input: no hay razón para esperar 300ms si ya hay señal suficiente.
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)

    const trimmed = search.trim()
    if (!trimmed) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const delay = trimmed.length >= 3 ? 0 : 300
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products/search?q=${encodeURIComponent(trimmed)}&limit=20`
        )
        const json = await res.json()
        setSearchResults(json.products ?? [])
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, delay)

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [search])

  // ── Acciones síncronas del ticket ──────────────────────────────────────────

  // Líneas restauradas de un borrador: se completan sus precios base (consulta por id exacto, con reintentos) para
  // poder repreciarlas al instante. Un producto solo se da por hidratado cuando ya se tiene su precio base.
  const hydratedRef = useRef<Set<number>>(new Set())
  const hydratingRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    const pending = new Set<number>()
    for (const i of ticket.items) {
      const needsBase = i.bcv_unit_usd === undefined && i.price_override_original == null && i.price_source !== 'manual'
      if (needsBase && !hydratedRef.current.has(i.product_id) && !hydratingRef.current.has(i.product_id)) pending.add(i.product_id)
    }
    const ids = Array.from(pending)
    for (let from = 0; from < ids.length; from += HYDRATE_MAX_IDS) {
      const batch = ids.slice(from, from + HYDRATE_MAX_IDS)
      batch.forEach(id => hydratingRef.current.add(id))
      void (async () => {
        for (let attempt = 0; attempt < HYDRATE_ATTEMPTS; attempt++) {
          const products = await fetchProductPrices(batch)
          if (products) {
            // Los ids que no vuelven ya no están disponibles: no se reintentan, la línea queda con su precio guardado.
            batch.forEach(id => hydratedRef.current.add(id))
            setTicket(prev => products.reduce(hidratarPreciosBase, prev))
            break
          }
          await new Promise(r => setTimeout(r, HYDRATE_RETRY_MS * (attempt + 1)))
        }
        batch.forEach(id => hydratingRef.current.delete(id))
      })()
    }
  }, [ticket.items])

  const addProduct = useCallback((product: ProductForPOS, qty = 1) => {
    if (product.has_variants) {
      // Escaneo por EAN de variante: va directo esa talla (si hay stock); si no, el selector.
      const hit = product.variants?.find(v => v.id === product.matched_variant_id)
      if (hit && hit.stock > 0) {
        setTicket(prev => agregarItemConVariante(prev, product, {
          id: hit.id, name: hit.valor, price_extra_usd: Number(hit.precio_extra ?? 0),
        }, qty))
        return
      }
      setPendingVariantProduct(product)
      setShowVariantSelector(true)
      return
    }
    setTicket(prev => agregarItem(prev, product, qty))
  }, [])

  const addProductWithVariant = useCallback((
    product: ProductForPOS,
    variant: ProductVariant
  ) => {
    setTicket(prev => agregarItemConVariante(prev, product, variant))
    setShowVariantSelector(false)
    setPendingVariantProduct(null)
  }, [])

  const cancelVariantSelector = useCallback(() => {
    setShowVariantSelector(false)
    setPendingVariantProduct(null)
  }, [])

  const updateQty = useCallback((productId: number, qty: number) => {
    setTicket(prev => actualizarCantidad(prev, productId, qty))
  }, [])

  const removeItem = useCallback((productId: number) => {
    setTicket(prev => eliminarItem(prev, productId))
  }, [])

  const applyDiscount = useCallback((pct: number) => {
    setTicket(prev => aplicarDescuentoGlobal(prev, pct))
  }, [])

  const applyCargo = useCallback((pct: number) => {
    setTicket(prev => aplicarCargoGlobal(prev, pct))
  }, [])

  const overrideItemPrice = useCallback((
    productId: number,
    variantId: number | undefined,
    newPrice: number,
    reason?: string,
    pin?: string
  ) => {
    // Defensa en profundidad: la venta ya existe en DB (postSale vía pending) —
    // el precio mostrado ya no puede divergir del facturado. El lápiz de
    // TicketPanel se deshabilita visualmente; esto cubre cualquier otro path.
    if (pendingSaleId !== null) return
    setTicket(prev => overridePrecioItem(prev, productId, variantId, newPrice, reason))
    if (pin) pendingOverridePinRef.current = pin
  }, [pendingSaleId])

  const setClient = useCallback((client: ClientForPOS | null) => {
    setTicket(prev => ({
      ...prev,
      client_id:         client?.id ?? null,
      client_name:       client?.name ?? '',
      client_phone:      client?.phone ?? '',
      client_cedula:     client?.cedula ?? '',
      client_price_tier: client?.price_tier,
    }))
  }, [])

  /**
   * Cambia el modo de precio: el ticket se reprecia al instante en el cliente y, si la venta ya existe en el
   * servidor (pendiente o borrador), PATCH .../price-mode devuelve los precios autoritativos. Si el servidor
   * rechaza (409: ya cobrada), se revierte y se muestra su mensaje tal cual.
   */
  const setPriceMode = useCallback(async (mode: PriceMode, draftId?: number): Promise<void> => {
    const previous = ticket.price_mode
    if (mode === previous) return
    setPriceModeError('')
    setTicket(prev => cambiarModoPrecio(prev, mode))
    const saleId = pendingSaleId ?? draftId
    if (saleId === undefined || saleId === null) return
    setPriceModeBusy(true)
    try {
      const res  = await fetch(`/api/sales/${saleId}/price-mode`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ price_mode: mode }),
      })
      const data = await res.json().catch(() => null) as { ticket?: { items: ServerPricedLine[] }; error?: string } | null
      if (!res.ok || !data?.ticket) throw new Error(data?.error ?? 'No se pudo cambiar el modo de precio.')
      const lines = data.ticket.items
      setTicket(prev => aplicarPreciosServidor(prev, mode, lines))
    } catch (err) {
      setTicket(prev => cambiarModoPrecio(prev, previous))
      setPriceModeError(err instanceof Error ? err.message : 'No se pudo cambiar el modo de precio.')
    } finally {
      setPriceModeBusy(false)
    }
  }, [ticket.price_mode, pendingSaleId])

  const clearTicket = useCallback(() => {
    setTicket(limpiarTicket(rate, ivaPct))
    setPendingSaleId(null)
  }, [rate, ivaPct])

  // ── Acciones asíncronas ────────────────────────────────────────────────────

  const postSale = async (
    currentTicket: TicketState,
    status: 'paid' | 'quote' | 'pending' | 'credit',
    origin: 'pos' | 'quote' | 'credit',
    payments?: PaymentInput[],
    options?: QuoteOptions,
    creditTerms?: CreditTerms,
    clientCedula?: string | null
  ): Promise<SaleResult> => {
    const totals           = calcularTotales(currentTicket)
    const items            = buildSalePayload(currentTicket, totals)
    const overrideAuthPin  = pendingOverridePinRef.current
    pendingOverridePinRef.current = undefined

    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        status,
        origin,
        client_id:    currentTicket.client_id ?? undefined,
        client_name:  currentTicket.client_name || undefined,
        client_cedula: clientCedula || undefined,
        notes:        currentTicket.notes || options?.notes || undefined,
        iva_pct:      currentTicket.iva_pct || undefined,
        price_mode:   currentTicket.price_mode,
        payments,
        due_date:     creditTerms?.due_date?.toISOString(),
        credit_days:  creditTerms?.credit_days,
        credit_notes: creditTerms?.credit_notes || undefined,
        ...(overrideAuthPin ? { override_auth_pin: overrideAuthPin } : {}),
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Error al procesar la venta')

    return {
      id:            data.sale.id,
      ticket_number: data.sale.ticket_number,
      status:        data.sale.status,
      total_usd:     Number(data.sale.total_usd),
      total_bs:      Number(data.sale.total_bs),
      price_mode:    data.sale.price_mode === 'divisa' ? 'divisa' : 'bcv',
    }
  }

  const applyDiscountWithPin = async (discountPct: number, pin: string): Promise<void> => {
    const saleId = pendingSaleId ?? (await postSale(ticket, 'pending', 'pos')).id
    setPendingSaleId(saleId)

    const res = await fetch(`/api/sales/${saleId}/authorize-discount`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ pin, discount_pct: discountPct }),
    })
    const data = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) {
      const err = Object.assign(new Error(data.error ?? 'Error'), { status: res.status })
      throw err
    }
    setTicket(prev => aplicarDescuentoGlobal(prev, discountPct))
  }

  const procesarPago = async (payments: PaymentInput[], clientCedula?: string | null): Promise<SaleResult> => {
    let result: SaleResult
    if (pendingSaleId) {
      const res  = await fetch(`/api/sales/${pendingSaleId}/pay`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ payments, client_cedula: clientCedula || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al procesar el pago')
      result = {
        id:            data.sale.id,
        ticket_number: data.sale.ticket_number,
        status:        data.sale.status,
        total_usd:     Number(data.sale.total_usd),
        total_bs:      Number(data.sale.total_bs),
        price_mode:    data.sale.price_mode === 'divisa' ? 'divisa' : 'bcv',
      }
    } else {
      result = await postSale(ticket, 'paid', 'pos', payments, undefined, undefined, clientCedula)
    }
    setPendingSaleId(null)
    setTicket(limpiarTicket(rate, ivaPct))
    setShowCobro(false)
    return result
  }

  const generarCotizacion = async (options: QuoteOptions = {}): Promise<SaleResult> => {
    const result = await postSale(ticket, 'quote', 'quote', undefined, options)
    setShowCotizacion(false)
    return result
  }

  const venderACredito = async (terms: CreditTerms): Promise<SaleResult> => {
    const result = await postSale(ticket, 'credit', 'credit', undefined, undefined, terms)
    setTicket(limpiarTicket(rate, ivaPct))
    return result
  }

  const openCaja = useCallback(async (data: {
    opening_amount_usd: number
    opening_amount_bs: number
  }): Promise<void> => {
    const res = await fetch('/api/cash/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.error ?? `Error ${res.status}`)
    await fetchCajaStatus()
  }, [fetchCajaStatus])

  const totals: TicketTotals = calcularTotales(ticket)

  return {
    ticket,
    rate,
    ivaPct,
    search,
    setSearch,
    searchResults,
    isSearching,
    cajaStatus,
    paymentMethods,
    showCobro,           setShowCobro,
    showCliente,         setShowCliente,
    showCotizacion,      setShowCotizacion,
    showDescuento,       setShowDescuento,
    showPinDescuento,    setShowPinDescuento,
    showCargo,           setShowCargo,
    showCreditoModal,    setShowCreditoModal,
    pendingSaleId,
    showVariantSelector,
    pendingVariantProduct,
    addProduct,
    addProductWithVariant,
    cancelVariantSelector,
    updateQty,
    removeItem,
    overrideItemPrice,
    setPriceMode,
    priceModeBusy,
    priceModeError,
    applyDiscount,
    applyDiscountWithPin,
    applyCargo,
    setClient,
    clearTicket,
    setTicketDirect: (t: TicketState) => setTicket(t),
    totals,
    procesarPago,
    generarCotizacion,
    venderACredito,
    openCaja,
    allowCashierPriceOverride,
    refreshCash: fetchCajaStatus,
  }
}
