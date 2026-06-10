import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processDuelResult } from '@/lib/elo';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export async function POST(req: Request) {
  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get('authorization') || '';
    const accessToken = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { roomId, timeMs } = body;
    const playerId = user.id;

    if (!roomId || typeof timeMs !== 'number') {
      return NextResponse.json({ error: 'roomId and timeMs are required.' }, { status: 400 });
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

      // Check for early match finish (first to 3 wins out of 5)
      const maxRounds = 5;
      const winsNeeded = 3;
      const isEarlyFinish = finalP1Score >= winsNeeded || finalP2Score >= winsNeeded;
      const isLastRound = room.current_round === maxRounds;

      if (isLastRound || isEarlyFinish) {
        updates.status = 'finished';

        const p1Win = finalP1Score > finalP2Score;
        const winnerId = p1Win ? room.player1_id : room.player2_id;
        const loserId = p1Win ? room.player2_id : room.player1_id;

        try {
          const result = await processDuelResult(supabaseAdmin, {
            winnerId,
            loserId,
            player1Id: room.player1_id,
            player2Id: room.player2_id,
            player1Score: finalP1Score,
            player2Score: finalP2Score,
            language: room.language,
          });

          updates.elo_change_p1 = result.eloChangeP1;
          updates.elo_change_p2 = result.eloChangeP2;
        } catch (eloErr: any) {
          console.error('ELO processing failed (match will still finish):', eloErr);
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
