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
  actualizarCantidad,
  eliminarItem,
  aplicarDescuentoGlobal,
  aplicarCargoGlobal,
  buildSalePayload,
} from '@/lib/pos'

export interface PaymentMethod {
  id: number
  name: string
  type: string
}

const FALLBACK_RATE = 36.50

export function usePOS() {
  const [rate, setRate] = useState(FALLBACK_RATE)
  const [ticket, setTicket] = useState<TicketState>(() => limpiarTicket(FALLBACK_RATE))
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<ProductForPOS[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [cajaStatus, setCajaStatus] = useState<'open' | 'closed' | 'loading'>('loading')
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [showCobro, setShowCobro] = useState(false)
  const [showCliente, setShowCliente] = useState(false)
  const [showCotizacion, setShowCotizacion] = useState(false)
  const [showDescuento, setShowDescuento] = useState(false)
  const [showCargo, setShowCargo] = useState(false)

  const searchTimer = useRef<NodeJS.Timeout | null>(null)

  const fetchCajaStatus = useCallback(async () => {
    const [rateRes, cajaRes, methodsRes] = await Promise.all([
      fetch('/api/rates/bcv').catch(() => null),
      fetch('/api/cash/status').catch(() => null),
      fetch('/api/payment-methods').catch(() => null),
    ])

    if (rateRes?.ok) {
      const json = await rateRes.json().catch(() => null)
      if (json?.rate) {
        setRate(json.rate)
        setTicket(prev => ({ ...prev, rate: json.rate }))
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
  }, [])

  // Init: rate BCV + estado de caja + métodos de pago
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
    setTicket(prev => agregarItem(prev, product, qty))
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
      client_id: client?.id ?? null,
      client_name: client?.name ?? '',
      client_phone: client?.phone ?? '',
    }))
  }, [])

  const clearTicket = useCallback(() => {
    setTicket(limpiarTicket(rate))
  }, [rate])

  // ── Acciones asíncronas ────────────────────────────────────────────────────

  const postSale = async (
    currentTicket: TicketState,
    status: 'paid' | 'quote' | 'pending',
    origin: 'pos' | 'quote' | 'credit',
    payments?: PaymentInput[],
    options?: QuoteOptions
  ): Promise<SaleResult> => {
    const totals = calcularTotales(currentTicket)
    const items = buildSalePayload(currentTicket, totals)

    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        status,
        origin,
        client_id: currentTicket.client_id ?? undefined,
        client_name: currentTicket.client_name || undefined,
        notes: currentTicket.notes || options?.notes || undefined,
        payments,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Error al procesar la venta')

    return {
      id: data.sale.id,
      ticket_number: data.sale.ticket_number,
      status: data.sale.status,
      total_usd: Number(data.sale.total_usd),
      total_bs: Number(data.sale.total_bs),
    }
  }

  const procesarPago = async (payments: PaymentInput[]): Promise<SaleResult> => {
    const result = await postSale(ticket, 'paid', 'pos', payments)
    setTicket(limpiarTicket(rate))
    setShowCobro(false)
    return result
  }

  const generarCotizacion = async (options: QuoteOptions = {}): Promise<SaleResult> => {
    const result = await postSale(ticket, 'quote', 'quote', undefined, options)
    setShowCotizacion(false)
    return result
  }

  const venderACredito = async (): Promise<SaleResult> => {
    const result = await postSale(ticket, 'pending', 'credit')
    setTicket(limpiarTicket(rate))
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
    search,
    setSearch,
    searchResults,
    isSearching,
    cajaStatus,
    paymentMethods,
    showCobro,
    setShowCobro,
    showCliente,
    setShowCliente,
    showCotizacion,
    setShowCotizacion,
    showDescuento,
    setShowDescuento,
    showCargo,
    setShowCargo,
    addProduct,
    updateQty,
    removeItem,
    applyDiscount,
    applyCargo,
    setClient,
    clearTicket,
    totals,
    procesarPago,
    generarCotizacion,
    venderACredito,
    openCaja,
    refreshCash: fetchCajaStatus,
  }
}
