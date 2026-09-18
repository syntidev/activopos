-- CreateTable
CREATE TABLE `collections` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `slug` VARCHAR(60) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `collections_business_id_slug_key`(`business_id`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_collections` (
    `product_id` INTEGER NOT NULL,
    `collection_id` INTEGER NOT NULL,

    PRIMARY KEY (`product_id`, `collection_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `collections` ADD CONSTRAINT `collections_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_collections` ADD CONSTRAINT `product_collections_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_collections` ADD CONSTRAINT `product_collections_collection_id_fkey` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
