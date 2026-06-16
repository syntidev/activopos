'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Package,
  ShoppingCart,
  RotateCcw,
  Users,
  BarChart2,
  Wallet,
  DollarSign,
  UserCog,
  Settings,
  MessageCircle,
  Send,
  X,
  RotateCw,
  ExternalLink,
  ChevronRight,
} from 'lucide-react'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import styles from './ayuda.module.css'

/* ── Help articles ── */

interface HelpCard {
  icon: React.ElementType
  title: string
  description: string
  keywords: string[]
}

const HELP_CARDS: HelpCard[] = [
  {
    icon: Package,
    title: 'Inventario',
    description: 'Registro, unidades, edición y eliminación de productos.',
    keywords: ['inventario', 'producto', 'stock', 'unidades', 'registro', 'eliminar'],
  },
  {
    icon: ShoppingCart,
    title: 'Ventas (POS)',
    description: 'Contado, crédito, pausar ventas, descuentos y clientes.',
    keywords: ['venta', 'pos', 'cobrar', 'pago', 'descuento', 'crédito', 'ticket'],
  },
  {
    icon: RotateCcw,
    title: 'Devoluciones',
    description: 'Procesamiento de reintegros e historial filtrable.',
    keywords: ['devolución', 'reintegro', 'anular', 'cancelar', 'devolver'],
  },
  {
    icon: Users,
    title: 'Clientes',
    description: 'Creación y depuración de tu directorio de clientes.',
    keywords: ['cliente', 'directorio', 'contacto', 'fiado', 'credito'],
  },
  {
    icon: BarChart2,
    title: 'Reportes',
    description: 'Análisis detallado de ventas y exportación en PDF.',
    keywords: ['reporte', 'exportar', 'pdf', 'análisis', 'historial', 'ventas'],
  },
  {
    icon: Wallet,
    title: 'Gestión de Caja',
    description: 'Control del efectivo en la tienda o negocio.',
    keywords: ['caja', 'efectivo', 'turno', 'apertura', 'cierre', 'cuadre'],
  },
  {
    icon: DollarSign,
    title: 'Finanzas',
    description: 'Cobranza, CxP, cobros parciales e ingresos/gastos.',
    keywords: ['finanzas', 'cobranza', 'gasto', 'ingreso', 'deuda', 'cobro'],
  },
  {
    icon: UserCog,
    title: 'Usuarios',
    description: 'Administrar accesos de tu plantilla laboral.',
    keywords: ['usuario', 'cajero', 'empleado', 'acceso', 'permiso', 'rol'],
  },
  {
    icon: Settings,
    title: 'Configuraciones',
    description: 'Personalizaciones, monedas y formato de ticket.',
    keywords: ['configuracion', 'tasa', 'bcv', 'ticket', 'tema', 'moneda'],
  },
]

/* ── Chatbot responses ── */

