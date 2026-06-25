'use client'

import { useState, useEffect } from 'react'
import { ShoppingCart, X } from 'lucide-react'
import { usePOS } from '@/hooks/usePOS'
import { useDraftTabs } from '@/hooks/useDraftTabs'
import { calcularTotales, ticketVacio } from '@/lib/pos'
import { LeftPanel } from './LeftPanel'
import { TicketPanel } from './TicketPanel'
import { DraftTabs } from '@/components/pos/DraftTabs'
import { CajaAperturaScreen } from '@/components/pos/CajaAperturaScreen'
import { CobroModal } from '@/components/pos/CobroModal'
import { ScannerModal } from '@/components/pos/ScannerModal'
import { ClienteModal } from '@/components/pos/ClienteModal'
import { CotizacionModal } from '@/components/pos/CotizacionModal'
import { PinDescuentoModal } from '@/components/pos/PinDescuentoModal'
import { CargoModal } from '@/components/pos/CargoModal'
import { CreditoModal } from '@/components/pos/CreditoModal'
import { QtyInput } from '@/components/pos/QtyInput'
import { VariantSelector } from '@/components/products/VariantSelector'
import { useToast } from '@/components/ui'
import { useHardwareScanner } from '@/hooks/useHardwareScanner'
import type { ProductForPOS } from '@/lib/pos'
import styles from './pos.module.css'

