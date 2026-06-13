-- 012_roleplay_sessions.sql
-- Adds persistent storage for roleplay session results.

CREATE TABLE IF NOT EXISTS public.roleplay_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    scenario_id text NOT NULL,
    target_language text NOT NULL,
    message_count int NOT NULL DEFAULT 0,
    user_message_count int NOT NULL DEFAULT 0,
    score int NOT NULL DEFAULT 0,
    xp_earned int NOT NULL DEFAULT 0,
    duration_seconds int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.roleplay_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = 'roleplay_sessions' AND p.policyname = 'roleplay_sessions_select_own'
    ) THEN
        CREATE POLICY roleplay_sessions_select_own ON public.roleplay_sessions
            FOR SELECT
            TO authenticated
            USING (user_id = auth.uid());
    END IF;
END$$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = 'roleplay_sessions' AND p.policyname = 'roleplay_sessions_insert_own'
    ) THEN
        CREATE POLICY roleplay_sessions_insert_own ON public.roleplay_sessions
            FOR INSERT
            TO authenticated
            WITH CHECK (user_id = auth.uid());
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_roleplay_sessions_user_id ON public.roleplay_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_roleplay_sessions_created_at ON public.roleplay_sessions (created_at DESC);
