-- Módulo Reservas (preventa 200K): tabla `reservas`, feature flag por negocio
-- `businesses.reservas_enabled` (default false) y el rol restringido
-- `operador_reservas` en el enum de `users.role`.
--
-- Producción ya tiene estos objetos (se aplicaron con `db push`). Ahí NO se ejecuta:
--   npx prisma migrate resolve --applied 20260920000002_add_reservas
-- En una base que no los tiene, `migrate deploy` los crea. Es aditivo: no borra ni
-- reescribe datos. MODIFY del ENUM solo AGREGA un valor al final (los usuarios
-- existentes conservan su rol).

-- AlterTable
ALTER TABLE `businesses` ADD COLUMN `reservas_enabled` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `users` MODIFY `role` ENUM('super_admin', 'admin', 'cashier', 'operador_reservas') NOT NULL DEFAULT 'cashier';

-- CreateTable
CREATE TABLE `reservas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `ticket_number` VARCHAR(30) NOT NULL,
    `cliente_nombre` VARCHAR(120) NOT NULL,
    `cliente_telefono` VARCHAR(30) NULL,
    `kit_id` INTEGER NOT NULL,
    `talla` VARCHAR(20) NULL,
    `cantidad` INTEGER NOT NULL DEFAULT 1,
    `extras` JSON NULL,
    `armado` BOOLEAN NOT NULL DEFAULT false,
    `entregado` BOOLEAN NOT NULL DEFAULT false,
    `entregado_foto` VARCHAR(500) NULL,
    `pagado` BOOLEAN NOT NULL DEFAULT false,
    `pagado_monto` DECIMAL(10, 2) NULL,
    `pagado_metodo` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `reservas_business_id_kit_id_idx`(`business_id`, `kit_id`),
    UNIQUE INDEX `reservas_business_id_ticket_number_key`(`business_id`, `ticket_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `reservas` ADD CONSTRAINT `reservas_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reservas` ADD CONSTRAINT `reservas_kit_id_fkey` FOREIGN KEY (`kit_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
