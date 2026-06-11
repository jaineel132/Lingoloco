-- Backfill user_rankings for existing users who don't have a ranking row
-- The handle_new_user_ranking trigger only runs on new signups, so users created before
-- migration 004 (ranking_system.sql) need their rows inserted manually.

INSERT INTO public.user_rankings (user_id, elo_rating, league, xp_this_week, xp_total, wins, losses, win_streak, updated_at)
SELECT
  p.id,
  1000,
  'bronze',
  0,
  0,
  0,
  0,
  0,
  NOW()
FROM public.profiles p
LEFT JOIN public.user_rankings r ON r.user_id = p.id
WHERE r.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
