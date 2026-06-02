-- 004_ranking_system.sql
-- Adds ranking/duel tables, enum, RLS, public SELECT policy, and signup trigger

-- 1) League tier enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'league_tier') THEN
        CREATE TYPE public.league_tier AS ENUM ('bronze','silver','gold','platinum','diamond');
    END IF;
END$$;

-- 2) user_rankings: per-user persistent ranking/stats
CREATE TABLE IF NOT EXISTS public.user_rankings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    elo_rating int NOT NULL DEFAULT 1000,
    league public.league_tier NOT NULL DEFAULT 'bronze',
    xp_this_week int NOT NULL DEFAULT 0,
    xp_total int NOT NULL DEFAULT 0,
    wins int NOT NULL DEFAULT 0,
    losses int NOT NULL DEFAULT 0,
    win_streak int NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) duel_matches: record of head-to-head duels
CREATE TABLE IF NOT EXISTS public.duel_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    player2_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    player1_score int,
    player2_score int,
    elo_change_p1 int,
    elo_change_p2 int,
    language text,
    played_at timestamptz NOT NULL DEFAULT now()
);

-- 4) league_weeks: weekly snapshots for promotions/demotion audits
CREATE TABLE IF NOT EXISTS public.league_weeks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    league public.league_tier NOT NULL,
    xp_earned int NOT NULL DEFAULT 0,
    rank_in_league int,
    promoted boolean NOT NULL DEFAULT false,
    demoted boolean NOT NULL DEFAULT false,
    week_start date NOT NULL
);

-- 5) Enable Row Level Security
ALTER TABLE IF EXISTS public.user_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.duel_matches ENABLE ROW LEVEL SECURITY;

-- 6) Public SELECT policy for user_rankings (sanitized leaderboard reads allowed)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.policyname = 'allow_public_select' AND p.schemaname = 'public' AND p.tablename = 'user_rankings'
    ) THEN
        CREATE POLICY allow_public_select ON public.user_rankings
            FOR SELECT
            USING (true);
    END IF;
END$$;

-- 7) Trigger function to create a user_rankings row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user_ranking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert a default ranking row for the new user; ignore conflicts
    INSERT INTO public.user_rankings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- 8) Trigger on auth.users AFTER INSERT
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_handle_new_user_ranking'
    ) THEN
        CREATE TRIGGER trg_handle_new_user_ranking
            AFTER INSERT ON auth.users
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_new_user_ranking();
    END IF;
END$$;

-- End of migration
