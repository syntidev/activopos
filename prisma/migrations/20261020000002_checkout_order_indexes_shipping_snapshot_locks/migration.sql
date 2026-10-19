-- Checkout público (auditoría CLI-C sobre la Task 2): índices del tope de pedidos abiertos, método de envío congelado en el pedido
-- y tabla de llaves de serialización por cliente (reemplaza el FOR UPDATE sobre businesses). Solo cambios aditivos: sin pérdida de datos.
-- AlterTable
ALTER TABLE `orders` ADD COLUMN `ship_metodo_kind` VARCHAR(20) NULL,
    ADD COLUMN `ship_metodo_label` VARCHAR(120) NULL;
-- CreateIndex
CREATE INDEX `orders_business_id_client_cedula_idx` ON `orders`(`business_id`, `client_cedula`);
-- CreateIndex
CREATE INDEX `orders_business_id_client_phone_idx` ON `orders`(`business_id`, `client_phone`);
-- CreateTable (sin FK a businesses a propósito: una FK tomaría el lock compartido sobre la fila del negocio)
CREATE TABLE `web_order_locks` (
    `business_id` INTEGER NOT NULL,
    `lock_key` VARCHAR(60) NOT NULL,
    `touched_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`business_id`, `lock_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
