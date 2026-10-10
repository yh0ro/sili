CREATE TABLE `silicon_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_awake` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `silicon_agents_owner_unique` ON `silicon_agents` (`owner`);--> statement-breakpoint
CREATE INDEX `silicon_agents_awake` ON `silicon_agents` (`last_awake`);--> statement-breakpoint
CREATE TABLE `silicon_encounters` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `silicon_events` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `silicon_sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`last_seen` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `silicon_world` (
	`id` integer PRIMARY KEY NOT NULL,
	`lease` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`last_tick` integer DEFAULT 0 NOT NULL
);
