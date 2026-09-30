CREATE TABLE `detail_cache` (
	`movie_cd` text PRIMARY KEY NOT NULL,
	`kobis_json` text,
	`kobis_fetched_at` integer,
	`tmdb_id` integer,
	`tmdb_json` text,
	`tmdb_fetched_at` integer
);
