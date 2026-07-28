-- Preserva el comportamiento actual de los negocios que ya existen.
--
-- La migración 20260727000004 creó catalog_default_currency con DEFAULT 'usd',
-- lo que habría cambiado en silencio lo que muestra el catálogo de cada
-- negocio activo: hoy todos ven USD y Bs juntos. Este UPDATE los deja en
-- 'both', que es exactamente lo que venían mostrando. Nadie se entera de que
-- la config existe hasta que decida cambiarla.
--
-- El DEFAULT 'usd' del schema queda intacto y aplica solo a negocios que se
-- registren de ahora en adelante — ahí sí la evidencia de mercado
-- (tuproveedor.com.ve, MercadoLibre Venezuela) dice que solo divisas es el
-- arranque correcto.
--
-- Va como migración aparte y no editando la 004 porque esa ya se aplicó y se
-- pusheó: cambiarle el contenido altera su checksum en _prisma_migrations y
-- `migrate deploy` aborta en el VPS.
--
-- Corre inmediatamente después de la 004 en el mismo `migrate deploy`, así
-- que no hay ventana donde un negocio nuevo se cree y quede pisado por error.
UPDATE `businesses`
SET `catalog_default_currency` = 'both'
WHERE `catalog_default_currency` = 'usd';
