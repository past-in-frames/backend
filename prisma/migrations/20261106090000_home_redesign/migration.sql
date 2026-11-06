-- AlterTable
ALTER TABLE `stories`
    ADD COLUMN `region` VARCHAR(16) NULL,
    ADD COLUMN `is_photo_story` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `story_topics` (
    `story_id` INTEGER NOT NULL,
    `topic` VARCHAR(32) NOT NULL,

    INDEX `story_topics_topic_idx`(`topic`),
    PRIMARY KEY (`story_id`, `topic`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collections` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `cover_url` VARCHAR(512) NULL,
    `status` ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `collections_slug_key`(`slug`),
    INDEX `collections_status_sort_order_idx`(`status`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collection_stories` (
    `collection_id` INTEGER NOT NULL,
    `story_id` INTEGER NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `collection_stories_story_id_idx`(`story_id`),
    PRIMARY KEY (`collection_id`, `story_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `story_topics` ADD CONSTRAINT `story_topics_story_id_fkey` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collection_stories` ADD CONSTRAINT `collection_stories_collection_id_fkey` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collection_stories` ADD CONSTRAINT `collection_stories_story_id_fkey` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
