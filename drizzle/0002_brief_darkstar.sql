CREATE TABLE `silicon_x_links` (
	`agent_id` text PRIMARY KEY NOT NULL,
	`x_id` text NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`linked_at` text NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `silicon_agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `silicon_x_links_x_id_unique` ON `silicon_x_links` (`x_id`);--> statement-breakpoint
CREATE TABLE `silicon_x_states` (
	`hash` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`agent_id` text NOT NULL,
	`verifier` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	FOREIGN KEY (`agent_id`) REFERENCES `silicon_agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `silicon_x_states_agent_id_unique` ON `silicon_x_states` (`agent_id`);--> statement-breakpoint
CREATE INDEX `silicon_x_states_expiry` ON `silicon_x_states` (`expires_at`);