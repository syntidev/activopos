# TESTIDS — contrato de selectores de la Carta (suite E2E `tests/carta-*.spec.ts`)

Escrita por CLI-D **antes** del código (2026-11-05). CLI-B: cada `data-testid` de esta lista debe existir tal cual. Si una prueba exige algo que el diseño no puede dar, se discute con CLI-D; no se renombra en silencio. Ruta: `/catalogo-carta/[slug]` (404 si `catalog_template !== 'carta'`).

Siembra de las pruebas: negocio ZZ con los 38 platos / 10 categorías / 14 tamaños de `CafeConBike_menu_normalizado.xlsx`. Solo "Pechuga de Pollo Asada" tiene precio Divisa ($12 sobre lista $14).

## Raíz y portada
| testid | Qué es |
|---|---|
| `carta-root` | Contenedor de toda la página. Atributo `data-carta-style="casual\|fine"`. Define `--acento` (casual `#B8381A`, fine `#8A6A2F`). |
| `carta-portada` | Bloque de portada. |
| `carta-nombre` | Nombre del negocio. |
| `carta-estado` | Píldora "Abierto · cierra a las 10:00 pm" / "Cerrado · abre mañana 11:00 am". |
| `carta-horario` | Horario completo por día (lun … dom). |

## Hero y "De la casa"
| testid | Qué es |
|---|---|
| `carta-hero` | Carrusel. `aria-roledescription="carrusel"`. |
| `carta-hero-titulo` | "Los favoritos de la casa" (hay ventas 30 d) o "Recomendados". |
| `carta-hero-slide` | Cada slide. Atributo `data-activo="true"` en el visible. Contiene "N.º 1 de la casa" en el primero. |
| `carta-hero-nombre` | Nombre del plato dentro del slide. |
| `carta-hero-agregar` | Botón Agregar del slide (mismo handler que el de la lista). |
| `carta-de-la-casa` | Sección ≥1024 px (oculta/ausente en móvil). |
| `carta-de-la-casa-card` | Tarjeta fotográfica (3). No repite platos del hero. |
| `carta-de-la-casa-nombre` | Nombre dentro de la tarjeta. |
| `carta-banda` | Banda fotográfica de ambiente (≥1 en escritorio). |
| `carta-franja-pago` | Franja "Cómo pagas" — una sola vez en la página. |

## Navegación y búsqueda
| testid | Qué es |
|---|---|
| `carta-tabs` | Carril de tabs (scroll horizontal interno). |
| `carta-tab-{slug}` | Una tab por categoría, con el conteo dentro del texto. `aria-selected="true"` en la activa (solo una). |
| `carta-seccion-{slug}` | Sección de la categoría. |
| `carta-buscador` | Input único de búsqueda híbrida. |
| `carta-sin-resultados` | Estado vacío de la búsqueda. |

`{slug}` = nombre de la categoría en minúsculas, sin acentos, no alfanuméricos → `-` (ej. `Acompañantes` → `acompanantes`, `Banquetes y eventos` → `banquetes-y-eventos`).

## Plato (lista)
| testid | Qué es |
|---|---|
| `carta-plato` | Tarjeta/fila de plato (una por plato; el hero y "De la casa" NO la usan). |
| `carta-plato-nombre` | Nombre (serif cargada). Tocarlo abre la ficha `/p/[id]`. |
| `carta-plato-foto` | Contenedor de la foto, 4:5, fondo cálido (nunca blanco). |
| `carta-plato-sin-foto` | Tarjeta tipográfica (inicial como marca de agua); sin `<img>` ni ícono Lucide. |
| `carta-plato-precio-usd` | Precio grande en $ (Divisa si `0 < divisa < lista`). Texto exacto `$11.00`. |
| `carta-plato-precio-bs` | Bs pequeño debajo. Texto exacto `Bs. 1,234.56`. |
| `carta-plato-agregar` | Botón de texto "Agregar" (contorno). Plato simple: agrega sin navegar. Plato con tamaños/obligatorios: abre la ficha. |
| `carta-agotado-hoy` | "Agotado hoy" (C2); el plato no tiene `carta-plato-agregar`. |
| `carta-chip-bs` | **No debe existir** en ningún plato (E10). |

