-- AlterTable
ALTER TABLE `story_media` ADD COLUMN `media_key` VARCHAR(191) NOT NULL,
    MODIFY `url` VARCHAR(512) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `story_media_story_id_media_key_key` ON `story_media`(`story_id`, `media_key`);
