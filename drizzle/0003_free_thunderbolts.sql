CREATE TABLE `silicon_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `silicon_rate_limits_expiry` ON `silicon_rate_limits` (`expires_at`);