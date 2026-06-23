import type { Metadata } from 'next'
import styles from './privacidad.module.css'

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description: 'Cómo recopilamos, usamos y protegemos tus datos en ActivoPOS.',
  robots: { index: false, follow: false },
}

export default function PrivacidadPage() {
  return (
    <section className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Legal</p>
        <h1 className={styles.title}>Política de Privacidad</h1>
        <p className={styles.updated}>Última actualización: junio 2026</p>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Quiénes somos</h2>
          <p className={styles.body}>
            ActivoPOS es un sistema de punto de venta desarrollado por SYNTIdev. Operamos el
            servicio bajo el dominio <strong>activopos.com</strong>. Si tienes preguntas sobre
            esta política, escríbenos a{' '}
            <a href="mailto:hola@activopos.com">hola@activopos.com</a>.
          </p>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Datos que recopilamos</h2>
          <p className={styles.body}>
            Recopilamos únicamente los datos necesarios para la operación del servicio:
          </p>
          <ul className={styles.list}>
            <li>Datos de registro: nombre de negocio, correo electrónico y contraseña (hasheada con bcrypt).</li>
            <li>Datos operativos: productos, inventario, ventas y clientes que tú registras.</li>
            <li>Datos técnicos: registros de acceso (IP, fecha/hora) para seguridad y diagnóstico.</li>
          </ul>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Cómo usamos tus datos</h2>
          <ul className={styles.list}>
            <li>Proveer y mantener el servicio.</li>
            <li>Enviarte comunicaciones operativas (alertas de cuenta, cambios críticos).</li>
            <li>Mejorar la plataforma en base a patrones de uso agregados y anónimos.</li>
            <li>Cumplir obligaciones legales aplicables.</li>
          </ul>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>4. Compartición de datos</h2>
          <p className={styles.body}>
            No vendemos ni compartimos tus datos con terceros para fines comerciales.
            Podemos compartir información únicamente:
          </p>
          <ul className={styles.list}>
            <li>Con proveedores de infraestructura (servidor VPS, Cloudflare) bajo acuerdos de confidencialidad.</li>
            <li>Cuando sea requerido por orden judicial o autoridad competente.</li>
          </ul>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>5. Seguridad</h2>
          <p className={styles.body}>
            Aplicamos medidas técnicas razonables: cifrado TLS en tránsito, contraseñas
            hasheadas, tokens JWT con expiración corta, rate limiting en todos los
            endpoints públicos y acceso restringido a la base de datos. Ningún sistema
            es 100% seguro, pero hacemos de la seguridad una prioridad activa.
          </p>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>6. Retención de datos</h2>
          <p className={styles.body}>
            Conservamos tus datos mientras mantengas una cuenta activa. Al cancelar,
            puedes solicitar la eliminación de tus datos dentro de los 30 días
            siguientes. Los registros de auditoría se conservan 90 días por razones
            de seguridad.
          </p>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>7. Tus derechos</h2>
          <p className={styles.body}>
            Tienes derecho a acceder, corregir o eliminar tus datos. Para ejercer
            cualquiera de estos derechos, contáctanos por los medios indicados abajo.
          </p>
        </div>

        <div className={styles.contactBlock}>
          Para cualquier consulta sobre esta política:{' '}
          <a href="mailto:hola@activopos.com">hola@activopos.com</a>
          {' '}·{' '}
          <a href="/contacto">Formulario de contacto</a>
        </div>
      </div>
    </section>
  )
}
