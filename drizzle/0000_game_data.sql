CREATE TABLE `abilities` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`opposite_id` text,
	FOREIGN KEY (`opposite_id`) REFERENCES `abilities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "abilities_id" CHECK("abilities"."id" GLOB '[a-z0-9]*' AND "abilities"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "abilities_not_own_opposite" CHECK("abilities"."opposite_id" <> "abilities"."id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `abilities_name_unique` ON `abilities` (`name`);--> statement-breakpoint
CREATE TABLE `chapters` (
	`number` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	CONSTRAINT "chapters_number" CHECK("chapters"."number" BETWEEN 1 AND 9)
);
--> statement-breakpoint
CREATE TABLE `dungeon_weapons` (
	`dungeon_id` text NOT NULL,
	`weapon_id` text NOT NULL,
	PRIMARY KEY(`dungeon_id`, `weapon_id`),
	FOREIGN KEY (`dungeon_id`) REFERENCES `dungeons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`weapon_id`) REFERENCES `weapons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `dungeons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`chapter_number` integer NOT NULL,
	`town_id` text,
	`position` integer NOT NULL,
	FOREIGN KEY (`chapter_number`) REFERENCES `chapters`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`town_id`) REFERENCES `towns`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dungeons_id" CHECK("dungeons"."id" GLOB '[a-z0-9]*' AND "dungeons"."id" NOT GLOB '*[^a-z0-9-]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dungeons_name_unique` ON `dungeons` (`name`);--> statement-breakpoint
CREATE TABLE `enemies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`variant_of_id` text,
	`variant_label` text,
	`type` text DEFAULT 'normal' NOT NULL,
	`class_id` text,
	`notes_number` integer,
	`photo_id` text,
	`hp` integer,
	`attack` integer,
	`defense` integer,
	`abs` integer,
	`gilda` integer,
	`effectiveness_wrench` integer,
	`effectiveness_hammer` integer,
	`effectiveness_sword` integer,
	`effectiveness_gun` integer,
	`effectiveness_beam` integer,
	`effectiveness_grenade` integer,
	`effectiveness_magic` integer,
	`effectiveness_ridepod` integer,
	`effectiveness_flame` integer,
	`effectiveness_chill` integer,
	`effectiveness_lightning` integer,
	`effectiveness_cyclone` integer,
	`effectiveness_smash` integer,
	`effectiveness_exorcism` integer,
	`effectiveness_beast` integer,
	`effectiveness_scale` integer,
	FOREIGN KEY (`variant_of_id`) REFERENCES `enemies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `monster_classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "enemies_id" CHECK("enemies"."id" GLOB '[a-z0-9]*' AND "enemies"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "enemies_type" CHECK("enemies"."type" IN ('normal', 'sub-boss', 'boss', 'mimic')),
	CONSTRAINT "enemies_variant" CHECK(("enemies"."variant_of_id" IS NULL) + ("enemies"."variant_label" IS NULL) IN (0, 2)),
	CONSTRAINT "enemies_not_own_variant" CHECK("enemies"."variant_of_id" <> "enemies"."id"),
	CONSTRAINT "enemies_notes_number" CHECK("enemies"."notes_number" >= 1),
	CONSTRAINT "enemies_hp" CHECK("enemies"."hp" >= 0),
	CONSTRAINT "enemies_attack" CHECK("enemies"."attack" >= 0),
	CONSTRAINT "enemies_defense" CHECK("enemies"."defense" >= 0),
	CONSTRAINT "enemies_abs" CHECK("enemies"."abs" >= 0),
	CONSTRAINT "enemies_gilda" CHECK("enemies"."gilda" >= 0)
);
--> statement-breakpoint
CREATE TABLE `enemy_drops` (
	`enemy_id` text NOT NULL,
	`item_id` text NOT NULL,
	`method` text,
	`chance_percent` real,
	PRIMARY KEY(`enemy_id`, `item_id`),
	FOREIGN KEY (`enemy_id`) REFERENCES `enemies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "enemy_drops_method" CHECK("enemy_drops"."method" IN ('steal', 'drop', 'rare-drop')),
	CONSTRAINT "enemy_drops_chance_percent" CHECK("enemy_drops"."chance_percent" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE `fish` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`reject_in` text,
	`item_id` text,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "fish_id" CHECK("fish"."id" GLOB '[a-z0-9]*' AND "fish"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "fish_reject_in" CHECK("fish"."reject_in" IN ('fresh', 'ocean'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fish_name_unique` ON `fish` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `fish_itemId_unique` ON `fish` (`item_id`);--> statement-breakpoint
CREATE TABLE `fish_breeding` (
	`parent_a_id` text NOT NULL,
	`parent_b_id` text NOT NULL,
	`child_id` text NOT NULL,
	PRIMARY KEY(`parent_a_id`, `parent_b_id`, `child_id`),
	FOREIGN KEY (`parent_a_id`) REFERENCES `fish`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_b_id`) REFERENCES `fish`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`child_id`) REFERENCES `fish`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fish_feed_effects` (
	`item_id` text NOT NULL,
	`stat` text NOT NULL,
	`change` text NOT NULL,
	PRIMARY KEY(`item_id`, `stat`),
	FOREIGN KEY (`item_id`) REFERENCES `fishing_tackle`(`item_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "fish_feed_effects_stat" CHECK("fish_feed_effects"."stat" IN ('boost', 'endurance', 'strength', 'tenacity', 'stamina', 'weight', 'gender')),
	CONSTRAINT "fish_feed_effects_change" CHECK("fish_feed_effects"."change" IN ('raise', 'lower', 'switch'))
);
--> statement-breakpoint
CREATE TABLE `fish_habitats` (
	`id` integer PRIMARY KEY NOT NULL,
	`fish_id` text NOT NULL,
	`section_id` text,
	`dungeon_id` text,
	`town_id` text,
	`spot` text,
	`from_hour` integer,
	`to_hour` integer,
	FOREIGN KEY (`fish_id`) REFERENCES `fish`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dungeon_id`) REFERENCES `dungeons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`town_id`) REFERENCES `towns`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "fish_habitats_place" CHECK(("fish_habitats"."section_id" IS NOT NULL) + ("fish_habitats"."dungeon_id" IS NOT NULL) + ("fish_habitats"."town_id" IS NOT NULL) = 1),
	CONSTRAINT "fish_habitats_hours" CHECK(("fish_habitats"."from_hour" IS NULL) + ("fish_habitats"."to_hour" IS NULL) IN (0, 2)),
	CONSTRAINT "fish_habitats_from_hour" CHECK("fish_habitats"."from_hour" BETWEEN 0 AND 23),
	CONSTRAINT "fish_habitats_to_hour" CHECK("fish_habitats"."to_hour" BETWEEN 0 AND 23)
);
--> statement-breakpoint
CREATE TABLE `fishing_contest_classes` (
	`id` integer PRIMARY KEY NOT NULL,
	`contest_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`contest_id`) REFERENCES `fishing_contests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fishing_contest_prizes` (
	`id` integer PRIMARY KEY NOT NULL,
	`contest_id` text NOT NULL,
	`class_id` integer,
	`place` integer NOT NULL,
	`prize_set` text NOT NULL,
	`item_id` text,
	`weapon_id` text,
	`ridepod_part_id` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`contest_id`) REFERENCES `fishing_contests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `fishing_contest_classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`weapon_id`) REFERENCES `weapons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ridepod_part_id`) REFERENCES `ridepod_parts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "fishing_contest_prizes_prize_set" CHECK("fishing_contest_prizes"."prize_set" IN ('first-win', 'pool')),
	CONSTRAINT "fishing_contest_prizes_place" CHECK("fishing_contest_prizes"."place" >= 1),
	CONSTRAINT "fishing_contest_prizes_one_reward" CHECK(("fishing_contest_prizes"."item_id" IS NOT NULL) + ("fishing_contest_prizes"."weapon_id" IS NOT NULL) + ("fishing_contest_prizes"."ridepod_part_id" IS NOT NULL) = 1),
	CONSTRAINT "fishing_contest_prizes_quantity" CHECK("fishing_contest_prizes"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE `fishing_contests` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`town_id` text,
	`interval_days` integer,
	`duration_hours` integer,
	`from_chapter_number` integer,
	`after_section_id` text,
	`after_recruit_npc_id` text,
	`after_georama_task_id` integer,
	`until_chapter_number` integer,
	`until_section_id` text,
	`until_recruit_npc_id` text,
	FOREIGN KEY (`town_id`) REFERENCES `towns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_chapter_number`) REFERENCES `chapters`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_recruit_npc_id`) REFERENCES `npcs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_georama_task_id`) REFERENCES `georama_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`until_chapter_number`) REFERENCES `chapters`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`until_section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`until_recruit_npc_id`) REFERENCES `npcs`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "fishing_contests_id" CHECK("fishing_contests"."id" GLOB '[a-z0-9]*' AND "fishing_contests"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "fishing_contests_type" CHECK("fishing_contests"."type" IN ('catch', 'race')),
	CONSTRAINT "fishing_contests_interval_days" CHECK("fishing_contests"."interval_days" >= 1),
	CONSTRAINT "fishing_contests_duration_hours" CHECK("fishing_contests"."duration_hours" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fishing_contests_name_unique` ON `fishing_contests` (`name`);--> statement-breakpoint
