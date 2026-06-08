import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateEloChange, getLeagueFromElo } from '@/lib/elo';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { roomId, playerId, timeMs } = body;

    if (!roomId || !playerId || typeof timeMs !== 'number') {
      return NextResponse.json({ error: 'roomId, playerId, and timeMs are required.' }, { status: 400 });
    }

    // Retrieve the current duel room state
    const { data: room, error: fetchError } = await supabaseAdmin
      .from('duel_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (fetchError || !room) {
      return NextResponse.json({ error: 'Duel room not found.' }, { status: 404 });
    }

    const isPlayer1 = playerId === room.player1_id;
    const isPlayer2 = playerId === room.player2_id;

    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json({ error: 'Player does not belong to this duel room.' }, { status: 403 });
    }

    const updates: any = {};
    let finalP1Score = room.player1_score;
    let finalP2Score = room.player2_score;

    if (room.status === 'in_progress') {
      // First player to finish gets the point!
      updates.round_winner_id = playerId;
      
      if (isPlayer1) {
        updates.player1_round_time = timeMs;
        finalP1Score = room.player1_score + 1;
        updates.player1_score = finalP1Score;
      } else {
        updates.player2_round_time = timeMs;
        finalP2Score = room.player2_score + 1;
        updates.player2_score = finalP2Score;
      }

      if (room.current_round === 5) {
        // Match finished! Calculate Elo changes
        updates.status = 'finished';
        const now = new Date().toISOString();

        const p1Win = finalP1Score > finalP2Score;
        const winnerId = p1Win ? room.player1_id : room.player2_id;
        const loserId = p1Win ? room.player2_id : room.player1_id;

        // Fetch rankings for both users
        const { data: rows, error: fetchRankError } = await supabaseAdmin
          .from('user_rankings')
          .select('*')
          .in('user_id', [winnerId, loserId]);

        if (fetchRankError || !rows || rows.length < 2) {
          console.error('Could not load user rankings for ELO calculation:', fetchRankError);
        } else {
          const winnerRow = rows.find((r: any) => r.user_id === winnerId);
          const loserRow = rows.find((r: any) => r.user_id === loserId);

          if (winnerRow && loserRow) {
            const { winnerChange, loserChange } = calculateEloChange(winnerRow.elo_rating, loserRow.elo_rating);

            const winnerNewElo = winnerRow.elo_rating + winnerChange;
            const rawLoserNewElo = loserRow.elo_rating + loserChange;
            const loserNewElo = Math.max(100, rawLoserNewElo);

            const winnerLeague = getLeagueFromElo(winnerNewElo);
            const loserLeague = getLeagueFromElo(loserNewElo);

            // Update winner user_rankings
            const winnerXpGain = 50 + winnerChange;
            await supabaseAdmin
              .from('user_rankings')
              .update({
                elo_rating: winnerNewElo,
                league: winnerLeague,
                wins: (winnerRow.wins || 0) + 1,
                win_streak: (winnerRow.win_streak || 0) + 1,
                xp_this_week: (winnerRow.xp_this_week || 0) + winnerXpGain,
                xp_total: (winnerRow.xp_total || 0) + winnerXpGain,
                updated_at: now,
              })
              .eq('user_id', winnerId);

            // Update loser user_rankings
            const loserXpGain = 10;
            await supabaseAdmin
              .from('user_rankings')
              .update({
                elo_rating: loserNewElo,
                league: loserLeague,
                losses: (loserRow.losses || 0) + 1,
                win_streak: 0,
                xp_this_week: (loserRow.xp_this_week || 0) + loserXpGain,
                xp_total: (loserRow.xp_total || 0) + loserXpGain,
                updated_at: now,
              })
              .eq('user_id', loserId);

            // Calculate explicit P1 and P2 Elo changes
            const eloChangeP1 = p1Win ? winnerChange : loserChange;
            const eloChangeP2 = p1Win ? loserChange : winnerChange;

            updates.elo_change_p1 = eloChangeP1;
            updates.elo_change_p2 = eloChangeP2;

            // Insert match record
            await supabaseAdmin.from('duel_matches').insert([{
              player1_id: room.player1_id,
              player2_id: room.player2_id,
              winner_id: winnerId,
              player1_score: finalP1Score,
              player2_score: finalP2Score,
              elo_change_p1: eloChangeP1,
              elo_change_p2: eloChangeP2,
              language: room.language,
              played_at: now,
            }]);
          }
        }
      } else {
        updates.status = 'round_complete';
      }
    } else {
      // The other player won, but we still write down this player's slower round time
      if (isPlayer1 && room.player1_round_time === null) {
        updates.player1_round_time = timeMs;
      } else if (isPlayer2 && room.player2_round_time === null) {
        updates.player2_round_time = timeMs;
      }
    }

    updates.updated_at = new Date().toISOString();

    const { error: saveError } = await supabaseAdmin
      .from('duel_rooms')
      .update(updates)
      .eq('id', roomId);

    if (saveError) throw saveError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Submit Round API error:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}

export const runtime = 'edge';
