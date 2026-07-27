-- Panel de configuración del ticket térmico: reemplaza settings.ticket_currency
-- y settings.hide_rate (fachada — se persistían en el Json pero ningún renderer
-- las leía nunca) por columnas tipadas y realmente consumidas por
-- src/app/api/sales/[id]/ticket/route.ts.
--
-- Se eligieron columnas en `businesses` y no un modelo TicketDisplayConfig 1:1
-- porque el ticket ya lee `businesses` en el mismo query que arma el render,
-- así que no agrega join; porque ticket_prefix/ticket_footer ya viven acá y
-- rompen el patrón si la config hermana se va a otra tabla; y porque una fila
-- 1:1 opcional obliga a manejar "no existe todavía" en cada lectura, mientras
-- que columnas con DEFAULT no tienen ese estado nulo.
--
-- DEFAULTS = comportamiento actual exacto. Lo que hoy se imprime sigue
-- imprimiéndose y lo que no, no: description/customer_data/rif arrancan en
-- false porque el ticket nunca los mostró; el resto en true porque sí.
--
-- ticket_format arranca en '58mm' — no en el '80mm' que el form mostraba —
-- porque el render tenía el tamaño hardcodeado y SIEMPRE salió 58mm sin
-- importar lo guardado en settings. Respetar el valor viejo del Json cambiaría
-- el papel de negocios que llevan meses imprimiendo 58mm. Con el selector ya
-- cableado, quien quiera otro formato lo elige y ahora sí se respeta.
ALTER TABLE `businesses`
  ADD COLUMN `ticket_format`              VARCHAR(10) NOT NULL DEFAULT '58mm',
  ADD COLUMN `ticket_show_description`    BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN `ticket_show_bs`             BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN `ticket_show_foreign`        BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN `ticket_foreign_format`      VARCHAR(5)  NOT NULL DEFAULT 'usd',
  ADD COLUMN `ticket_show_address`        BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN `ticket_show_phone`          BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN `ticket_show_customer_data`  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN `ticket_show_rif`            BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN `ticket_show_cashier_name`   BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN `ticket_show_bcv_rate`       BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN `ticket_show_payment_method` BOOLEAN     NOT NULL DEFAULT true;

-- Limpia las tres claves fachada del Json. `settings` conserva el resto
-- (pin, etc.). JSON_REMOVE sobre NULL devuelve NULL, de ahí el guard.
UPDATE `businesses`
SET `settings` = JSON_REMOVE(`settings`, '$.ticket_currency', '$.hide_rate', '$.ticket_format')
WHERE `settings` IS NOT NULL;