CREATE TABLE `fishing_rod_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`start_value` integer NOT NULL,
	`fp_per_point` integer NOT NULL,
	CONSTRAINT "fishing_rod_stats_id" CHECK("fishing_rod_stats"."id" GLOB '[a-z0-9]*' AND "fishing_rod_stats"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "fishing_rod_stats_start_value" CHECK("fishing_rod_stats"."start_value" >= 0),
	CONSTRAINT "fishing_rod_stats_fp_per_point" CHECK("fishing_rod_stats"."fp_per_point" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fishing_rod_stats_name_unique` ON `fishing_rod_stats` (`name`);--> statement-breakpoint
CREATE TABLE `fishing_tackle` (
	`item_id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`water` text,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "fishing_tackle_type" CHECK("fishing_tackle"."type" IN ('bait', 'lure')),
	CONSTRAINT "fishing_tackle_water" CHECK("fishing_tackle"."water" IN ('any', 'ocean', 'special')),
	CONSTRAINT "fishing_tackle_water_for_bait" CHECK(("fishing_tackle"."water" IS NOT NULL) = ("fishing_tackle"."type" = 'bait'))
);
--> statement-breakpoint
CREATE TABLE `fishing_tackle_fish` (
	`item_id` text NOT NULL,
	`fish_id` text NOT NULL,
	PRIMARY KEY(`item_id`, `fish_id`),
	FOREIGN KEY (`item_id`) REFERENCES `fishing_tackle`(`item_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fish_id`) REFERENCES `fish`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `georama_goals` (
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
	CONSTRAINT "georama_goals_type" CHECK("georama_goals"."type" IN ('parts-placed', 'npc-resides', 'residents', 'task-completed', 'culture-points', 'story-event', 'other')),
	CONSTRAINT "georama_goals_relation" CHECK("georama_goals"."relation" IN ('on', 'near', 'between', 'around')),
	CONSTRAINT "georama_goals_related_part" CHECK(("georama_goals"."relation" IS NULL) + ("georama_goals"."related_georama_part_id" IS NULL) IN (0, 2)),
	CONSTRAINT "georama_goals_quantity" CHECK("georama_goals"."quantity" >= 1),
	CONSTRAINT "georama_goals_culture_points" CHECK("georama_goals"."culture_points" >= 1),
	CONSTRAINT "georama_goals_link_matches_type" CHECK(("georama_goals"."type" <> 'parts-placed' OR (("georama_goals"."georama_part_id" IS NOT NULL OR "georama_goals"."part_category" IS NOT NULL) AND "georama_goals"."quantity" IS NOT NULL)) AND ("georama_goals"."type" <> 'npc-resides' OR ("georama_goals"."npc_id" IS NOT NULL)) AND ("georama_goals"."type" <> 'residents' OR ("georama_goals"."quantity" IS NOT NULL)) AND ("georama_goals"."type" <> 'task-completed' OR ("georama_goals"."required_task_id" IS NOT NULL)) AND ("georama_goals"."type" <> 'culture-points' OR ("georama_goals"."culture_points" IS NOT NULL)) AND ("georama_goals"."type" <> 'story-event' OR ("georama_goals"."section_id" IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE `georama_part_items` (
	`georama_part_id` text NOT NULL,
	`item_id` text NOT NULL,
	`quantity` integer NOT NULL,
	PRIMARY KEY(`georama_part_id`, `item_id`),
	FOREIGN KEY (`georama_part_id`) REFERENCES `georama_parts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "georama_part_items_quantity" CHECK("georama_part_items"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE `georama_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`placement` text,
	`category` text,
	`polyn_cost` integer,
	`culture_points` integer,
	CONSTRAINT "georama_parts_id" CHECK("georama_parts"."id" GLOB '[a-z0-9]*' AND "georama_parts"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "georama_parts_placement" CHECK("georama_parts"."placement" IN ('ground', 'house', 'wall', 'roof')),
	CONSTRAINT "georama_parts_polyn_cost" CHECK("georama_parts"."polyn_cost" >= 0),
	CONSTRAINT "georama_parts_culture_points" CHECK("georama_parts"."culture_points" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `georama_parts_name_unique` ON `georama_parts` (`name`);--> statement-breakpoint
CREATE TABLE `georama_starting_parts` (
	`town_id` text NOT NULL,
	`georama_part_id` text NOT NULL,
	`quantity` integer NOT NULL,
	PRIMARY KEY(`town_id`, `georama_part_id`),
	FOREIGN KEY (`town_id`) REFERENCES `towns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`georama_part_id`) REFERENCES `georama_parts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "georama_starting_parts_quantity" CHECK("georama_starting_parts"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE `georama_tasks` (
	`id` integer PRIMARY KEY NOT NULL,
	`town_id` text NOT NULL,
	`name` text NOT NULL,
	`percent` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`town_id`) REFERENCES `towns`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "georama_tasks_percent" CHECK("georama_tasks"."percent" BETWEEN 1 AND 100)
);
--> statement-breakpoint
CREATE TABLE `georama_town_parts` (
	`town_id` text NOT NULL,
	`georama_part_id` text NOT NULL,
	`max_count` integer,
	PRIMARY KEY(`town_id`, `georama_part_id`),
	FOREIGN KEY (`town_id`) REFERENCES `towns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`georama_part_id`) REFERENCES `georama_parts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "georama_town_parts_max_count" CHECK("georama_town_parts"."max_count" >= 1)
);
--> statement-breakpoint
CREATE TABLE `georama_town_rewards` (
	`id` integer PRIMARY KEY NOT NULL,
	`town_id` text NOT NULL,
	`item_id` text,
	`weapon_id` text,
	`ridepod_part_id` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`town_id`) REFERENCES `towns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`weapon_id`) REFERENCES `weapons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ridepod_part_id`) REFERENCES `ridepod_parts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "georama_town_rewards_one_reward" CHECK(("georama_town_rewards"."item_id" IS NOT NULL) + ("georama_town_rewards"."weapon_id" IS NOT NULL) + ("georama_town_rewards"."ridepod_part_id" IS NOT NULL) = 1),
	CONSTRAINT "georama_town_rewards_quantity" CHECK("georama_town_rewards"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE `invention_ideas` (
	`invention_id` text NOT NULL,
	`recipe` integer DEFAULT 1 NOT NULL,
	`photo_id` text NOT NULL,
	PRIMARY KEY(`invention_id`, `recipe`, `photo_id`),
	FOREIGN KEY (`invention_id`) REFERENCES `inventions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "invention_ideas_recipe" CHECK("invention_ideas"."recipe" >= 1)
);
--> statement-breakpoint
CREATE TABLE `invention_items` (
	`invention_id` text NOT NULL,
	`item_id` text NOT NULL,
	`quantity` integer NOT NULL,
	PRIMARY KEY(`invention_id`, `item_id`),
	FOREIGN KEY (`invention_id`) REFERENCES `inventions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "invention_items_quantity" CHECK("invention_items"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE `inventions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`chapter_number` integer NOT NULL,
	`until_chapter_number` integer,
	`section_id` text,
	`town_id` text,
	`after_section_id` text,
	`after_georama_task_id` integer,
	`requires_georama_part_id` text,
	`missable` integer DEFAULT false NOT NULL,
	`notes` text,
	`recipe_location` text,
	`ridepod_part_id` text,
	`weapon_id` text,
	`item_id` text,
	FOREIGN KEY (`chapter_number`) REFERENCES `chapters`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`until_chapter_number`) REFERENCES `chapters`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`town_id`) REFERENCES `towns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_georama_task_id`) REFERENCES `georama_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requires_georama_part_id`) REFERENCES `georama_parts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ridepod_part_id`) REFERENCES `ridepod_parts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`weapon_id`) REFERENCES `weapons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "inventions_id" CHECK("inventions"."id" GLOB '[a-z0-9]*' AND "inventions"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "inventions_one_result" CHECK(("inventions"."ridepod_part_id" IS NOT NULL) + ("inventions"."weapon_id" IS NOT NULL) + ("inventions"."item_id" IS NOT NULL) = 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventions_name_unique` ON `inventions` (`name`);--> statement-breakpoint
CREATE TABLE `item_effects` (
	`id` integer PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`effect` text NOT NULL,
	`amount` integer,
	`status` text,
	`element` text,
	`area` text,
	`target` text,
	`floor` text,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "item_effects_effect" CHECK("item_effects"."effect" IN ('heal', 'cause-status', 'cure-status', 'prevent-status', 'inflict-status', 'damage', 'repair-weapon', 'boost-attack', 'boost-defense', 'level-up-weapon', 'rename-weapon', 'revive', 'escape-dungeon', 'refuel-ridepod', 'break-seal', 'open-chest', 'reveal-map', 'reveal-enemies', 'cross-floor', 'boost-monster', 'slow-transformation-timer')),
	CONSTRAINT "item_effects_status" CHECK("item_effects"."status" IN ('poison', 'thirsty', 'cursed', 'gooey', 'petrify', 'stop', 'pumped-up', 'all')),
	CONSTRAINT "item_effects_element" CHECK("item_effects"."element" IN ('flame', 'chill', 'lightning', 'cyclone', 'smash', 'exorcism', 'beast', 'scale')),
	CONSTRAINT "item_effects_area" CHECK("item_effects"."area" IN ('single', 'small', 'medium', 'large')),
	CONSTRAINT "item_effects_target" CHECK("item_effects"."target" IN ('self', 'both', 'enemy', 'melee-weapon', 'gun', 'armband')),
	CONSTRAINT "item_effects_floor" CHECK("item_effects"."floor" IN ('hot', 'slippery', 'muddy')),
	CONSTRAINT "item_effects_amount" CHECK("item_effects"."amount" >= 1),
	CONSTRAINT "item_effects_status_needed" CHECK(("item_effects"."status" IS NOT NULL) = ("item_effects"."effect" IN ('cause-status', 'cure-status', 'prevent-status', 'inflict-status'))),
	CONSTRAINT "item_effects_floor_needed" CHECK(("item_effects"."floor" IS NOT NULL) = ("item_effects"."effect" = 'cross-floor'))
);
--> statement-breakpoint
CREATE TABLE `items` (
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
	CONSTRAINT "items_id" CHECK("items"."id" GLOB '[a-z0-9]*' AND "items"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "items_type" CHECK("items"."type" IN ('material', 'functional', 'clothing', 'coin', 'badge', 'fishing', 'ridepod-accessory', 'synth-only')),
	CONSTRAINT "items_equip_character" CHECK("items"."equip_character" IN ('max', 'monica')),
	CONSTRAINT "items_equip_slot" CHECK("items"."equip_slot" IN ('clothes', 'hat', 'hair-ornament', 'shoes')),
	CONSTRAINT "items_equip" CHECK(("items"."equip_character" IS NULL) + ("items"."equip_slot" IS NULL) IN (0, 2)),
	CONSTRAINT "items_synth_category" CHECK("items"."synth_category" IN ('attack', 'flame', 'chill', 'lightning', 'cyclone', 'smash', 'exorcism', 'beast', 'scale', 'gems', 'durable')),
	CONSTRAINT "items_synth_point_cost" CHECK("items"."synth_point_cost" >= 0),
	CONSTRAINT "items_max_stack" CHECK("items"."max_stack" >= 1),
	CONSTRAINT "items_powerup_character" CHECK("items"."powerup_character" IN ('max', 'monica', 'either')),
	CONSTRAINT "items_powerup_stat" CHECK("items"."powerup_stat" IN ('hp', 'defense')),
	CONSTRAINT "items_powerup" CHECK(("items"."powerup_character" IS NULL) + ("items"."powerup_stat" IS NULL) + ("items"."powerup_amount" IS NULL) IN (0, 3)),
	CONSTRAINT "items_powerup_amount" CHECK("items"."powerup_amount" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `items_name_unique` ON `items` (`name`);--> statement-breakpoint
CREATE TABLE `monster_class_level_rewards` (
	`class_id` text NOT NULL,
	`level` integer NOT NULL,
	`item_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`class_id`, `level`, `item_id`),
	FOREIGN KEY (`class_id`) REFERENCES `monster_classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "monster_class_level_rewards_level" CHECK("monster_class_level_rewards"."level" BETWEEN 2 AND 99),
	CONSTRAINT "monster_class_level_rewards_quantity" CHECK("monster_class_level_rewards"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE `monster_class_unlocks` (
	`id` integer PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`method` text NOT NULL,
	`item_id` text NOT NULL,
	`enemy_id` text,
	`quantity` integer,
	FOREIGN KEY (`class_id`) REFERENCES `monster_classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`enemy_id`) REFERENCES `enemies`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "monster_class_unlocks_method" CHECK("monster_class_unlocks"."method" IN ('buy', 'gift', 'kill-with')),
	CONSTRAINT "monster_class_unlocks_quantity" CHECK("monster_class_unlocks"."quantity" >= 1),
	CONSTRAINT "monster_class_unlocks_link_matches_method" CHECK(("monster_class_unlocks"."method" <> 'buy' OR ("monster_class_unlocks"."enemy_id" IS NULL AND "monster_class_unlocks"."quantity" IS NULL)) AND ("monster_class_unlocks"."method" <> 'gift' OR ("monster_class_unlocks"."enemy_id" IS NOT NULL AND "monster_class_unlocks"."quantity" IS NOT NULL)) AND ("monster_class_unlocks"."method" <> 'kill-with' OR ("monster_class_unlocks"."enemy_id" IS NOT NULL AND "monster_class_unlocks"."quantity" IS NULL)))
);
--> statement-breakpoint
CREATE TABLE `monster_classes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`badge_name` text NOT NULL,
	`chapter_number` integer NOT NULL,
	`until_chapter_number` integer,
	`section_id` text,
	`town_id` text,
	`after_section_id` text,
	`after_georama_task_id` integer,
	`requires_georama_part_id` text,
	`missable` integer DEFAULT false NOT NULL,
	`notes` text,
	FOREIGN KEY (`chapter_number`) REFERENCES `chapters`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`until_chapter_number`) REFERENCES `chapters`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`town_id`) REFERENCES `towns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_georama_task_id`) REFERENCES `georama_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requires_georama_part_id`) REFERENCES `georama_parts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "monster_classes_id" CHECK("monster_classes"."id" GLOB '[a-z0-9]*' AND "monster_classes"."id" NOT GLOB '*[^a-z0-9-]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monster_classes_name_unique` ON `monster_classes` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `monster_classes_badgeName_unique` ON `monster_classes` (`badge_name`);--> statement-breakpoint
CREATE TABLE `monster_evolutions` (
	`from_id` text NOT NULL,
	`to_id` text NOT NULL,
	`level` integer NOT NULL,
	`required_item_id` text,
	`required_quantity` integer,
	PRIMARY KEY(`from_id`, `to_id`),
	FOREIGN KEY (`from_id`) REFERENCES `monster_forms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_id`) REFERENCES `monster_forms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`required_item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "monster_evolutions_level" CHECK("monster_evolutions"."level" BETWEEN 2 AND 99),
	CONSTRAINT "monster_evolutions_requirement" CHECK(("monster_evolutions"."required_item_id" IS NULL) + ("monster_evolutions"."required_quantity" IS NULL) IN (0, 2)),
	CONSTRAINT "monster_evolutions_required_quantity" CHECK("monster_evolutions"."required_quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE `monster_forms` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`name` text NOT NULL,
	`attack` integer NOT NULL,
	`defense` integer NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `monster_classes`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "monster_forms_id" CHECK("monster_forms"."id" GLOB '[a-z0-9]*' AND "monster_forms"."id" NOT GLOB '*[^a-z0-9-]*')
);
--> statement-breakpoint
CREATE TABLE `npc_housing_requirements` (
	`id` integer PRIMARY KEY NOT NULL,
	`npc_id` text NOT NULL,
	`type` text NOT NULL,
	`georama_part_id` text,
	`color` text,
	`quantity` integer,
	`text` text,
	FOREIGN KEY (`npc_id`) REFERENCES `npcs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`georama_part_id`) REFERENCES `georama_parts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "npc_housing_requirements_type" CHECK("npc_housing_requirements"."type" IN ('near-part', 'in-part', 'not-in-part', 'roof-color', 'minimum-stories', 'other')),
	CONSTRAINT "npc_housing_requirements_link_matches_type" CHECK(("npc_housing_requirements"."type" <> 'near-part' OR ("npc_housing_requirements"."georama_part_id" IS NOT NULL)) AND ("npc_housing_requirements"."type" <> 'in-part' OR ("npc_housing_requirements"."georama_part_id" IS NOT NULL)) AND ("npc_housing_requirements"."type" <> 'not-in-part' OR ("npc_housing_requirements"."georama_part_id" IS NOT NULL)) AND ("npc_housing_requirements"."type" <> 'roof-color' OR ("npc_housing_requirements"."color" IS NOT NULL)) AND ("npc_housing_requirements"."type" <> 'minimum-stories' OR ("npc_housing_requirements"."quantity" IS NOT NULL)) AND ("npc_housing_requirements"."type" <> 'other' OR ("npc_housing_requirements"."text" IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE `npc_skills` (
	`id` integer PRIMARY KEY NOT NULL,
	`npc_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`skill_point_cost` integer,
	`item_id` text,
	`quantity` integer,
	`weapon_type` text,
	FOREIGN KEY (`npc_id`) REFERENCES `npcs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "npc_skills_skill_point_cost" CHECK("npc_skills"."skill_point_cost" >= 1),
	CONSTRAINT "npc_skills_item" CHECK(("npc_skills"."item_id" IS NULL) + ("npc_skills"."quantity" IS NULL) IN (0, 2)),
	CONSTRAINT "npc_skills_quantity" CHECK("npc_skills"."quantity" >= 1),
	CONSTRAINT "npc_skills_weapon_type" CHECK("npc_skills"."weapon_type" IN ('wrench', 'gun', 'club', 'sword', 'armband'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `npc_skills_npc_name` ON `npc_skills` (`npc_id`,`name`);--> statement-breakpoint
CREATE TABLE `npcs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`home_town_id` text,
	`max_skill_points` integer,
	FOREIGN KEY (`home_town_id`) REFERENCES `towns`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "npcs_id" CHECK("npcs"."id" GLOB '[a-z0-9]*' AND "npcs"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "npcs_max_skill_points" CHECK("npcs"."max_skill_points" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `npcs_name_unique` ON `npcs` (`name`);--> statement-breakpoint
CREATE TABLE `photo_levels` (
	`level` integer PRIMARY KEY NOT NULL,
	`minimum_points` integer NOT NULL,
	`reward_item_id` text,
	FOREIGN KEY (`reward_item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "photo_levels_level" CHECK("photo_levels"."level" >= 1),
	CONSTRAINT "photo_levels_points" CHECK("photo_levels"."minimum_points" >= 0)
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`points` integer NOT NULL,
	`description` text,
	`chapter_number` integer NOT NULL,
	`until_chapter_number` integer,
	`section_id` text,
	`town_id` text,
	`after_section_id` text,
	`after_georama_task_id` integer,
	`requires_georama_part_id` text,
	`missable` integer DEFAULT false NOT NULL,
	`notes` text,
	`from_hour` integer,
	`to_hour` integer,
	`only_chance` integer DEFAULT false NOT NULL,
	`ghost` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`chapter_number`) REFERENCES `chapters`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`until_chapter_number`) REFERENCES `chapters`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`town_id`) REFERENCES `towns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_georama_task_id`) REFERENCES `georama_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requires_georama_part_id`) REFERENCES `georama_parts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "photos_id" CHECK("photos"."id" GLOB '[a-z0-9]*' AND "photos"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "photos_type" CHECK("photos"."type" IN ('idea', 'scoop')),
	CONSTRAINT "photos_points" CHECK("photos"."points" >= 1),
	CONSTRAINT "photos_hours" CHECK(("photos"."from_hour" IS NULL) + ("photos"."to_hour" IS NULL) IN (0, 2)),
	CONSTRAINT "photos_from_hour" CHECK("photos"."from_hour" BETWEEN 0 AND 23),
	CONSTRAINT "photos_to_hour" CHECK("photos"."to_hour" BETWEEN 0 AND 23),
	CONSTRAINT "photos_ghost_scoops_only" CHECK("photos"."ghost" = 0 OR "photos"."type" = 'scoop')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_name_unique` ON `photos` (`name`);--> statement-breakpoint
CREATE TABLE `pickups` (
	`id` integer PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`chapter_number` integer NOT NULL,
	`until_chapter_number` integer,
	`section_id` text,
	`town_id` text,
	`after_section_id` text,
	`after_georama_task_id` integer,
	`requires_georama_part_id` text,
	`missable` integer DEFAULT false NOT NULL,
	`notes` text,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chapter_number`) REFERENCES `chapters`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`until_chapter_number`) REFERENCES `chapters`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`town_id`) REFERENCES `towns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_georama_task_id`) REFERENCES `georama_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requires_georama_part_id`) REFERENCES `georama_parts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pickups_quantity" CHECK("pickups"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE `recruit_requirements` (
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
	CONSTRAINT "recruit_requirements_type" CHECK("recruit_requirements"."type" IN ('give-item', 'show-item', 'show-weapon', 'show-photo', 'catch-fish', 'pay-gilda', 'win-contest', 'win-spheda', 'beat-time', 'enter-code', 'story', 'other')),
	CONSTRAINT "recruit_requirements_quantity" CHECK("recruit_requirements"."quantity" >= 1),
	CONSTRAINT "recruit_requirements_minimum_centimeters" CHECK("recruit_requirements"."minimum_centimeters" >= 1),
	CONSTRAINT "recruit_requirements_seconds" CHECK("recruit_requirements"."seconds" >= 1),
	CONSTRAINT "recruit_requirements_link_matches_type" CHECK(("recruit_requirements"."type" <> 'give-item' OR ("recruit_requirements"."item_id" IS NOT NULL AND "recruit_requirements"."quantity" IS NOT NULL)) AND ("recruit_requirements"."type" <> 'show-item' OR ("recruit_requirements"."item_id" IS NOT NULL)) AND ("recruit_requirements"."type" <> 'show-weapon' OR ("recruit_requirements"."weapon_id" IS NOT NULL)) AND ("recruit_requirements"."type" <> 'show-photo' OR ("recruit_requirements"."photo_id" IS NOT NULL)) AND ("recruit_requirements"."type" <> 'catch-fish' OR ("recruit_requirements"."fish_id" IS NOT NULL)) AND ("recruit_requirements"."type" <> 'pay-gilda' OR ("recruit_requirements"."quantity" IS NOT NULL)) AND ("recruit_requirements"."type" <> 'win-spheda' OR ("recruit_requirements"."quantity" IS NOT NULL)) AND ("recruit_requirements"."type" <> 'beat-time' OR ("recruit_requirements"."seconds" IS NOT NULL)) AND ("recruit_requirements"."type" <> 'enter-code' OR ("recruit_requirements"."text" IS NOT NULL)) AND ("recruit_requirements"."type" <> 'story' OR ("recruit_requirements"."text" IS NOT NULL)) AND ("recruit_requirements"."type" <> 'other' OR ("recruit_requirements"."text" IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE `recruits` (
	`npc_id` text PRIMARY KEY NOT NULL,
	`chapter_number` integer NOT NULL,
	`until_chapter_number` integer,
	`section_id` text,
	`town_id` text,
	`after_section_id` text,
	`after_georama_task_id` integer,
	`requires_georama_part_id` text,
	`missable` integer DEFAULT false NOT NULL,
	`notes` text,
	`location` text,
	`character` text,
	`quest_name` text,
	FOREIGN KEY (`npc_id`) REFERENCES `npcs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chapter_number`) REFERENCES `chapters`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`until_chapter_number`) REFERENCES `chapters`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`town_id`) REFERENCES `towns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_georama_task_id`) REFERENCES `georama_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requires_georama_part_id`) REFERENCES `georama_parts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "recruits_character" CHECK("recruits"."character" IN ('max', 'monica'))
);
--> statement-breakpoint
CREATE TABLE `ridepod_bodies` (
	`part_id` text PRIMARY KEY NOT NULL,
	`part_type` text DEFAULT 'body' NOT NULL,
	`armor` integer NOT NULL,
	FOREIGN KEY (`part_id`,`part_type`) REFERENCES `ridepod_parts`(`id`,`type`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ridepod_bodies_part_type" CHECK("ridepod_bodies"."part_type" = 'body'),
	CONSTRAINT "ridepod_bodies_armor" CHECK("ridepod_bodies"."armor" >= 0)
);
--> statement-breakpoint
CREATE TABLE `ridepod_cores` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`capacity` integer NOT NULL,
	`armor_capacity` integer NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT "ridepod_cores_id" CHECK("ridepod_cores"."id" GLOB '[a-z0-9]*' AND "ridepod_cores"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "ridepod_cores_capacity" CHECK("ridepod_cores"."capacity" >= 1),
	CONSTRAINT "ridepod_cores_armor_capacity" CHECK("ridepod_cores"."armor_capacity" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ridepod_cores_name_unique` ON `ridepod_cores` (`name`);--> statement-breakpoint
CREATE TABLE `ridepod_energy_packs` (
	`part_id` text PRIMARY KEY NOT NULL,
	`part_type` text DEFAULT 'energy-pack' NOT NULL,
	`energy` integer NOT NULL,
	FOREIGN KEY (`part_id`,`part_type`) REFERENCES `ridepod_parts`(`id`,`type`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ridepod_energy_packs_part_type" CHECK("ridepod_energy_packs"."part_type" = 'energy-pack'),
	CONSTRAINT "ridepod_energy_packs_energy" CHECK("ridepod_energy_packs"."energy" >= 1)
);
--> statement-breakpoint
CREATE TABLE `ridepod_legs` (
	`part_id` text PRIMARY KEY NOT NULL,
	`part_type` text DEFAULT 'legs' NOT NULL,
	`sub_type` text NOT NULL,
	`speed` text NOT NULL,
	FOREIGN KEY (`part_id`,`part_type`) REFERENCES `ridepod_parts`(`id`,`type`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ridepod_legs_part_type" CHECK("ridepod_legs"."part_type" = 'legs'),
	CONSTRAINT "ridepod_legs_sub_type" CHECK("ridepod_legs"."sub_type" IN ('legs', 'wheels', 'airborne')),
	CONSTRAINT "ridepod_legs_speed" CHECK("ridepod_legs"."speed" IN ('slow', 'average', 'fast', 'very-fast'))
);
--> statement-breakpoint
CREATE TABLE `ridepod_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`capacity` integer NOT NULL,
	`item_id` text,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ridepod_parts_id" CHECK("ridepod_parts"."id" GLOB '[a-z0-9]*' AND "ridepod_parts"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "ridepod_parts_type" CHECK("ridepod_parts"."type" IN ('weapon', 'body', 'legs', 'energy-pack')),
	CONSTRAINT "ridepod_parts_capacity" CHECK("ridepod_parts"."capacity" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ridepod_parts_name_unique` ON `ridepod_parts` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `ridepod_parts_itemId_unique` ON `ridepod_parts` (`item_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ridepod_parts_id_type` ON `ridepod_parts` (`id`,`type`);--> statement-breakpoint
CREATE TABLE `ridepod_weapons` (
	`part_id` text PRIMARY KEY NOT NULL,
	`part_type` text DEFAULT 'weapon' NOT NULL,
	`sub_type` text NOT NULL,
	`tier` integer NOT NULL,
	`weapon_hp` integer NOT NULL,
	`attack` integer NOT NULL,
	`flame` integer,
	`chill` integer,
	`lightning` integer,
	`cyclone` integer,
	`smash` integer,
	`exorcism` integer,
	`beast` integer,
	`scale` integer,
	FOREIGN KEY (`part_id`,`part_type`) REFERENCES `ridepod_parts`(`id`,`type`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ridepod_weapons_part_type" CHECK("ridepod_weapons"."part_type" = 'weapon'),
	CONSTRAINT "ridepod_weapons_sub_type" CHECK("ridepod_weapons"."sub_type" IN ('cannonball-arm', 'clown-hand', 'samurai-arm', 'hammer-arm', 'drill-arm', 'barrel-cannon', 'machine-gun-arm', 'missile-pod-arm', 'nova-cannon', 'laser-arm')),
	CONSTRAINT "ridepod_weapons_tier" CHECK("ridepod_weapons"."tier" BETWEEN 1 AND 4),
	CONSTRAINT "ridepod_weapons_weapon_hp" CHECK("ridepod_weapons"."weapon_hp" >= 1),
	CONSTRAINT "ridepod_weapons_attack" CHECK("ridepod_weapons"."attack" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ridepod_weapons_sub_type_tier` ON `ridepod_weapons` (`sub_type`,`tier`);--> statement-breakpoint
CREATE TABLE `section_enemies` (
	`section_id` text NOT NULL,
	`enemy_id` text NOT NULL,
	`star_area` integer DEFAULT false NOT NULL,
	`count` integer NOT NULL,
	`carries_key` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`section_id`, `enemy_id`, `star_area`),
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`enemy_id`) REFERENCES `enemies`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "section_enemies_count" CHECK("section_enemies"."count" >= 1)
);
--> statement-breakpoint
CREATE TABLE `section_exits` (
	`from_section_id` text NOT NULL,
	`to_section_id` text NOT NULL,
	`type` text DEFAULT 'normal' NOT NULL,
	PRIMARY KEY(`from_section_id`, `to_section_id`, `type`),
	FOREIGN KEY (`from_section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "section_exits_type" CHECK("section_exits"."type" IN ('normal', 'sun', 'moon', 'star'))
);
--> statement-breakpoint
CREATE TABLE `section_georama_items` (
	`section_id` text NOT NULL,
	`item_id` text NOT NULL,
	PRIMARY KEY(`section_id`, `item_id`),
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `section_geostone_parts` (
	`section_id` text NOT NULL,
	`georama_part_id` text NOT NULL,
	PRIMARY KEY(`section_id`, `georama_part_id`),
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`georama_part_id`) REFERENCES `georama_parts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `section_rewards` (
	`id` integer PRIMARY KEY NOT NULL,
	`section_id` text NOT NULL,
	`character` text,
	`item_id` text,
	`weapon_id` text,
	`ridepod_part_id` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`weapon_id`) REFERENCES `weapons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ridepod_part_id`) REFERENCES `ridepod_parts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "section_rewards_character" CHECK("section_rewards"."character" IN ('max', 'monica')),
	CONSTRAINT "section_rewards_one_reward" CHECK(("section_rewards"."item_id" IS NOT NULL) + ("section_rewards"."weapon_id" IS NOT NULL) + ("section_rewards"."ridepod_part_id" IS NOT NULL) = 1),
	CONSTRAINT "section_rewards_quantity" CHECK("section_rewards"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE `section_spheda_prizes` (
	`id` integer PRIMARY KEY NOT NULL,
	`section_id` text NOT NULL,
	`tier` text NOT NULL,
	`item_id` text,
	`weapon_id` text,
	`ridepod_part_id` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`weapon_id`) REFERENCES `weapons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ridepod_part_id`) REFERENCES `ridepod_parts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "section_spheda_prizes_tier" CHECK("section_spheda_prizes"."tier" IN ('first', 'second', 'repeat')),
	CONSTRAINT "section_spheda_prizes_one_reward" CHECK(("section_spheda_prizes"."item_id" IS NOT NULL) + ("section_spheda_prizes"."weapon_id" IS NOT NULL) + ("section_spheda_prizes"."ridepod_part_id" IS NOT NULL) = 1),
	CONSTRAINT "section_spheda_prizes_quantity" CHECK("section_spheda_prizes"."quantity" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `section_spheda_prizes_section_tier` ON `section_spheda_prizes` (`section_id`,`tier`);--> statement-breakpoint
CREATE TABLE `sections` (
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
	CONSTRAINT "sections_id" CHECK("sections"."id" GLOB '[a-z0-9]*' AND "sections"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "sections_type" CHECK("sections"."type" IN ('story', 'dungeon', 'boss', 'interlude')),
	CONSTRAINT "sections_medal_clear_goal" CHECK("sections"."medal_clear_goal" IN ('items-only', 'ridepod-only', 'no-healing', 'max-close-range-weapon-only', 'max-gun-only', 'monica-sword-only', 'monica-magic-only', 'monster-transformation-only')),
	CONSTRAINT "sections_restriction" CHECK("sections"."restriction" IN ('white-seal', 'blue-seal', 'red-seal')),
	CONSTRAINT "sections_time_limit_seconds" CHECK("sections"."time_limit_seconds" >= 1),
	CONSTRAINT "sections_medal_time_attack_seconds" CHECK("sections"."medal_time_attack_seconds" >= 1),
	CONSTRAINT "sections_medal_fishing_centimeters" CHECK("sections"."medal_fishing_centimeters" >= 1),
	CONSTRAINT "sections_dungeon_floor_only" CHECK("sections"."dungeon_id" IS NOT NULL OR ("sections"."medal_time_attack_seconds" IS NULL AND "sections"."medal_clear_goal" IS NULL AND "sections"."medal_fishing_centimeters" IS NULL AND "sections"."has_geostone" = 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sections_chapter_position` ON `sections` (`chapter_number`,`position`);--> statement-breakpoint
CREATE TABLE `shield_kit_costs` (
	`purchase` integer PRIMARY KEY NOT NULL,
	`cost` integer NOT NULL,
	CONSTRAINT "shield_kit_costs_purchase" CHECK("shield_kit_costs"."purchase" >= 1),
	CONSTRAINT "shield_kit_costs_cost" CHECK("shield_kit_costs"."cost" >= 1)
);
--> statement-breakpoint
CREATE TABLE `shop_stock` (
	`id` integer PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`item_id` text,
	`weapon_id` text,
	`ridepod_part_id` text,
	`ridepod_core_id` text,
	`price` integer,
	`purchase_limit` integer,
	`from_chapter_number` integer,
	`after_section_id` text,
	`after_recruit_npc_id` text,
	`after_georama_task_id` integer,
	`until_chapter_number` integer,
	`until_section_id` text,
	`until_recruit_npc_id` text,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`weapon_id`) REFERENCES `weapons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ridepod_part_id`) REFERENCES `ridepod_parts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ridepod_core_id`) REFERENCES `ridepod_cores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_chapter_number`) REFERENCES `chapters`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_recruit_npc_id`) REFERENCES `npcs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_georama_task_id`) REFERENCES `georama_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`until_chapter_number`) REFERENCES `chapters`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`until_section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`until_recruit_npc_id`) REFERENCES `npcs`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "shop_stock_one_product" CHECK(("shop_stock"."item_id" IS NOT NULL) + ("shop_stock"."weapon_id" IS NOT NULL) + ("shop_stock"."ridepod_part_id" IS NOT NULL) + ("shop_stock"."ridepod_core_id" IS NOT NULL) = 1),
	CONSTRAINT "shop_stock_price" CHECK("shop_stock"."price" >= 0),
	CONSTRAINT "shop_stock_purchase_limit" CHECK("shop_stock"."purchase_limit" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shop_stock_shop_item` ON `shop_stock` (`shop_id`,`item_id`) WHERE "shop_stock"."item_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `shop_stock_shop_weapon` ON `shop_stock` (`shop_id`,`weapon_id`) WHERE "shop_stock"."weapon_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `shop_stock_shop_ridepod_part` ON `shop_stock` (`shop_id`,`ridepod_part_id`) WHERE "shop_stock"."ridepod_part_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `shop_stock_shop_ridepod_core` ON `shop_stock` (`shop_id`,`ridepod_core_id`) WHERE "shop_stock"."ridepod_core_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `shops` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`town_id` text,
	`npc_id` text,
	`currency` text DEFAULT 'gilda' NOT NULL,
	`from_chapter_number` integer,
	`after_section_id` text,
	`after_recruit_npc_id` text,
	`after_georama_task_id` integer,
	`until_chapter_number` integer,
	`until_section_id` text,
	`until_recruit_npc_id` text,
	FOREIGN KEY (`town_id`) REFERENCES `towns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`npc_id`) REFERENCES `npcs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_chapter_number`) REFERENCES `chapters`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_recruit_npc_id`) REFERENCES `npcs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`after_georama_task_id`) REFERENCES `georama_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`until_chapter_number`) REFERENCES `chapters`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`until_section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`until_recruit_npc_id`) REFERENCES `npcs`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "shops_id" CHECK("shops"."id" GLOB '[a-z0-9]*' AND "shops"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "shops_currency" CHECK("shops"."currency" IN ('gilda', 'medals', 'abs')),
	CONSTRAINT "shops_place" CHECK("shops"."town_id" IS NOT NULL OR "shops"."npc_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shops_name_unique` ON `shops` (`name`);--> statement-breakpoint
CREATE TABLE `starting_equipment` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`item_id` text,
	`weapon_id` text,
	`ridepod_part_id` text,
	`ridepod_core_id` text,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`weapon_id`) REFERENCES `weapons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ridepod_part_id`) REFERENCES `ridepod_parts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ridepod_core_id`) REFERENCES `ridepod_cores`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "starting_equipment_owner" CHECK("starting_equipment"."owner" IN ('max', 'monica', 'ridepod')),
	CONSTRAINT "starting_equipment_one_piece" CHECK(("starting_equipment"."item_id" IS NOT NULL) + ("starting_equipment"."weapon_id" IS NOT NULL) + ("starting_equipment"."ridepod_part_id" IS NOT NULL) + ("starting_equipment"."ridepod_core_id" IS NOT NULL) = 1)
);
--> statement-breakpoint
CREATE TABLE `towns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`era` text DEFAULT 'present' NOT NULL,
	`present_town_id` text,
	`has_georama` integer DEFAULT false NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`present_town_id`) REFERENCES `towns`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "towns_id" CHECK("towns"."id" GLOB '[a-z0-9]*' AND "towns"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "towns_era" CHECK("towns"."era" IN ('present', 'future')),
	CONSTRAINT "towns_future_has_present" CHECK(("towns"."era" = 'future') = ("towns"."present_town_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `towns_name_unique` ON `towns` (`name`);--> statement-breakpoint
CREATE TABLE `trophies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tier` text NOT NULL,
	`description` text NOT NULL,
	`position` integer NOT NULL,
	`chapter_number` integer,
	`enemy_id` text,
	`fish_id` text,
	`ridepod_core_id` text,
	`contest_class_id` integer,
	`photo_level` integer,
	FOREIGN KEY (`chapter_number`) REFERENCES `chapters`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`enemy_id`) REFERENCES `enemies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fish_id`) REFERENCES `fish`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ridepod_core_id`) REFERENCES `ridepod_cores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contest_class_id`) REFERENCES `fishing_contest_classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`photo_level`) REFERENCES `photo_levels`(`level`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "trophies_id" CHECK("trophies"."id" GLOB '[a-z0-9]*' AND "trophies"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "trophies_tier" CHECK("trophies"."tier" IN ('bronze', 'silver', 'gold', 'platinum'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trophies_name_unique` ON `trophies` (`name`);--> statement-breakpoint
