CREATE TABLE `movie_providers` (
	`movie_cd` text NOT NULL,
	`provider_id` integer NOT NULL,
	`provider_name` text NOT NULL,
	`logo_url` text,
	`monetization_type` text NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`movie_cd`, `provider_id`, `monetization_type`),
	FOREIGN KEY (`movie_cd`) REFERENCES `movies`(`movie_cd`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_movie_providers_movie_type` ON `movie_providers` (`movie_cd`,`monetization_type`);--> statement-breakpoint
CREATE TABLE `movies` (
	`movie_cd` text PRIMARY KEY NOT NULL,
	`title_ko` text NOT NULL,
	`title_en` text DEFAULT '' NOT NULL,
	`production_year` text DEFAULT '' NOT NULL,
	`open_date` text NOT NULL,
	`genre_text` text DEFAULT '' NOT NULL,
	`nation_text` text DEFAULT '' NOT NULL,
	`directors_json` text DEFAULT '[]' NOT NULL,
	`tmdb_id` integer,
	`poster_url` text,
	`vote_average` real,
	`vote_count` integer DEFAULT 0 NOT NULL,
	`tmdb_status` text DEFAULT 'pending' NOT NULL,
	`tmdb_updated_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_movies_open_date` ON `movies` (`open_date`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`sync_key` text PRIMARY KEY NOT NULL,
	`last_success_at` integer,
	`lock_until` integer DEFAULT 0 NOT NULL,
	`lock_token` text,
	`status` text DEFAULT 'idle' NOT NULL,
	`last_error` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
PRAGMA optimize;
