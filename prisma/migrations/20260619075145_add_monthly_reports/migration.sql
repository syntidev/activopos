-- AlterTable
ALTER TABLE `businesses` ADD COLUMN `whatsapp` VARCHAR(30) NULL;

-- CreateTable
CREATE TABLE `monthly_reports` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `period` VARCHAR(7) NOT NULL,
    `status` ENUM('pending', 'generating', 'ready', 'failed') NOT NULL DEFAULT 'pending',
    `file_path` VARCHAR(191) NULL,
    `download_token` VARCHAR(191) NULL,
    `token_expires_at` DATETIME(3) NULL,
    `generated_at` DATETIME(3) NULL,
    `notified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `monthly_reports_download_token_key`(`download_token`),
    INDEX `monthly_reports_business_id_idx`(`business_id`),
    INDEX `monthly_reports_status_idx`(`status`),
    INDEX `monthly_reports_download_token_idx`(`download_token`),
    UNIQUE INDEX `monthly_reports_business_id_period_key`(`business_id`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `monthly_reports` ADD CONSTRAINT `monthly_reports_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
