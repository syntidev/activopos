# Auditoría ordena.menu → Plantilla Carta (C0)

Fecha: 2026-11-04 · Autor: CLI-B · Solo lectura: `C:\laragon\www\synticorex` no se tocó (sin comandos, sin escritura).

## Qué se auditó realmente
- `resources/views/ordena/layout.blade.php` es **solo el sitio de marketing de ORDENA** (nav oscuro `#0A0A0A`, Plus Jakarta Sans, estilos inline, acento `#E8541A`). No es la carta de un restaurante. Se descarta como referencia de carta; solo aporta el patrón de nav con hamburguesa.
- La carta real que ve el comensal es `resources/views/landing/templates/food.blade.php` (~1 700 líneas, Tailwind + JS inline). Esa es la auditoría de fondo. En `ordena/` no hay parciales de carta, CSS ni JS aparte: todo vive en ese Blade.

## Se conserva (funciona y el comensal lo necesita)
| Qué | Dónde (food.blade.php) | Por qué se conserva |
|---|---|---|
| Barra pegajosa con identidad + tabs de categorías + buscador | 536–632 | Es la navegación principal: con 15+ platos, saltar por categoría sin perder el carrito |
| Filtro instantáneo en cliente por nombre y descripción | 947–948 (`data-sf-q`) | Búsqueda rápida sin pegarle al servidor; se amplía a ingredientes, alérgenos y etiquetas |
| Sección por categoría con conteo | 934–939 | Orienta al comensal |
| Etiquetas Popular / Nuevo / Promo / Recomendado | 963–973 | Vocabulario que el negocio ya usa (coincide con `badge` del premium) |
| Precio tachado y `-%` cuando hay `precio_original` | 979–994 | Promos legibles; se conserva como "antes/ahora" |
| Ficha de plato con nota para cocina | 1085–1098 | Casi todo pedido real lleva "sin cebolla" |
| Cantidad + barra inferior fija en móvil | 1102–1133 | Patrón correcto de pulgar |
| Drawer "Mi Pedido" con estado vacío y total | 1139–1171 | Se conserva el concepto; se reemplaza por el CartDrawer del premium |
| Modalidad sitio / llevar / delivery + mesa | 1645–1720 | Es el modelo mental del comensal |
| Envío por WhatsApp con código de pedido y respaldo `wa.me` directo | 1666–1721 | El canal que funciona hoy en Venezuela; se conserva y se registra el pedido |
| Aviso "local cerrado" que bloquea el envío | 1690, 1729 (`__tenantIsOpen`) | Evita pedidos a local cerrado; sube a la portada |
| Sugerencias de platos de la misma categoría | 944–949 (`siblings`) | Venta cruzada barata; se reemplaza por "combina con" real |

## Se mejora (y por qué)
1. **Precio en una sola moneda con símbolo suelto** (`$currencySymbol`, `formatPrice(..., true)` en 1708). Viola la regla sellada USD+Bs juntos y no conoce Divisa/Cashea. → `PrecioDual` en toda la carta.
2. **Carrito en variable global `cart = {}`** (1276): se pierde al recargar o al volver atrás. → `CartContext` del premium.
3. **Pedido bloqueado por plan** (`$isPlanAnual` esconde carrito y barra). En una carta, pedir es el producto. → la Carta no gatea el carrito por plan.
4. **Cada plato incrusta su JSON y el de sus "hermanos" en el `onclick`** (945–949): HTML pesado y frágil por las comillas. → datos por props y detalle por ruta `/p/[id]`.
5. **Sin modificadores estructurados**: hay `options` sueltas en el carrito (1322), pero no grupos obligatorios con mín/máx, extras con precio ni "quitar". No se auditó el editor de opciones. → grupos de modificadores (SPEC §6).
6. **Sin alérgenos ni etiquetas dietéticas** (solo 4 badges de marketing). → alérgenos + Picante / Vegetariano / Vegano / Sin gluten.
7. **Sin "agotado hoy"**: el plato existe o no. → estado agotado visible y no agregable.
8. **El horario no se ve en la portada** (solo bloquea al enviar). → estado Abierto/Cerrado + horario arriba.
9. **Mesa = campo de texto libre** (1715): se presta a errores y a pedidos falsos. → mesa en la URL firmada (QR).
10. **Aspecto anticuado**: Bebas Neue en todos lados (201–301), puntos de color por categoría de una paleta rotativa arbitraria (930), mezcla de Tailwind con estilos inline, drawer con glassmorphism pesado, foto de 96 px sin jerarquía. → dirección cálida propia (SPEC §3).
11. **Imágenes que se ocultan con `onerror`** y dejan huecos (956). → `ImgWithFallback` con marcador de plato.

## Se descarta
- Layout oscuro de marketing, nav "Planes/Demos/Ayuda", `motion.js` por CDN.
- Paleta de puntos por categoría y el naranja `#E8541A` como acento (la Carta usa su propia brasa, SPEC §3).

## Riesgo a tener presente
- `food-checkout` registra el pedido en el sistema de ORDENA. En ActivoPOS el equivalente ya existe: `POST /api/catalog/[slug]/order` (origin `catalog`, calcula `send_to_kds`). No se reutiliza código de ORDENA.