export default function POSPage() {
  const pos = usePOS()
  const { toast } = useToast()
  const [weightProduct, setWeightProduct] = useState<ProductForPOS | null>(null)
  const [cartOpen, setCartOpen]           = useState(false)
  const [scannerOpen, setScannerOpen]     = useState(false)
  const [businessName, setBusinessName]   = useState('')

  useEffect(() => {
    fetch('/api/config/business')
      .then(r => r.json())
      .then((j: { business?: { name?: string } }) => {
        if (j.business?.name) setBusinessName(j.business.name)
      })
      .catch(() => {})
  }, [])
  const totals = calcularTotales(pos.ticket)
  const isEmpty = ticketVacio(pos.ticket)
  const itemCount = pos.ticket.items.length

  const drafts = useDraftTabs(pos.rate, 0)

  useHardwareScanner({
    enabled: pos.cajaStatus === 'open',
    onScan:  async (code) => {
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(code)}&limit=1`)
        if (!res.ok) return
        const data = await res.json() as { products?: ProductForPOS[] }
        const product = data.products?.[0]
        if (!product) {
          toast(`Producto no encontrado: ${code}`, 'error')
          return
        }
        if (product.sale_mode === 'weight') {
          setWeightProduct(product)
        } else {
          pos.addProduct(product, 1)
        }
      } catch {
        // Never interrupt the cashier — scan errors are silent
      }
    },
  })

  if (pos.cajaStatus === 'loading') {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.spinner} />
      </div>
    )
  }

  if (pos.cajaStatus === 'closed') {
    return <CajaAperturaScreen onOpen={pos.openCaja} />
  }

  const handleProductClick = (product: ProductForPOS) => {
    if (product.sale_mode === 'weight') setWeightProduct(product)
    else pos.addProduct(product, 1)
  }

  const handleVenderCredito = () => {
    if (isEmpty) { toast('Agrega productos al ticket', 'warning'); return }
    pos.setShowCreditoModal(true)
  }

  const handleSwitchTab = (id: string) => {
    const newTicket = drafts.switchTo(id, pos.ticket)
    pos.setTicketDirect(newTicket)
  }

  const handleNewTab = async () => {
    const newTicket = await drafts.addTab(pos.ticket)
    if (!newTicket) { toast('Máximo 5 tickets simultáneos', 'warning'); return }
    pos.setTicketDirect(newTicket)
  }

  const handleCloseTab = (id: string) => {
    const result = drafts.closeTab(id, pos.ticket)
    if (!result) return
    if (result.switched) pos.setTicketDirect(result.newTicket)
  }

  const handlePaymentComplete = async () => {
    const nextTicket = await drafts.paymentComplete()
    pos.setTicketDirect(nextTicket)
  }

  return (
    <div className={styles.posContainer}>
      <div className={styles.leftArea}>
        <DraftTabs
          tabs={drafts.tabs}
          activeId={drafts.activeId}
          loading={drafts.loading}
          onSwitch={handleSwitchTab}
          onNew={handleNewTab}
          onClose={handleCloseTab}
        />
        <LeftPanel
          search={pos.search}
          onSearchChange={pos.setSearch}
          isSearching={pos.isSearching}
          results={pos.searchResults}
          rate={pos.rate}
          onProductClick={handleProductClick}
          onScannerOpen={() => setScannerOpen(true)}
        />
      </div>

      {/* Mobile: floating cart toggle */}
      <button
        className={styles.cartToggle}
        onClick={() => setCartOpen(o => !o)}
        aria-label={cartOpen ? 'Cerrar carrito' : `Ver carrito (${itemCount} ítems)`}
      >
        {cartOpen
          ? <X size={20} aria-hidden="true" />
          : itemCount > 0
            ? <>
                <ShoppingCart size={18} aria-hidden="true" />
                <span className={styles.cartToggleText}>Ver carrito ({itemCount})</span>
              </>
            : <ShoppingCart size={22} aria-hidden="true" />
        }
      </button>

      {/* Mobile: overlay backdrop */}
      {cartOpen && (
        <div
          className={styles.drawerOverlay}
          onClick={() => setCartOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Cart slot — side drawer on mobile, grid panel on desktop */}
      <div className={`${styles.cartSlot}${cartOpen ? ` ${styles.cartSlotOpen}` : ''}`}>
        <TicketPanel
          ticket={pos.ticket}
          totals={totals}
          isEmpty={isEmpty}
          onUpdateQty={pos.updateQty}
          onRemove={pos.removeItem}
          onClear={pos.clearTicket}
          onSelectClient={() => pos.setShowCliente(true)}
          onProcesarPago={() => {
            if (isEmpty) { toast('Agrega productos antes de cobrar', 'warning'); return }
            pos.setShowCobro(true)
          }}
          onVenderCredito={handleVenderCredito}
          onCotizar={() => {
            if (isEmpty) { toast('Agrega productos primero', 'warning'); return }
            pos.setShowCotizacion(true)
          }}
          onDescuento={() => pos.setShowPinDescuento(true)}
          onCargo={() => pos.setShowCargo(true)}
        />
      </div>

      {weightProduct && (
        <QtyInput
          product={weightProduct}
          rate={pos.rate}
          onConfirm={(qty) => { pos.addProduct(weightProduct, qty); setWeightProduct(null) }}
          onClose={() => setWeightProduct(null)}
        />
      )}

      <CobroModal
        open={pos.showCobro}
        onClose={() => pos.setShowCobro(false)}
        totals={totals}
        paymentMethods={pos.paymentMethods}
        onConfirm={async (payments) => {
          const result = await pos.procesarPago(payments)
          await handlePaymentComplete()
          return result
        }}
        rate={pos.rate}
        clientId={pos.ticket.client_id}
        items={pos.ticket.items.map(i => ({
          name:      i.product_name,
          qty:       i.quantity,
          price_usd: i.price_per_unit_usd,
        }))}
        businessName={businessName}
      />
      <ClienteModal
        open={pos.showCliente}
        onClose={() => pos.setShowCliente(false)}
        onSelect={(c) => { pos.setClient(c); pos.setShowCliente(false) }}
        selectedId={pos.ticket.client_id}
      />
      <CotizacionModal
        open={pos.showCotizacion}
        onClose={() => pos.setShowCotizacion(false)}
        ticket={pos.ticket}
        totals={totals}
        onConfirm={pos.generarCotizacion}
      />
      <PinDescuentoModal
        open={pos.showPinDescuento}
        onClose={() => pos.setShowPinDescuento(false)}
        currentPct={pos.ticket.discount_global_pct}
        totalUsd={totals.subtotal_usd}
        onApply={pos.applyDiscountWithPin}
      />
      <CargoModal
        open={pos.showCargo}
        onClose={() => pos.setShowCargo(false)}
        currentPct={pos.ticket.cargo_global_pct}
        totalUsd={totals.subtotal_usd}
        onApply={pos.applyCargo}
      />

      <CreditoModal
        open={pos.showCreditoModal}
        onClose={() => pos.setShowCreditoModal(false)}
        totalUsd={totals.total_usd}
        onConfirm={async (terms) => {
          pos.setShowCreditoModal(false)
          try {
            const result = await pos.venderACredito(terms)
            await handlePaymentComplete()
            toast(`Crédito #${result.ticket_number} registrado`, 'success')
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Error al registrar venta', 'error')
          }
        }}
      />

      <ScannerModal
        open={scannerOpen}
        ticket={pos.ticket}
        totals={totals}
        onAddProduct={(product) => pos.addProduct(product, 1)}
        onUpdateQty={pos.updateQty}
        onClose={() => setScannerOpen(false)}
        onProcesarPago={() => {
          setScannerOpen(false)
          pos.setShowCobro(true)
        }}
      />

      <VariantSelector
        open={pos.showVariantSelector}
        onClose={pos.cancelVariantSelector}
        product={pos.pendingVariantProduct
          ? {
              id: pos.pendingVariantProduct.id,
              name: pos.pendingVariantProduct.name,
              price_per_unit_usd: pos.pendingVariantProduct.price_per_unit_usd,
            }
          : null}
        onSelect={(variant) => {
          if (pos.pendingVariantProduct) {
            pos.addProductWithVariant(pos.pendingVariantProduct, variant)
          }
        }}
      />
    </div>
  )
}
