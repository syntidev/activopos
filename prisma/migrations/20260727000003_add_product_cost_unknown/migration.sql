-- Costo opcional: hay productos y servicios cuyo costo el negocio no conoce.
-- Se modela como flag aparte y no como cost_per_unit_usd = 0, porque un 0 es
-- un costo real válido (muestra gratis, producto regalado) y ensuciaría el
-- margen promedio con 100% de utilidad falsa. Con el flag, esos productos
-- salen del cálculo en vez de distorsionarlo.
--
-- cost_per_unit_usd ya era nullable antes de este cambio: el flag es lo que
-- distingue "no lo sé" de "todavía no lo cargué".
--
-- DEFAULT false: los productos existentes tienen costo conocido y siguen
-- entrando al margen exactamente como hasta ahora.
--
-- La columna se creó en desarrollo con `prisma db push` antes de que
-- existiera esta migración, así que acá quedó marcada como aplicada con
-- `prisma migrate resolve --applied`. En el VPS la crea este ALTER.
ALTER TABLE `products`
  ADD COLUMN `cost_unknown` BOOLEAN NOT NULL DEFAULT false;
