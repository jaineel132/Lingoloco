-- 007_fix_rls_policies.sql
-- Fixes CRITICAL RLS issues:
--   1. Allow reading opponent profiles in active duel rooms (Issue #4)
--   2. Add missing SELECT policy for duel_matches (Issue #5)

-- 1) Allow authenticated users to read profiles of opponents in active duel rooms
--    This enables the duel page to fetch opponent profiles by ID.
CREATE POLICY "profiles_select_duel_participants" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.duel_rooms
            WHERE (player1_id = auth.uid() AND player2_id = profiles.id)
               OR (player2_id = auth.uid() AND player1_id = profiles.id)
        )
    );

-- 2) Add SELECT policy for duel_matches so participants can read match history
CREATE POLICY "duel_matches_select_participants" ON public.duel_matches
    FOR SELECT
    TO authenticated
    USING (
        player1_id = auth.uid() OR player2_id = auth.uid()
    );

-- 3) Add INSERT policy for duel_matches (for service-role-backed endpoints or future use)
CREATE POLICY "duel_matches_insert_own" ON public.duel_matches
    FOR INSERT
    TO authenticated
    WITH CHECK (
        player1_id = auth.uid() OR player2_id = auth.uid()
    );
