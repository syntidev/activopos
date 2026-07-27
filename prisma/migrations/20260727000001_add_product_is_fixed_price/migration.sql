-- Persiste el modo de precio elegido por el usuario: fijo (escribe el precio a
-- mano, el margen se deriva) vs por margen (escribe el margen, el precio se
-- deriva). Antes vivía solo en el estado del form y se perdía al guardar, así
-- que al reabrir un producto el toggle siempre volvía a margen.
--
-- No es derivable desde los datos: costo y precio se guardan igual en ambos
-- modos, así que dos productos con los mismos números son indistinguibles.
-- Por eso hace falta la columna y no una heurística.
--
-- DEFAULT false: las filas existentes quedan en modo margen, que es el
-- comportamiento que la UI ya les daba al reabrirlas. Nadie cambia de estado.
--
-- El schema se sincronizó local con `prisma db push` antes de que existiera
-- esta migración, así que en desarrollo la columna ya está y esta migración
-- quedó marcada como aplicada con `prisma migrate resolve --applied`. En el
-- VPS, donde la columna no existe, `migrate deploy` la crea con este ALTER.
ALTER TABLE `products`
  ADD COLUMN `is_fixed_price` BOOLEAN NOT NULL DEFAULT false;
