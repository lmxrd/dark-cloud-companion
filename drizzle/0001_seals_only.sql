PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_number` integer NOT NULL,
	`dungeon_id` text,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`optional` integer DEFAULT false NOT NULL,
	`closed_after_section_id` text,
	`time_limit_seconds` integer,
	`medal_time_attack_seconds` integer,
	`medal_clear_goal` text,
	`medal_fishing_centimeters` integer,
	`restriction` text,
	`has_geostone` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`chapter_number`) REFERENCES `chapters`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dungeon_id`) REFERENCES `dungeons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`closed_after_section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sections_id" CHECK("__new_sections"."id" GLOB '[a-z0-9]*' AND "__new_sections"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "sections_type" CHECK("__new_sections"."type" IN ('story', 'dungeon', 'boss', 'interlude')),
	CONSTRAINT "sections_medal_clear_goal" CHECK("__new_sections"."medal_clear_goal" IN ('items-only', 'ridepod-only', 'no-healing', 'max-close-range-weapon-only', 'max-gun-only', 'monica-sword-only', 'monica-magic-only', 'monster-transformation-only')),
	CONSTRAINT "sections_restriction" CHECK("__new_sections"."restriction" IN ('white-seal', 'blue-seal', 'red-seal')),
	CONSTRAINT "sections_time_limit_seconds" CHECK("__new_sections"."time_limit_seconds" >= 1),
	CONSTRAINT "sections_medal_time_attack_seconds" CHECK("__new_sections"."medal_time_attack_seconds" >= 1),
	CONSTRAINT "sections_medal_fishing_centimeters" CHECK("__new_sections"."medal_fishing_centimeters" >= 1),
	CONSTRAINT "sections_dungeon_floor_only" CHECK("__new_sections"."dungeon_id" IS NOT NULL OR ("__new_sections"."medal_time_attack_seconds" IS NULL AND "__new_sections"."medal_clear_goal" IS NULL AND "__new_sections"."medal_fishing_centimeters" IS NULL AND "__new_sections"."has_geostone" = 0))
);
--> statement-breakpoint
INSERT INTO `__new_sections`("id", "chapter_number", "dungeon_id", "position", "title", "type", "optional", "closed_after_section_id", "time_limit_seconds", "medal_time_attack_seconds", "medal_clear_goal", "medal_fishing_centimeters", "restriction", "has_geostone") SELECT "id", "chapter_number", "dungeon_id", "position", "title", "type", "optional", "closed_after_section_id", "time_limit_seconds", "medal_time_attack_seconds", "medal_clear_goal", "medal_fishing_centimeters", "restriction", "has_geostone" FROM `sections`;--> statement-breakpoint
DROP TABLE `sections`;--> statement-breakpoint
ALTER TABLE `__new_sections` RENAME TO `sections`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `sections_chapter_position` ON `sections` (`chapter_number`,`position`);