const BOT_RULES: [string[], string][] = [
  [
    ['tasa', 'bcv', 'cambio', 'dólar', 'divisa'],
    'Ve a Configuración → General → Tasas de Cambio y presiona "Guardar Tasas". La tasa se actualiza automáticamente desde el BCV.',
  ],
  [
    ['anular', 'cancelar', 'devolver', 'devolución'],
    'En Reportes busca la venta y usa el botón Anular. Solo el administrador puede hacerlo y debe ingresar un motivo.',
  ],
  [
    ['cajero', 'usuario', 'empleado', 'acceso', 'contraseña'],
    'Ve a Configuración → Usuarios → Nuevo Usuario. Asigna el rol "Empleado" para acceso al POS únicamente.',
  ],
  [
    ['producto', 'artículo', 'inventario', 'stock'],
    'Ve a la sección Productos y usa "+ Nuevo" para agregar un artículo. Ingresa nombre, precio y categoría.',
  ],
  [
    ['caja', 'turno', 'apertura', 'cierre', 'cuadre'],
    'En Gestión de Caja abre el turno con los fondos iniciales. Al cerrar, ingresa el efectivo contado y se calculará la diferencia.',
  ],
  [
    ['cliente', 'fiado', 'crédito', 'deuda'],
    'En la sección Clientes crea un perfil. Desde el POS puedes asignar una venta a crédito seleccionando el cliente.',
  ],
  [
    ['pago', 'cobrar', 'venta', 'pos', 'ticket'],
    'En el POS selecciona los productos, ingresa la cantidad y procesa el pago eligiendo el método (efectivo, transferencia, etc.).',
  ],
  [
    ['reporte', 'exportar', 'pdf', 'historial'],
    'En la sección Reportes filtra por fecha y usa "Exportar PDF" para descargar el resumen de ventas del período.',
  ],
  [
    ['tema', 'oscuro', 'claro', 'color', 'apariencia'],
    'Ve a Configuración → Apariencia para cambiar entre tema oscuro y claro. El cambio aplica de inmediato.',
  ],
  [
    ['whatsapp', 'soporte', 'ayuda', 'contacto'],
    'Puedes contactar soporte por WhatsApp haciendo clic en el botón "WhatsApp Soporte" en esta misma página.',
  ],
]

function getBotResponse(input: string): string {
  const lower = input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  for (const [keywords, response] of BOT_RULES) {
    if (keywords.some((k) => lower.includes(k.normalize('NFD').replace(/[̀-ͯ]/g, '')))) {
      return response
    }
  }
  return 'Para más ayuda, contacta soporte por WhatsApp usando el botón en esta página. Responden en minutos.'
}

/* ── Chatbot panel ── */

