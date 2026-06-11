-- 010_missing_indexes.sql
-- Adds indexes on columns frequently queried but missing in earlier migrations.

-- duel_matches: leaderboard and duels routes filter/sort by player1_id and player2_id
CREATE INDEX IF NOT EXISTS idx_duel_matches_player1_id ON public.duel_matches (player1_id);
CREATE INDEX IF NOT EXISTS idx_duel_matches_player2_id ON public.duel_matches (player2_id);
-- Composite index for queries that check both player columns
CREATE INDEX IF NOT EXISTS idx_duel_matches_players ON public.duel_matches (player1_id, player2_id);

-- league_weeks: weekly reset queries by user_id and week_start
CREATE INDEX IF NOT EXISTS idx_league_weeks_user_id ON public.league_weeks (user_id);
CREATE INDEX IF NOT EXISTS idx_league_weeks_week_start ON public.league_weeks (week_start);

-- user_rankings: leaderboard queries sort by xp_this_week
CREATE INDEX IF NOT EXISTS idx_user_rankings_xp_this_week ON public.user_rankings (xp_this_week DESC);

-- tournaments: RLS policy filters on is_active
CREATE INDEX IF NOT EXISTS idx_tournaments_is_active ON public.tournaments (is_active);
