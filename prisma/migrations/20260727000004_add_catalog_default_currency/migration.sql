-- Moneda visible en el catálogo público y en el mensaje de WhatsApp del
-- pedido. Excepción autorizada a la regla dual-currency del proyecto: aplica
-- SOLO a superficies cara-al-cliente. El POS, el dashboard, el ticket térmico
-- y la factura siguen mostrando USD y Bs juntos, sin condicional.
--
-- OJO — este default SÍ cambia lo que ya se ve. Hasta ahora el catálogo
-- mostraba siempre ambas monedas; con 'usd' los negocios existentes pasan a
-- mostrar solo divisas sin haberlo elegido. Es deliberado y autorizado: la
-- evidencia de mercado (tuproveedor.com.ve, MercadoLibre Venezuela) muestra
-- solo USD. Quien quiera el comportamiento viejo elige 'both' en
-- Configuración > Empresa.
ALTER TABLE `businesses`
  ADD COLUMN `catalog_default_currency` VARCHAR(5) NOT NULL DEFAULT 'usd';
