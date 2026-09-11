import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const movies = sqliteTable(
  "movies",
  {
    movieCd: text("movie_cd").primaryKey(),
    titleKo: text("title_ko").notNull(),
    normalizedTitle: text("normalized_title").notNull().default(""),
    titleEn: text("title_en").notNull().default(""),
    productionYear: text("production_year").notNull().default(""),
    openDate: text("open_date").notNull(),
    genreText: text("genre_text").notNull().default(""),
    nationText: text("nation_text").notNull().default(""),
    directorsJson: text("directors_json").notNull().default("[]"),
    tmdbId: integer("tmdb_id"),
    posterUrl: text("poster_url"),
    voteAverage: real("vote_average"),
    voteCount: integer("vote_count").notNull().default(0),
    tmdbStatus: text("tmdb_status").notNull().default("pending"),
    tmdbUpdatedAt: integer("tmdb_updated_at"),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("idx_movies_open_date").on(table.openDate),
    index("idx_movies_normalized_title").on(table.normalizedTitle),
  ],
);

export const movieProviders = sqliteTable(
  "movie_providers",
  {
    movieCd: text("movie_cd")
      .notNull()
      .references(() => movies.movieCd, { onDelete: "cascade" }),
    providerId: integer("provider_id").notNull(),
    providerName: text("provider_name").notNull(),
    logoUrl: text("logo_url"),
    monetizationType: text("monetization_type").notNull(),
    sourceUrl: text("source_url").notNull().default(""),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.movieCd, table.providerId, table.monetizationType],
    }),
    index("idx_movie_providers_movie_type").on(
      table.movieCd,
      table.monetizationType,
    ),
  ],
);

export const syncState = sqliteTable("sync_state", {
  syncKey: text("sync_key").primaryKey(),
  lastSuccessAt: integer("last_success_at"),
  lockUntil: integer("lock_until").notNull().default(0),
  lockToken: text("lock_token"),
  status: text("status").notNull().default("idle"),
  lastError: text("last_error"),
  updatedAt: integer("updated_at").notNull(),
});

export const theaterMovies = sqliteTable(
  "theater_movies",
  {
    theaterCode: text("theater_code").notNull(),
    theaterMovieId: text("theater_movie_id").notNull(),
    titleKo: text("title_ko").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    openDate: text("open_date").notNull().default(""),
    bookingAvailable: integer("booking_available", { mode: "boolean" })
      .notNull()
      .default(true),
    checkedAt: integer("checked_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.theaterCode, table.theaterMovieId] }),
    index("idx_theater_movies_title").on(table.normalizedTitle),
    index("idx_theater_movies_checked").on(table.theaterCode, table.checkedAt),
  ],
);
