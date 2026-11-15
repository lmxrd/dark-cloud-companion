-- SQLite cannot add a NOT NULL column without a default; every weapon gets its real tier right after
-- (the "weapon tier" rule in scripts/db/rules.ts rejects 0).
ALTER TABLE `weapons` ADD `tier` integer DEFAULT 0 NOT NULL;
