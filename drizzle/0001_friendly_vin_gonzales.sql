CREATE TABLE `theater_movies` (
	`theater_code` text NOT NULL,
	`theater_movie_id` text NOT NULL,
	`title_ko` text NOT NULL,
	`normalized_title` text NOT NULL,
	`open_date` text DEFAULT '' NOT NULL,
	`booking_available` integer DEFAULT true NOT NULL,
	`checked_at` integer NOT NULL,
	PRIMARY KEY(`theater_code`, `theater_movie_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_theater_movies_title` ON `theater_movies` (`normalized_title`);--> statement-breakpoint
CREATE INDEX `idx_theater_movies_checked` ON `theater_movies` (`theater_code`,`checked_at`);--> statement-breakpoint
ALTER TABLE `movies` ADD `normalized_title` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_movies_normalized_title` ON `movies` (`normalized_title`);