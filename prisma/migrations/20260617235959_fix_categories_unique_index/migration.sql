-- Fix drift: add unique index on categories(business_id, name) that existed in DB but was missing from migration history
CREATE UNIQUE INDEX `categories_business_id_name_key` ON `categories`(`business_id`, `name`);
