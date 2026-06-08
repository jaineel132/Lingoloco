-- 008_tournaments.sql
-- Adds the missing tournaments table referenced by app/compete/page.tsx

CREATE TABLE IF NOT EXISTS public.tournaments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL DEFAULT 'Weekend Sprint Tournament',
    is_active boolean NOT NULL DEFAULT true,
    starts_at timestamptz NOT NULL DEFAULT now(),
    ends_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.tournaments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = 'tournaments' AND p.policyname = 'tournaments_select_active'
    ) THEN
        CREATE POLICY tournaments_select_active ON public.tournaments
            FOR SELECT
            TO authenticated
            USING (is_active = true);
    END IF;
END$$;
