PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_georama_goals` (
	`id` integer PRIMARY KEY NOT NULL,
	`task_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`georama_part_id` text,
	`part_category` text,
	`relation` text,
	`related_georama_part_id` text,
	`color` text,
	`quantity` integer,
	`npc_id` text,
	`required_task_id` integer,
	`culture_points` integer,
	`section_id` text,
	FOREIGN KEY (`task_id`) REFERENCES `georama_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`georama_part_id`) REFERENCES `georama_parts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`related_georama_part_id`) REFERENCES `georama_parts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`npc_id`) REFERENCES `npcs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`required_task_id`) REFERENCES `georama_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "georama_goals_type" CHECK("__new_georama_goals"."type" IN ('parts-placed', 'npc-resides', 'residents', 'task-completed', 'culture-points', 'story-event', 'other')),
	CONSTRAINT "georama_goals_relation" CHECK("__new_georama_goals"."relation" IN ('on', 'near', 'between', 'around')),
	CONSTRAINT "georama_goals_related_part" CHECK(("__new_georama_goals"."relation" IS NULL) + ("__new_georama_goals"."related_georama_part_id" IS NULL) IN (0, 2)),
	CONSTRAINT "georama_goals_quantity" CHECK("__new_georama_goals"."quantity" >= 1),
	CONSTRAINT "georama_goals_culture_points" CHECK("__new_georama_goals"."culture_points" >= 1),
	CONSTRAINT "georama_goals_link_matches_type" CHECK(("__new_georama_goals"."type" <> 'parts-placed' OR (("__new_georama_goals"."georama_part_id" IS NOT NULL OR "__new_georama_goals"."part_category" IS NOT NULL) AND "__new_georama_goals"."quantity" IS NOT NULL)) AND ("__new_georama_goals"."type" <> 'npc-resides' OR ("__new_georama_goals"."npc_id" IS NOT NULL)) AND ("__new_georama_goals"."type" <> 'residents' OR ("__new_georama_goals"."quantity" IS NOT NULL)) AND ("__new_georama_goals"."type" <> 'task-completed' OR ("__new_georama_goals"."required_task_id" IS NOT NULL)) AND ("__new_georama_goals"."type" <> 'culture-points' OR ("__new_georama_goals"."culture_points" IS NOT NULL)) AND ("__new_georama_goals"."type" <> 'story-event' OR ("__new_georama_goals"."section_id" IS NOT NULL)))
);
--> statement-breakpoint
INSERT INTO `__new_georama_goals`("id", "task_id", "name", "type", "georama_part_id", "part_category", "relation", "related_georama_part_id", "color", "quantity", "npc_id", "required_task_id", "culture_points", "section_id") SELECT "id", "task_id", "name", "type", "georama_part_id", NULL, "relation", "related_georama_part_id", "color", "quantity", "npc_id", "required_task_id", "culture_points", "section_id" FROM `georama_goals`;--> statement-breakpoint
DROP TABLE `georama_goals`;--> statement-breakpoint
ALTER TABLE `__new_georama_goals` RENAME TO `georama_goals`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_monster_class_unlocks` (
	`id` integer PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`method` text NOT NULL,
	`item_id` text NOT NULL,
	`enemy_id` text,
	`quantity` integer,
	FOREIGN KEY (`class_id`) REFERENCES `monster_classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`enemy_id`) REFERENCES `enemies`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "monster_class_unlocks_method" CHECK("__new_monster_class_unlocks"."method" IN ('buy', 'gift', 'kill-with')),
	CONSTRAINT "monster_class_unlocks_quantity" CHECK("__new_monster_class_unlocks"."quantity" >= 1),
	CONSTRAINT "monster_class_unlocks_link_matches_method" CHECK(("__new_monster_class_unlocks"."method" <> 'buy' OR ("__new_monster_class_unlocks"."enemy_id" IS NULL AND "__new_monster_class_unlocks"."quantity" IS NULL)) AND ("__new_monster_class_unlocks"."method" <> 'gift' OR ("__new_monster_class_unlocks"."enemy_id" IS NOT NULL AND "__new_monster_class_unlocks"."quantity" IS NOT NULL)) AND ("__new_monster_class_unlocks"."method" <> 'kill-with' OR ("__new_monster_class_unlocks"."enemy_id" IS NOT NULL AND "__new_monster_class_unlocks"."quantity" IS NULL)))
);
--> statement-breakpoint
INSERT INTO `__new_monster_class_unlocks`("id", "class_id", "method", "item_id", "enemy_id", "quantity") SELECT "id", "class_id", "method", "item_id", "enemy_id", "quantity" FROM `monster_class_unlocks`;--> statement-breakpoint
DROP TABLE `monster_class_unlocks`;--> statement-breakpoint
ALTER TABLE `__new_monster_class_unlocks` RENAME TO `monster_class_unlocks`;--> statement-breakpoint
CREATE TABLE `__new_npc_housing_requirements` (
	`id` integer PRIMARY KEY NOT NULL,
	`npc_id` text NOT NULL,
	`type` text NOT NULL,
	`georama_part_id` text,
	`color` text,
	`quantity` integer,
	`text` text,
	FOREIGN KEY (`npc_id`) REFERENCES `npcs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`georama_part_id`) REFERENCES `georama_parts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "npc_housing_requirements_type" CHECK("__new_npc_housing_requirements"."type" IN ('near-part', 'in-part', 'not-in-part', 'roof-color', 'minimum-stories', 'other')),
	CONSTRAINT "npc_housing_requirements_link_matches_type" CHECK(("__new_npc_housing_requirements"."type" <> 'near-part' OR ("__new_npc_housing_requirements"."georama_part_id" IS NOT NULL)) AND ("__new_npc_housing_requirements"."type" <> 'in-part' OR ("__new_npc_housing_requirements"."georama_part_id" IS NOT NULL)) AND ("__new_npc_housing_requirements"."type" <> 'not-in-part' OR ("__new_npc_housing_requirements"."georama_part_id" IS NOT NULL)) AND ("__new_npc_housing_requirements"."type" <> 'roof-color' OR ("__new_npc_housing_requirements"."color" IS NOT NULL)) AND ("__new_npc_housing_requirements"."type" <> 'minimum-stories' OR ("__new_npc_housing_requirements"."quantity" IS NOT NULL)) AND ("__new_npc_housing_requirements"."type" <> 'other' OR ("__new_npc_housing_requirements"."text" IS NOT NULL)))
);
--> statement-breakpoint
INSERT INTO `__new_npc_housing_requirements`("id", "npc_id", "type", "georama_part_id", "color", "quantity", "text") SELECT "id", "npc_id", "type", "georama_part_id", "color", "quantity", "text" FROM `npc_housing_requirements`;--> statement-breakpoint
DROP TABLE `npc_housing_requirements`;--> statement-breakpoint
ALTER TABLE `__new_npc_housing_requirements` RENAME TO `npc_housing_requirements`;--> statement-breakpoint
CREATE TABLE `__new_recruit_requirements` (
	`id` integer PRIMARY KEY NOT NULL,
	`npc_id` text NOT NULL,
	`type` text NOT NULL,
	`item_id` text,
	`weapon_id` text,
	`photo_id` text,
	`fish_id` text,
	`minimum_centimeters` integer,
	`contest_class_id` integer,
	`quantity` integer,
	`seconds` integer,
	`text` text,
	FOREIGN KEY (`npc_id`) REFERENCES `recruits`(`npc_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`weapon_id`) REFERENCES `weapons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fish_id`) REFERENCES `fish`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contest_class_id`) REFERENCES `fishing_contest_classes`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "recruit_requirements_type" CHECK("__new_recruit_requirements"."type" IN ('give-item', 'show-item', 'show-weapon', 'show-photo', 'catch-fish', 'pay-gilda', 'win-contest', 'win-spheda', 'beat-time', 'enter-code', 'story', 'other')),
	CONSTRAINT "recruit_requirements_quantity" CHECK("__new_recruit_requirements"."quantity" >= 1),
	CONSTRAINT "recruit_requirements_minimum_centimeters" CHECK("__new_recruit_requirements"."minimum_centimeters" >= 1),
	CONSTRAINT "recruit_requirements_seconds" CHECK("__new_recruit_requirements"."seconds" >= 1),
	CONSTRAINT "recruit_requirements_link_matches_type" CHECK(("__new_recruit_requirements"."type" <> 'give-item' OR ("__new_recruit_requirements"."item_id" IS NOT NULL AND "__new_recruit_requirements"."quantity" IS NOT NULL)) AND ("__new_recruit_requirements"."type" <> 'show-item' OR ("__new_recruit_requirements"."item_id" IS NOT NULL)) AND ("__new_recruit_requirements"."type" <> 'show-weapon' OR ("__new_recruit_requirements"."weapon_id" IS NOT NULL)) AND ("__new_recruit_requirements"."type" <> 'show-photo' OR ("__new_recruit_requirements"."photo_id" IS NOT NULL)) AND ("__new_recruit_requirements"."type" <> 'catch-fish' OR ("__new_recruit_requirements"."fish_id" IS NOT NULL)) AND ("__new_recruit_requirements"."type" <> 'pay-gilda' OR ("__new_recruit_requirements"."quantity" IS NOT NULL)) AND ("__new_recruit_requirements"."type" <> 'win-spheda' OR ("__new_recruit_requirements"."quantity" IS NOT NULL)) AND ("__new_recruit_requirements"."type" <> 'beat-time' OR ("__new_recruit_requirements"."seconds" IS NOT NULL)) AND ("__new_recruit_requirements"."type" <> 'enter-code' OR ("__new_recruit_requirements"."text" IS NOT NULL)) AND ("__new_recruit_requirements"."type" <> 'story' OR ("__new_recruit_requirements"."text" IS NOT NULL)) AND ("__new_recruit_requirements"."type" <> 'other' OR ("__new_recruit_requirements"."text" IS NOT NULL)))
);
--> statement-breakpoint
INSERT INTO `__new_recruit_requirements`("id", "npc_id", "type", "item_id", "weapon_id", "photo_id", "fish_id", "minimum_centimeters", "contest_class_id", "quantity", "seconds", "text") SELECT "id", "npc_id", "type", "item_id", "weapon_id", "photo_id", "fish_id", "minimum_centimeters", "contest_class_id", "quantity", "seconds", "text" FROM `recruit_requirements`;--> statement-breakpoint
DROP TABLE `recruit_requirements`;--> statement-breakpoint
ALTER TABLE `__new_recruit_requirements` RENAME TO `recruit_requirements`;--> statement-breakpoint
CREATE TABLE `__new_weapons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`character` text NOT NULL,
	`type` text NOT NULL,
	`sub_type` text,
	`combo` text,
	`description` text,
	`attack_varies_by_time` integer DEFAULT false NOT NULL,
	`base_abs` real NOT NULL,
	`synth_points_per_level` integer NOT NULL,
	`base_synth_points` integer NOT NULL,
	`max_durability` integer NOT NULL,
	`base_attack` integer NOT NULL,
	`base_flame` integer NOT NULL,
	`base_chill` integer NOT NULL,
	`base_lightning` integer NOT NULL,
	`base_cyclone` integer NOT NULL,
	`base_smash` integer NOT NULL,
	`base_exorcism` integer NOT NULL,
	`base_beast` integer NOT NULL,
	`base_scale` integer NOT NULL,
	`max_attack` integer NOT NULL,
	`max_flame` integer NOT NULL,
	`max_chill` integer NOT NULL,
	`max_lightning` integer NOT NULL,
	`max_cyclone` integer NOT NULL,
	`max_smash` integer NOT NULL,
	`max_exorcism` integer NOT NULL,
	`max_beast` integer NOT NULL,
	`max_scale` integer NOT NULL,
	CONSTRAINT "weapons_id" CHECK("__new_weapons"."id" GLOB '[a-z0-9]*' AND "__new_weapons"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "weapons_character" CHECK("__new_weapons"."character" IN ('max', 'monica')),
	CONSTRAINT "weapons_type" CHECK("__new_weapons"."type" IN ('wrench', 'gun', 'club', 'sword', 'armband')),
	CONSTRAINT "weapons_base_abs" CHECK("__new_weapons"."base_abs" >= 0),
	CONSTRAINT "weapons_synth_points_per_level" CHECK("__new_weapons"."synth_points_per_level" >= 1),
	CONSTRAINT "weapons_max_durability" CHECK("__new_weapons"."max_durability" >= 1),
	CONSTRAINT "weapons_sub_type_matches_type" CHECK("__new_weapons"."sub_type" IS NULL OR ("__new_weapons"."type" = 'gun' AND "__new_weapons"."sub_type" IN ('normal', 'machine-gun', 'grenade', 'beam')) OR ("__new_weapons"."type" = 'wrench' AND "__new_weapons"."sub_type" IN ('wrench', 'hammer')))
);
--> statement-breakpoint
INSERT INTO `__new_weapons`("id", "name", "character", "type", "sub_type", "combo", "description", "attack_varies_by_time", "base_abs", "synth_points_per_level", "base_synth_points", "max_durability", "base_attack", "base_flame", "base_chill", "base_lightning", "base_cyclone", "base_smash", "base_exorcism", "base_beast", "base_scale", "max_attack", "max_flame", "max_chill", "max_lightning", "max_cyclone", "max_smash", "max_exorcism", "max_beast", "max_scale") SELECT "id", "name", "character", "type", "sub_type", "combo", "description", "attack_varies_by_time", "base_abs", "synth_points_per_level", "base_synth_points", "max_durability", "base_attack", "base_flame", "base_chill", "base_lightning", "base_cyclone", "base_smash", "base_exorcism", "base_beast", "base_scale", "max_attack", "max_flame", "max_chill", "max_lightning", "max_cyclone", "max_smash", "max_exorcism", "max_beast", "max_scale" FROM `weapons`;--> statement-breakpoint
DROP TABLE `weapons`;--> statement-breakpoint
ALTER TABLE `__new_weapons` RENAME TO `weapons`;--> statement-breakpoint
CREATE UNIQUE INDEX `weapons_name_unique` ON `weapons` (`name`);