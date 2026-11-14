PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_chapters` (
	`number` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	CONSTRAINT "chapters_number" CHECK("__new_chapters"."number" BETWEEN 1 AND 8)
);
--> statement-breakpoint
INSERT INTO `__new_chapters`("number", "title") SELECT "number", "title" FROM `chapters`;--> statement-breakpoint
DROP TABLE `chapters`;--> statement-breakpoint
ALTER TABLE `__new_chapters` RENAME TO `chapters`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `enemies` DROP COLUMN `effectiveness_hammer`;