## Ficha (`/catalogo-carta/[slug]/p/[id]`)
| testid | Qué es |
|---|---|
| `carta-ficha` | Contenedor. |
| `carta-tamano` | Opción de tamaño (radio). `data-tamano="250 g"`. El menor viene marcado. |
| `carta-ficha-precio` | Precio unitario vigente, texto `$26.00`. |
| `carta-cantidad-mas` / `carta-cantidad-menos` / `carta-cantidad-valor` | Cantidad; no baja de 1. |
| `carta-nota` | Textarea/input "nota para la cocina". |
| `carta-ficha-agregar` | Texto `Agregar · $52.00` (cantidad × precio del tamaño). |

## Barra y carrito
| testid | Qué es |
|---|---|
| `carta-barra-pedido` | Barra fija "Ver mi pedido"; abre el carrito. |
| `carta-barra-cantidad` | Suma de unidades (texto solo el número). |
| `carta-barra-total-usd` / `carta-barra-total-bs` | `$59.00` / `Bs. 59,xxx.xx`. |
| `carta-carrito` | Cajón/pantalla del carrito. |
| `carta-linea` | Una línea. |
| `carta-linea-detalle` | Tamaño + modificadores + nota en texto. |
| `carta-linea-cantidad` / `carta-linea-mas` / `carta-linea-menos` / `carta-linea-total` | Edición y subtotal de la línea. |
| `carta-linea-quitar` | Quitar → abre `carta-quitar-dialogo` (`carta-quitar-confirmar` / `carta-quitar-cancelar`). |
| `carta-total-usd` / `carta-total-bs` | Totales del carrito. |
| `carta-modalidad-aqui` / `-llevar` / `-delivery` | "Comer aquí" / "Para llevar" / "Delivery". |
| `carta-nombre-cliente` / `carta-telefono` / `carta-cedula` | Datos del cliente (el endpoint exige cédula). |
| `carta-pago-divisa` / `carta-pago-bs` / `carta-pago-cashea` | Forma de pago; solo existen las que el negocio acepta (solo Bs → solo `carta-pago-bs`). El texto de `carta-pago-bs` es la etiqueta que va en el mensaje. |
| `carta-enviar` | "Enviar pedido por WhatsApp". |
| `carta-aviso-cerrado` / `carta-avisame` | Negocio cerrado (C2): aviso y "Avísame por WhatsApp"; `carta-enviar` deshabilitado. |
| `carta-aviso-respaldo` | Aviso cuando el registro falló pero el mensaje se envió igual. |
| `carta-confirmacion` / `carta-numero-pedido` / `carta-mensaje-wa` | Confirmación: número (`CT-0142`, igual a `orders.order_number`) y el mensaje enviado, idéntico al de WhatsApp. |

## Contrato del mensaje de WhatsApp (C1)
`wa.me/{whatsapp}?text=…` — texto exacto (saltos `\n`; `Bs.` con coma de miles y punto decimal, regla sellada):

```
*Pedido CT-0142 · Café con Bike*
Modalidad: Para llevar
Cliente: Maria Perez · 04141234567
Pago: {texto de carta-pago-*}

2x Lomito de Res (250 g) — $52.00
   Nota: sin cebolla
1x Tequeños de Queso — $7.00

Total: $59.00 · Bs. 59,xxx.xx
```
Modalidades: `Comer aquí`, `Para llevar`, `Delivery`. `customer_reference` del POST = la modalidad. El POST no lleva precios ni totales (solo `product_id`, `qty`, `variant_id`). Si el POST falla, igual se abre WhatsApp y se muestra `carta-aviso-respaldo`.

## Supuestos que CLI-B/CLI-A pueden refutar
1. Un plato con tamaños abre la ficha desde "Agregar" (los tamaños cuentan como elección obligatoria).
2. Sin ventas, "De la casa" completa sus 3 tarjetas con platos distintos a los del hero.
3. `settings.carta_hours` = `{ lun|mar|mie|jue|vie|sab|dom: [["HH:MM","HH:MM"], …] }` (lista vacía = cerrado ese día).
4. Tabs "Combos"/"Para compartir" (E5) y agotado del día (B3) quedan en `test.fixme` hasta C2.
