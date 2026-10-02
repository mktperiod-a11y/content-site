ALTER TABLE `theater_movies` ADD `theater_poster_url` text;--> statement-breakpoint
-- 같은 제목 작품이 여러 편일 때 엉뚱한 편에 붙었을 수 있는 제목(예: 시간을 달리는 소녀)을
-- 새 규칙으로 한 번 다시 확인하도록 재시도 기한을 비운다.
UPDATE `theater_movies` SET `kobis_updated_at` = NULL WHERE `kobis_status` = 'matched';
