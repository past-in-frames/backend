-- AlterTable
ALTER TABLE `story_sources`
    ADD COLUMN `type` VARCHAR(191) NULL,
    ADD COLUMN `subtype` VARCHAR(191) NULL;
