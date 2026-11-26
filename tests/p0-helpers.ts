/**
 * Alias histórico de los helpers P0. Antes estaba atado al negocio 87 (OnBike Margarita, cliente real); ahora es
 * solo un re-export de d-tenant (negocio 267 "ZZ D Pruebas"). Los specs nuevos importan de './d-tenant'.
 *
 * Falla al cargar si el 267 no es un tenant "ZZ D…": ningún spec que pase por acá puede correr contra otro negocio.
 */
import { assertOwnTenant } from './d-tenant'

assertOwnTenant()

export * from './d-tenant'
