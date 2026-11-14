PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text,
	`description` text,
	`max_stack` integer,
	`equip_character` text,
	`equip_slot` text,
	`synth_category` text,
	`synth_point_cost` integer,
	`synth_attack` integer,
	`synth_flame` integer,
	`synth_chill` integer,
	`synth_lightning` integer,
	`synth_cyclone` integer,
	`synth_smash` integer,
	`synth_exorcism` integer,
	`synth_beast` integer,
	`synth_scale` integer,
	`synth_durability` integer,
	`ability_id` text,
	`powerup_character` text,
	`powerup_stat` text,
	`powerup_amount` integer,
	FOREIGN KEY (`ability_id`) REFERENCES `abilities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "items_id" CHECK("__new_items"."id" GLOB '[a-z0-9]*' AND "__new_items"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "items_type" CHECK("__new_items"."type" IN ('material', 'functional', 'clothing', 'coin', 'badge', 'fishing', 'ridepod-accessory', 'synth-only')),
	CONSTRAINT "items_equip_character" CHECK("__new_items"."equip_character" IN ('max', 'monica')),
	CONSTRAINT "items_equip_slot" CHECK("__new_items"."equip_slot" IN ('clothes', 'hat', 'hair-ornament', 'shoes')),
	CONSTRAINT "items_equip" CHECK(("__new_items"."equip_character" IS NULL) + ("__new_items"."equip_slot" IS NULL) IN (0, 2)),
	CONSTRAINT "items_synth_category" CHECK("__new_items"."synth_category" IN ('attack', 'flame', 'chill', 'lightning', 'cyclone', 'smash', 'exorcism', 'beast', 'scale', 'gems', 'durable')),
	CONSTRAINT "items_synth_point_cost" CHECK("__new_items"."synth_point_cost" >= 0),
	CONSTRAINT "items_max_stack" CHECK("__new_items"."max_stack" >= 1),
	CONSTRAINT "items_powerup_character" CHECK("__new_items"."powerup_character" IN ('max', 'monica', 'either')),
	CONSTRAINT "items_powerup_stat" CHECK("__new_items"."powerup_stat" IN ('hp', 'defense')),
	CONSTRAINT "items_powerup" CHECK(("__new_items"."powerup_character" IS NULL) + ("__new_items"."powerup_stat" IS NULL) + ("__new_items"."powerup_amount" IS NULL) IN (0, 3)),
	CONSTRAINT "items_powerup_amount" CHECK("__new_items"."powerup_amount" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_items`("id", "name", "type", "description", "max_stack", "equip_character", "equip_slot", "synth_category", "synth_point_cost", "synth_attack", "synth_flame", "synth_chill", "synth_lightning", "synth_cyclone", "synth_smash", "synth_exorcism", "synth_beast", "synth_scale", "synth_durability", "ability_id", "powerup_character", "powerup_stat", "powerup_amount") SELECT "id", "name", "type", "description", "max_stack", "equip_character", "equip_slot", "synth_category", "synth_point_cost", "synth_attack", "synth_flame", "synth_chill", "synth_lightning", "synth_cyclone", "synth_smash", "synth_exorcism", "synth_beast", "synth_scale", "synth_durability", "ability_id", "powerup_character", "powerup_stat", "powerup_amount" FROM `items`;--> statement-breakpoint
DROP TABLE `items`;--> statement-breakpoint
ALTER TABLE `__new_items` RENAME TO `items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `items_name_unique` ON `items` (`name`);