interface ChatMessage {
  id: number
  type: 'bot' | 'user'
  text: string
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, type: 'bot', text: '¡Hola! ¿En qué puedo ayudarte hoy? Pregunta sobre ventas, caja, productos o configuración.' },
  ])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = () => {
    const text = input.trim()
    if (!text) return

    const userMsg: ChatMessage = { id: Date.now(), type: 'user', text }
    const botMsg: ChatMessage = { id: Date.now() + 1, type: 'bot', text: getBotResponse(text) }

    setMessages((prev) => [...prev, userMsg, botMsg])
    setInput('')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className={styles.chatPanel} role="dialog" aria-label="Asistente virtual">
      <div className={styles.chatHeader}>
        <div className={styles.chatHeaderInfo}>
          <div className={styles.chatAvatar} aria-hidden="true">
            <MessageCircle size={16} />
          </div>
          <div>
            <p className={styles.chatName}>Asistente ActivoPOS</p>
            <p className={styles.chatStatus}>En línea · responde al instante</p>
          </div>
        </div>
        <button
          className={styles.chatClose}
          onClick={onClose}
          aria-label="Cerrar chat"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.chatMessages}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.chatBubble} ${msg.type === 'user' ? styles.chatBubbleUser : styles.chatBubbleBot}`}
          >
            {msg.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className={styles.chatInputRow}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escribe tu pregunta..."
          className={styles.chatInput}
          aria-label="Escribe tu pregunta"
        />
        <button
          className={styles.chatSendBtn}
          onClick={send}
          aria-label="Enviar"
          disabled={!input.trim()}
        >
          <Send size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

/* ── Main page ── */

function AyudaContent() {
  const { toast } = useToast()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  const filteredCards = query.trim()
    ? HELP_CARDS.filter((c) => {
        const q = query.toLowerCase()
        return (
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.keywords.some((k) => k.includes(q))
        )
      })
    : HELP_CARDS

  const handleResetTour = useCallback(async () => {
    setResetting(true)
    try {
      const res = await fetch('/api/onboarding/complete', { method: 'DELETE' })
      if (res.ok) {
        router.push('/onboarding')
      } else {
        toast('Error al reiniciar el tour', 'error')
        setResetting(false)
      }
    } catch {
      toast('Error de conexión', 'error')
      setResetting(false)
    }
  }, [router, toast])

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Centro de Ayuda</h1>
          <p className={styles.pageSubtitle}>
            Explora nuestras guías o contáctanos por WhatsApp.
          </p>
        </div>

        {/* Search */}
        <div className={styles.searchWrap}>
          <Search size={18} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca artículos, cómo vender, cómo configurar..."
            className={styles.searchInput}
            aria-label="Buscar en el centro de ayuda"
          />
          {query && (
            <button
              className={styles.searchClear}
              onClick={() => setQuery('')}
              aria-label="Limpiar búsqueda"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Results count */}
        {query && (
          <p className={styles.resultsCount}>
            {filteredCards.length === 0
              ? 'Sin resultados para tu búsqueda.'
              : `${filteredCards.length} ${filteredCards.length === 1 ? 'resultado' : 'resultados'}`}
          </p>
        )}

        {/* Help grid */}
        {filteredCards.length > 0 ? (
          <div className={styles.helpGrid}>
            {filteredCards.map((card) => {
              const Icon = card.icon
              return (
                <button key={card.title} className={styles.helpCard} tabIndex={0}>
                  <div className={styles.helpIconWrap} aria-hidden="true">
                    <Icon size={20} />
                  </div>
                  <div className={styles.helpCardBody}>
                    <h3 className={styles.helpCardTitle}>{card.title}</h3>
                    <p className={styles.helpCardDesc}>{card.description}</p>
                  </div>
                  <ChevronRight size={14} className={styles.helpCardArrow} aria-hidden="true" />
                </button>
              )
            })}
          </div>
        ) : (
          <div className={styles.noResults}>
            <p>¿No encontraste lo que buscas? Escríbenos por WhatsApp.</p>
          </div>
        )}

        {/* Contacts */}
        <div className={styles.contactSection}>
          <h2 className={styles.contactTitle}>Contactos y Accesos Rápidos</h2>
          <div className={styles.contactGrid}>
            <a
              href="https://wa.me/584121234567"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.contactCard}
            >
              <div className={styles.contactIconWrap} aria-hidden="true">
                <MessageCircle size={22} />
              </div>
              <div className={styles.contactInfo}>
                <p className={styles.contactCardTitle}>WhatsApp Soporte</p>
                <p className={styles.contactCardDesc}>Soporte técnico · Respuesta en minutos</p>
              </div>
              <ExternalLink size={14} className={styles.contactArrow} aria-hidden="true" />
            </a>

            <button
              className={styles.contactCard}
              onClick={handleResetTour}
              disabled={resetting}
            >
              <div className={`${styles.contactIconWrap} ${styles.contactIconReset}`} aria-hidden="true">
                <RotateCw size={22} />
              </div>
              <div className={styles.contactInfo}>
                <p className={styles.contactCardTitle}>Reiniciar Tour</p>
                <p className={styles.contactCardDesc}>Vuelve a ver la guía interactiva del sistema</p>
              </div>
              {resetting
                ? <span className={styles.loadingSpinner} aria-hidden="true" />
                : <ChevronRight size={14} className={styles.contactArrow} aria-hidden="true" />
              }
            </button>
          </div>
        </div>
      </div>

      {/* Floating chat bubble */}
      <button
        className={styles.chatBubbleBtn}
        onClick={() => setChatOpen((v) => !v)}
        aria-label={chatOpen ? 'Cerrar asistente' : 'Abrir asistente virtual'}
        aria-expanded={chatOpen}
      >
        {chatOpen
          ? <X size={22} aria-hidden="true" />
          : <MessageCircle size={22} aria-hidden="true" />
        }
      </button>

      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
    </div>
  )
}

export default function AyudaPage() {
  return (
    <ToastProvider>
      <AyudaContent />
    </ToastProvider>
  )
}
