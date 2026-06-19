-- AlterTable
ALTER TABLE `gastos` ADD COLUMN `category_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `expense_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `color` VARCHAR(7) NULL,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `expense_categories_business_id_name_key`(`business_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `expense_categories` ADD CONSTRAINT `expense_categories_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gastos` ADD CONSTRAINT `gastos_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
