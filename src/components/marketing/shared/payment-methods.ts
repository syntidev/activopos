import { Smartphone, Send, Bitcoin, Coins, CreditCard, Banknote } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* Métodos de cobro + color semántico por método (Tipo E de
   DESIGN_SYSTEM.md) -- la caja del ícono es siempre blanca, solo el
   ícono cambia de color. Fuente única, consumida por la franja dentro
   de PricingSection. Orden: nacional primero. */
export interface PaymentMethod {
  name:  string
  Icon:  LucideIcon
  color: string
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  { name: 'Pago Móvil',      Icon: Smartphone, color: '#16A34A' },
  { name: 'Efectivo Bs/USD', Icon: Banknote,   color: '#16A34A' },
  { name: 'Zelle',           Icon: Send,       color: '#2563EB' },
  { name: 'Zinli',           Icon: CreditCard, color: '#6B7280' },
  { name: 'Binance',         Icon: Bitcoin,    color: '#F59E0B' },
  { name: 'USDT',            Icon: Coins,      color: '#F59E0B' },
  { name: 'PayPal',          Icon: CreditCard, color: '#6B7280' },
]
