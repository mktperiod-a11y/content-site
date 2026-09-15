ALTER TABLE `theater_movies` ADD `poster_url` text;--> statement-breakpoint
ALTER TABLE `theater_movies` ADD `tmdb_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `theater_movies` ADD `tmdb_updated_at` integer;