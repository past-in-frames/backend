-- AlterTable
ALTER TABLE `story_sources` DROP COLUMN `type`,
    DROP COLUMN `subtype`;

-- AlterTable
ALTER TABLE `stories` ADD COLUMN `type` VARCHAR(191) NULL,
    ADD COLUMN `subtype` VARCHAR(191) NULL;
