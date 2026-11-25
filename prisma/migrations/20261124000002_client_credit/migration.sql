-- Crédito del cliente (pedidos): autorización y tope en USD. Aditivo, sin tocar filas existentes.
ALTER TABLE `clients`
  ADD COLUMN `credit_authorized` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `credit_limit_usd` DECIMAL(10, 2) NULL;
