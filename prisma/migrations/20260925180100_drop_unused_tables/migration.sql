-- DropForeignKey
ALTER TABLE `_ArticleToTag` DROP FOREIGN KEY `_ArticleToTag_A_fkey`;

-- DropForeignKey
ALTER TABLE `_ArticleToTag` DROP FOREIGN KEY `_ArticleToTag_B_fkey`;

-- DropForeignKey
ALTER TABLE `Article` DROP FOREIGN KEY `Article_categoryId_fkey`;

-- DropForeignKey
ALTER TABLE `Article` DROP FOREIGN KEY `Article_authorId_fkey`;

-- DropTable
DROP TABLE `_ArticleToTag`;

-- DropTable
DROP TABLE `Article`;

-- DropTable
DROP TABLE `Category`;

-- DropTable
DROP TABLE `Author`;

-- DropTable
DROP TABLE `Tag`;

-- DropTable
DROP TABLE `Subscriber`;

-- DropTable
DROP TABLE `users`;
