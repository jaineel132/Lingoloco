-- 006_duel_rooms_schema.sql
-- Adds the missing duel_rooms table and aligns duel notification statuses with the RPC logic.

CREATE TABLE IF NOT EXISTS public.duel_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    player2_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    language text NOT NULL DEFAULT 'Spanish',
    status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'in_progress', 'round_complete', 'finished')),
    current_round int NOT NULL DEFAULT 1,
    player1_score int NOT NULL DEFAULT 0,
    player2_score int NOT NULL DEFAULT 0,
    current_challenge text,
    player1_round_time int,
    player2_round_time int,
    round_winner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    elo_change_p1 int,
    elo_change_p2 int,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.duel_rooms ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies p
        WHERE p.schemaname = 'public'
          AND p.tablename = 'duel_rooms'
          AND p.policyname = 'duel_rooms_select_participants'
    ) THEN
        CREATE POLICY duel_rooms_select_participants ON public.duel_rooms
            FOR SELECT
            TO authenticated
            USING (player1_id = auth.uid() OR player2_id = auth.uid());
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS duel_rooms_player1_id_idx ON public.duel_rooms (player1_id);
CREATE INDEX IF NOT EXISTS duel_rooms_player2_id_idx ON public.duel_rooms (player2_id);
CREATE INDEX IF NOT EXISTS duel_rooms_status_idx ON public.duel_rooms (status);
CREATE INDEX IF NOT EXISTS duel_rooms_updated_at_idx ON public.duel_rooms (updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_duel_rooms_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS duel_rooms_set_updated_at ON public.duel_rooms;
CREATE TRIGGER duel_rooms_set_updated_at
    BEFORE UPDATE ON public.duel_rooms
    FOR EACH ROW
    EXECUTE FUNCTION public.set_duel_rooms_updated_at();

ALTER TABLE public.duel_notifications
    DROP CONSTRAINT IF EXISTS duel_notifications_status_check;

ALTER TABLE public.duel_notifications
    ADD CONSTRAINT duel_notifications_status_check
    CHECK (status IN ('pending', 'accepted', 'declined', 'pending_waiting_acceptance'));