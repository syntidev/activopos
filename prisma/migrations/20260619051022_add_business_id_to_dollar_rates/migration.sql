-- AlterTable
ALTER TABLE `dollar_rates` ADD COLUMN `business_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `dollar_rates` ADD CONSTRAINT `dollar_rates_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
