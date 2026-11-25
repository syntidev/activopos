import { redirect } from 'next/navigation'

/**
 * La configuración del módulo vive ahora en Configuración › Restaurante (pestaña). Esta ruta se mantiene
 * como atajo: con el flag redirige a la pestaña; sin el flag, el layout de esta carpeta ya respondió 404.
 */
export default function ConfigRestaurantePage() {
  redirect('/configuracion?tab=restaurante')
}
