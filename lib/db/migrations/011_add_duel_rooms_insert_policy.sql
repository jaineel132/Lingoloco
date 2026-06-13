-- 011_add_duel_rooms_insert_policy.sql
-- Fixes critical missing INSERT policy on duel_rooms.
-- The client-side code at app/compete/duel/[id]/page.tsx creates rooms
-- via direct supabase INSERT, which fails with RLS without this policy.

CREATE POLICY "duel_rooms_insert_participants" ON public.duel_rooms
    FOR INSERT
    TO authenticated
    WITH CHECK (
        player1_id = auth.uid() OR player2_id = auth.uid()
    );
