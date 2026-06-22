'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  TicketState,
  TicketTotals,
  ProductForPOS,
  ClientForPOS,
  PaymentInput,
  SaleResult,
  QuoteOptions,
  limpiarTicket,
  calcularTotales,
  agregarItem,
  agregarItemConVariante,
  actualizarCantidad,
  eliminarItem,
  aplicarDescuentoGlobal,
  aplicarCargoGlobal,
  buildSalePayload,
} from '@/lib/pos'
import type { ProductVariant } from '@/components/products/VariantSelector'
import type { CreditTerms } from '@/components/pos/CreditoModal'

export interface PaymentMethod {
  id: number
  name: string
  type: string
}

const FALLBACK_RATE = 36.50

export function usePOS() {
  const [rate, setRate]         = useState(FALLBACK_RATE)
  const [ivaPct, setIvaPct]     = useState(0)
  const [ticket, setTicket]     = useState<TicketState>(() => limpiarTicket(FALLBACK_RATE, 0))
  const [search, setSearch]     = useState('')
  const [searchResults, setSearchResults] = useState<ProductForPOS[]>([])
  const [isSearching, setIsSearching]     = useState(false)
  const [cajaStatus, setCajaStatus]       = useState<'open' | 'closed' | 'loading'>('loading')
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])

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

  const searchTimer = useRef<NodeJS.Timeout | null>(null)

  const fetchCajaStatus = useCallback(async () => {
    const [rateRes, cajaRes, methodsRes, configRes] = await Promise.all([
      fetch('/api/rates/bcv').catch(() => null),
      fetch('/api/cash/status').catch(() => null),
      fetch('/api/payment-methods').catch(() => null),
      fetch('/api/config/business').catch(() => null),
    ])

    if (rateRes?.ok) {
      const json = await rateRes.json().catch(() => null)
      if (json?.rate) {
        const r = Number(json.rate)
        setRate(r)
        setTicket(prev => ({ ...prev, rate: r }))
      }
    }

    if (cajaRes?.ok) {
      const json = await cajaRes.json().catch(() => null)
      setCajaStatus(json?.isOpen ? 'open' : 'closed')
    } else {
      setCajaStatus('closed')
    }

    if (methodsRes?.ok) {
      const json = await methodsRes.json().catch(() => null)
      setPaymentMethods(json?.methods ?? [])
    }

    if (configRes?.ok) {
      const json = await configRes.json().catch(() => null)
      if (json?.iva_enabled && json?.iva_pct) {
        const pct = Number(json.iva_pct)
        setIvaPct(pct)
        setTicket(prev => ({ ...prev, iva_pct: pct }))
      }
    }
  }, [])

  useEffect(() => {
    fetchCajaStatus()
  }, [fetchCajaStatus])

  // Búsqueda con debounce 300ms
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)

    if (!search.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products/search?q=${encodeURIComponent(search.trim())}&limit=20`
        )
        const json = await res.json()
        setSearchResults(json.products ?? [])
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [search])

  // ── Acciones síncronas del ticket ──────────────────────────────────────────

  const addProduct = useCallback((product: ProductForPOS, qty = 1) => {
    if (product.has_variants) {
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

  const setClient = useCallback((client: ClientForPOS | null) => {
    setTicket(prev => ({
      ...prev,
      client_id:    client?.id ?? null,
      client_name:  client?.name ?? '',
      client_phone: client?.phone ?? '',
    }))
  }, [])

  const clearTicket = useCallback(() => {
    setTicket(limpiarTicket(rate, ivaPct))
    setPendingSaleId(null)
  }, [rate, ivaPct])

  // ── Acciones asíncronas ────────────────────────────────────────────────────

  const postSale = async (
    currentTicket: TicketState,
    status: 'paid' | 'quote' | 'pending',
    origin: 'pos' | 'quote' | 'credit',
    payments?: PaymentInput[],
    options?: QuoteOptions,
    creditTerms?: CreditTerms
  ): Promise<SaleResult> => {
    const totals = calcularTotales(currentTicket)
    const items  = buildSalePayload(currentTicket, totals)

    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        status,
        origin,
        client_id:    currentTicket.client_id ?? undefined,
        client_name:  currentTicket.client_name || undefined,
        notes:        currentTicket.notes || options?.notes || undefined,
        iva_pct:      currentTicket.iva_pct || undefined,
        payments,
        due_date:     creditTerms?.due_date?.toISOString(),
        credit_days:  creditTerms?.credit_days,
        credit_notes: creditTerms?.credit_notes || undefined,
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

  const procesarPago = async (payments: PaymentInput[]): Promise<SaleResult> => {
    let result: SaleResult
    if (pendingSaleId) {
      const res  = await fetch(`/api/sales/${pendingSaleId}/pay`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ payments }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al procesar el pago')
      result = {
        id:            data.sale.id,
        ticket_number: data.sale.ticket_number,
        status:        data.sale.status,
        total_usd:     Number(data.sale.total_usd),
        total_bs:      Number(data.sale.total_bs),
      }
    } else {
      result = await postSale(ticket, 'paid', 'pos', payments)
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
    const result = await postSale(ticket, 'pending', 'credit', undefined, undefined, terms)
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
    showVariantSelector,
    pendingVariantProduct,
    addProduct,
    addProductWithVariant,
    cancelVariantSelector,
    updateQty,
    removeItem,
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
    refreshCash: fetchCajaStatus,
  }
}