CREATE TABLE `trophy_weapons` (
	`trophy_id` text NOT NULL,
	`weapon_id` text NOT NULL,
	PRIMARY KEY(`trophy_id`, `weapon_id`),
	FOREIGN KEY (`trophy_id`) REFERENCES `trophies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`weapon_id`) REFERENCES `weapons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `weapon_abilities` (
	`weapon_id` text NOT NULL,
	`ability_id` text NOT NULL,
	PRIMARY KEY(`weapon_id`, `ability_id`),
	FOREIGN KEY (`weapon_id`) REFERENCES `weapons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ability_id`) REFERENCES `abilities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `weapon_build_ups` (
	`weapon_id` text NOT NULL,
	`target_id` text NOT NULL,
	PRIMARY KEY(`weapon_id`, `target_id`),
	FOREIGN KEY (`weapon_id`) REFERENCES `weapons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_id`) REFERENCES `weapons`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "weapon_build_ups_not_itself" CHECK("weapon_build_ups"."weapon_id" <> "weapon_build_ups"."target_id")
);
--> statement-breakpoint
CREATE TABLE `weapon_kill_requirements` (
	`weapon_id` text NOT NULL,
	`enemy_id` text NOT NULL,
	PRIMARY KEY(`weapon_id`, `enemy_id`),
	FOREIGN KEY (`weapon_id`) REFERENCES `weapons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`enemy_id`) REFERENCES `enemies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `weapons` (
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
	CONSTRAINT "weapons_id" CHECK("weapons"."id" GLOB '[a-z0-9]*' AND "weapons"."id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "weapons_character" CHECK("weapons"."character" IN ('max', 'monica')),
	CONSTRAINT "weapons_type" CHECK("weapons"."type" IN ('wrench', 'gun', 'club', 'sword', 'armband')),
	CONSTRAINT "weapons_base_abs" CHECK("weapons"."base_abs" >= 0),
	CONSTRAINT "weapons_synth_points_per_level" CHECK("weapons"."synth_points_per_level" >= 1),
	CONSTRAINT "weapons_max_durability" CHECK("weapons"."max_durability" >= 1),
	CONSTRAINT "weapons_sub_type_matches_type" CHECK("weapons"."sub_type" IS NULL OR ("weapons"."type" = 'gun' AND "weapons"."sub_type" IN ('normal', 'machine-gun', 'grenade', 'beam')) OR ("weapons"."type" = 'wrench' AND "weapons"."sub_type" IN ('wrench', 'hammer')))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weapons_name_unique` ON `weapons` (`name`);