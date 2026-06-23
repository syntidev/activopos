import type { Metadata } from 'next'
import { MessageCircle, Mail, Clock } from 'lucide-react'
import ContactForm from './ContactForm'
import styles from './contacto.module.css'

export const metadata: Metadata = {
  title: 'Contacto',
  description:
    'Escríbenos por WhatsApp, correo o el formulario. Respondemos en menos de 24 horas.',
}

const CHANNELS = [
  {
    icon: MessageCircle,
    variant: 'whatsapp' as const,
    name: 'WhatsApp',
    desc: 'Respuesta inmediata en horario hábil',
    href: 'https://wa.me/584222654827?text=Hola%2C+quiero+saber+m%C3%A1s+sobre+ActivoPOS',
  },
  {
    icon: Mail,
    variant: 'email' as const,
    name: 'Correo electrónico',
    desc: 'hola@activopos.com',
    href: 'mailto:hola@activopos.com',
  },
  {
    icon: Clock,
    variant: undefined,
    name: 'Horario de atención',
    desc: 'Lun – Vie 8:00 am – 6:00 pm (Venezuela)',
    href: undefined,
  },
]

export default function ContactoPage() {
  return (
    <section className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Contacto</p>
          <h1 className={styles.title}>Hablemos</h1>
          <p className={styles.subtitle}>
            ¿Quieres ver una demo, tienes dudas sobre planes o necesitas soporte?
            Elige el canal que prefieras.
          </p>
        </header>

        <div className={styles.grid}>
          {/* Channels */}
          <div className={styles.channels}>
            <p className={styles.channelsTitle}>Canales directos</p>
            {CHANNELS.map(({ icon: Icon, variant, name, desc, href }) => {
              const inner = (
                <>
                  <span className={`${styles.channelIcon} ${variant ? styles[variant] : ''}`}>
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <div className={styles.channelBody}>
                    <p className={styles.channelName}>{name}</p>
                    <p className={styles.channelDesc}>{desc}</p>
                  </div>
                </>
              )

              return href ? (
                <a
                  key={name}
                  href={href}
                  className={styles.channel}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                >
                  {inner}
                </a>
              ) : (
                <div key={name} className={styles.channel}>{inner}</div>
              )
            })}
          </div>

          {/* Form */}
          <div className={styles.formCard}>
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  )
}
