# Qué quedó fuera del módulo Restaurante (R1–R5)

26 Nov 2026 · Lo que NO está construido, dicho sin adornos, para que nadie lo prometa.

## Decisiones de alcance (acordadas)

| Fuera | Por qué | Qué hay en su lugar |
|---|---|---|
| **Impresión térmica por estación** | el driver de impresión por estación no entró en R1–R5 | el KDS en pantalla; el recibo de la venta imprime como siempre (con mesa, mesonero y propina) |
| **Reservas de mesa con calendario** | las reservas del módulo `Reserva` son de otro dominio (kits con tallas) | marca manual "reservada" en la mesa, con nombre, teléfono y hora |
| **Cargo por servicio propio del módulo** | decisión de Carlos: no | el cargo global del POS (`/api/sales/[id]/cargo`) sigue disponible para el cajero; la propina es aparte y voluntaria |
| **Ruteo de pedidos de WhatsApp/catálogo a estaciones** | acordado: el KDS actual sigue igual para esos pedidos | conviven: pedidos normales en el KDS de siempre (`/kds?vista=pedidos`), mesas por estación |

## Límites de esta versión

- **Dividir con cantidades fraccionarias en pantalla.** El servidor ya lo acepta (`quantity` con 3 decimales por ítem en `POST /cuentas/[id]/dividir`),
  pero la pantalla asigna líneas completas a cada subcuenta. Para compartir un plato entre dos subcuentas hoy se usan "partes iguales".
- **Máximo 10 pagos por venta** (límite de `/pay`). Partes iguales llega a 10; más comensales pagando por separado se resuelven dividiendo por ítems.
- **Tope de 10 usuarios** por negocio en el plan Operación: mesoneros y cocineros cuentan.
- **Variantes y stock por modificador** no se manejan en la cuenta de mesa: el modificador suma precio, no descuenta inventario propio.
- **Propina**: se registra después de cobrar, sin tope de porcentaje configurable (máximo: el total de la venta). Si se anula la venta, la propina
  deja de contarse (también en el efectivo esperado de caja).
- **Cobro de otro cajero**: `/pay` solo deja cobrar a quien creó la venta (o a quien tiene su caja); si el cajero A genera el cobro y el B intenta pagarlo, recibe 403.
- **Una cuenta con cobros no se edita**: para cambiar ítems un admin la reabre (cancela los cobros pendientes; las ventas pagadas se anulan primero en el POS).
- **Juntar cuentas** exige el mismo modo de precio y que ninguna tenga cobros. No se puede separar después.
- **Sin tiempo real por WebSocket**: sondeo con cursor (KDS cada 3 s, plano 5 s, cuenta 4 s). Si un negocio supera ~10 pantallas, pasar a SSE.
- **Reportes**: rango máximo de 366 días; rotación y tiempos se calculan sobre cuentas cerradas y comandas listas del rango.

## Pendiente de verificación (no bloquea, pero no se afirma)

- Specs de **Pedidos y Caja** de `main` y los `planes-v2*.spec` no corren con la base de este entorno (usan el tenant 80 y datos de otra carpeta).
- `test:consistency` se corrió en un tenant propio (101): 115/115. En el negocio 87 falla por saldos acumulados, ajeno al módulo.
- Hueco de `main`: `Sale.cargo_pct` sin migración (ver `CHECKLIST_Deploy_VPS.md`).
