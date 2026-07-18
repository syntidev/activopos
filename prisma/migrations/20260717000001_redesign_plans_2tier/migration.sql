-- Rediseño a 2 planes: gratis (imán de conversión, nunca vence) + negocio_activo ($19/mes).
-- Migra tenants existentes de los 4 tiers viejos a los 2 nuevos.

-- Todo plan pago viejo -> negocio_activo (conservan features y subscription_expires_at)
UPDATE `businesses` SET `catalog_plan` = 'negocio_activo'
  WHERE `catalog_plan` IN ('inicio', 'pro', 'business');

-- trial / nulos -> gratis (plan permanente sin vencimiento)
UPDATE `businesses` SET `catalog_plan` = 'gratis'
  WHERE `catalog_plan` = 'trial' OR `catalog_plan` IS NULL;

-- Nuevo default para altas futuras
ALTER TABLE `businesses` ALTER COLUMN `catalog_plan` SET DEFAULT 'gratis';

-- Cuenta de cobro de la plataforma (ActivoPOS) para suscripciones — fila única.
CREATE TABLE `platform_payment_config` (
  `id`               INT          NOT NULL AUTO_INCREMENT,
  `binance_pay_id`   VARCHAR(120) NULL,
  `binance_qr_path`  VARCHAR(500) NULL,
  `pago_movil_phone` VARCHAR(30)  NULL,
  `pago_movil_ci`    VARCHAR(30)  NULL,
  `pago_movil_bank`  VARCHAR(80)  NULL,
  `usdt_wallet`      VARCHAR(120) NULL,
  `usdt_network`     VARCHAR(40)  NULL,
  `instructions`     TEXT         NULL,
  `active`           BOOLEAN      NOT NULL DEFAULT true,
  `updated_at`       DATETIME(3)  NOT NULL,
  `created_at`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
