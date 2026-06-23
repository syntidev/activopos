import type { Metadata } from 'next'
import styles from './terminos.module.css'

export const metadata: Metadata = {
  title: 'Términos y Condiciones',
  description: 'Condiciones de uso del servicio ActivoPOS.',
  robots: { index: false, follow: false },
}

export default function TerminosPage() {
  return (
    <section className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Legal</p>
        <h1 className={styles.title}>Términos y Condiciones</h1>
        <p className={styles.updated}>Última actualización: junio 2026</p>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Aceptación de términos</h2>
          <p className={styles.body}>
            Al crear una cuenta o usar ActivoPOS, aceptas estos Términos y Condiciones.
            Si no estás de acuerdo, no debes usar el servicio. Estos términos pueden
            actualizarse; te notificaremos los cambios relevantes por correo electrónico.
          </p>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Descripción del servicio</h2>
          <p className={styles.body}>
            ActivoPOS es un sistema SaaS de punto de venta e inventario para negocios.
            Incluye: registro de ventas, control de inventario, catálogo público,
            gestión de clientes, reportes y configuración de negocio. El servicio
            no es un sistema de facturación SENIAT ni lo reemplaza.
          </p>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Cuenta y acceso</h2>
          <ul className={styles.list}>
            <li>Eres responsable de mantener la confidencialidad de tus credenciales.</li>
            <li>Notifica inmediatamente cualquier acceso no autorizado a tu cuenta.</li>
            <li>Cada negocio opera bajo una cuenta independiente con datos aislados.</li>
            <li>Nos reservamos el derecho de suspender cuentas que violen estos términos.</li>
          </ul>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>4. Uso aceptable</h2>
          <p className={styles.body}>Está prohibido:</p>
          <ul className={styles.list}>
            <li>Usar el sistema para actividades ilegales o fraudulentas.</li>
            <li>Intentar acceder a cuentas o datos de otros usuarios.</li>
            <li>Realizar ingeniería inversa, descompilar o copiar el código del sistema.</li>
            <li>Sobrecargar la infraestructura mediante automatización excesiva.</li>
          </ul>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>5. Datos del negocio</h2>
          <p className={styles.body}>
            Los datos que registras (productos, clientes, ventas) te pertenecen.
            Te otorgamos la capacidad de exportarlos. Al eliminar tu cuenta, los datos
            se purgan en un plazo de 30 días salvo obligación legal contraria.
          </p>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>6. Disponibilidad y soporte</h2>
          <p className={styles.body}>
            Aspiramos a una disponibilidad del 99.5% mensual, pero no garantizamos
            uptime ininterrumpido. El mantenimiento programado se anuncia con
            anticipación. El soporte es en horario hábil (Lun–Vie, 8am–6pm, Venezuela).
          </p>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>7. Precios y facturación</h2>
          <p className={styles.body}>
            Los precios de los planes se expresan en USD. Nos reservamos el derecho
            de modificar los precios con 30 días de aviso previo. No ofrecemos
            reembolsos por períodos parciales salvo falla comprobable del servicio
            atribuible a nuestra infraestructura.
          </p>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>8. Limitación de responsabilidad</h2>
          <p className={styles.body}>
            ActivoPOS se provee "tal cual". No somos responsables por pérdidas de
            negocio derivadas de errores de operación del usuario, caídas de conexión
            externas, problemas eléctricos u otros factores fuera de nuestro control.
            La responsabilidad máxima se limita al monto pagado por el plan en el
            mes en que ocurrió el evento.
          </p>
        </div>

        <div className={styles.contactBlock}>
          Preguntas sobre estos términos:{' '}
          <a href="mailto:hola@activopos.com">hola@activopos.com</a>
          {' '}·{' '}
          <a href="/contacto">Formulario de contacto</a>
        </div>
      </div>
    </section>
  )
}
