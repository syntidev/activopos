'use client'

import { useState } from 'react'
import { ShoppingCart, X } from 'lucide-react'
import { usePOS } from '@/hooks/usePOS'
import { calcularTotales, ticketVacio } from '@/lib/pos'
import { LeftPanel } from './LeftPanel'
import { TicketPanel } from './TicketPanel'
import { CajaAperturaScreen } from '@/components/pos/CajaAperturaScreen'
import { CobroModal } from '@/components/pos/CobroModal'
import { ClienteModal } from '@/components/pos/ClienteModal'
import { CotizacionModal } from '@/components/pos/CotizacionModal'
import { PinDescuentoModal } from '@/components/pos/PinDescuentoModal'
import { CargoModal } from '@/components/pos/CargoModal'
import { QtyInput } from '@/components/pos/QtyInput'
import { VariantSelector } from '@/components/products/VariantSelector'
import { useToast } from '@/components/ui'
import type { ProductForPOS } from '@/lib/pos'
import styles from './pos.module.css'

export default function POSPage() {
  const pos = usePOS()
  const { toast } = useToast()
  const [weightProduct, setWeightProduct] = useState<ProductForPOS | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const totals = calcularTotales(pos.ticket)
  const isEmpty = ticketVacio(pos.ticket)
  const itemCount = pos.ticket.items.length

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

  const handleVenderCredito = async () => {
    if (isEmpty) { toast('Agrega productos al ticket', 'warning'); return }
    try {
      const result = await pos.venderACredito()
      toast(`Crédito #${result.ticket_number} registrado`, 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al registrar venta', 'error')
    }
  }

  return (
    <div className={styles.posContainer}>
      <LeftPanel
        search={pos.search}
        onSearchChange={pos.setSearch}
        isSearching={pos.isSearching}
        results={pos.searchResults}
        rate={pos.rate}
        onProductClick={handleProductClick}
      />

      {/* Mobile: floating cart toggle */}
      <button
        className={styles.cartToggle}
        onClick={() => setCartOpen(o => !o)}
        aria-label={cartOpen ? 'Cerrar carrito' : `Ver carrito (${itemCount} ítems)`}
      >
        {cartOpen ? <X size={22} /> : <ShoppingCart size={22} />}
        {!cartOpen && itemCount > 0 && (
          <span className={styles.cartBadge}>{itemCount}</span>
        )}
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
        onConfirm={pos.procesarPago}
        rate={pos.rate}
        clientId={pos.ticket.client_id}
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
