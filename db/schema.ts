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
    posterUrl: text("poster_url"),
    /**
     * 극장사가 쓰는 포스터 주소. 같은 제목의 작품이 여러 편이라 어느 편인지
     * 가릴 수 없을 때(kobis_status = 'ambiguous')와, TMDB 포스터를 찾지 못했을
     * 때만 카드에 쓴다. 극장 쪽 이미지라 못 불러오면 "포스터 준비 중"으로 둔다.
     */
    theaterPosterUrl: text("theater_poster_url"),
    tmdbStatus: text("tmdb_status").notNull().default("pending"),
    tmdbUpdatedAt: integer("tmdb_updated_at"),
    /**
     * 이 제목을 KOBIS에서 찾아봤는지. 극장에는 걸려 있지만 KOBIS 수집 창
     * (오늘 -60일~+120일) 밖이라 movies에 없는 작품을 채워 넣기 위한 것으로,
     * "찾아봤지만 없었다"를 남겨야 매 수집마다 같은 제목을 다시 묻지 않는다.
     * 'ambiguous'는 같은 제목이 여러 편인데 극장 개봉일과 ±1년 안에 드는 편이
     * 없어 어느 작품인지 정할 수 없다는 뜻이다. 그런 제목은 상세에 잇지 않는다.
     */
    kobisStatus: text("kobis_status").notNull().default("pending"),
    kobisUpdatedAt: integer("kobis_updated_at"),
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

/**
 * 상세 화면이 외부에서 받아 온 응답을 그대로 담아 두는 보관함.
 * 매일 수집기가 1탭 영화의 상세를 미리 채워, 방문자가 열 때 KOBIS·TMDB 를
 * 기다리지 않게 한다. kobis_json / tmdb_json 은 각각 따로 갱신될 수 있다.
 */
export const detailCache = sqliteTable("detail_cache", {
  movieCd: text("movie_cd").primaryKey(),
  kobisJson: text("kobis_json"),
  kobisFetchedAt: integer("kobis_fetched_at"),
  tmdbId: integer("tmdb_id"),
  tmdbJson: text("tmdb_json"),
  tmdbFetchedAt: integer("tmdb_fetched_at"),
});
