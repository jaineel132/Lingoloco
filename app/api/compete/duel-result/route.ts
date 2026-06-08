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
    const { player1Id, player2Id, player1Score, player2Score, language } = body;

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

    // Verify the caller is one of the players
    if (user.id !== player1Id && user.id !== player2Id) {
      return NextResponse.json({ error: 'You are not a participant in this match' }, { status: 403 });
    }

    if (!player1Id || !player2Id) {
      return NextResponse.json({ error: 'player1Id and player2Id required' }, { status: 400 });
    }

    // Determine winner/loser server-side from scores (don't trust client)
    const p1Score = Number(player1Score || 0);
    const p2Score = Number(player2Score || 0);

    if (p1Score === p2Score) {
      return NextResponse.json({ error: 'Scores must not be tied' }, { status: 400 });
    }

    const p1Won = p1Score > p2Score;
    const winnerId = p1Won ? player1Id : player2Id;
    const loserId = p1Won ? player2Id : player1Id;

    // 1) Fetch both users' ranking rows
    const { data: rows, error: fetchError } = await supabaseAdmin
      .from('user_rankings')
      .select('*')
      .in('user_id', [winnerId, loserId]);

    if (fetchError) throw fetchError;
    if (!rows || rows.length < 2) {
      return NextResponse.json({ error: 'Could not find both user_rankings rows' }, { status: 404 });
    }

    const winnerRow = rows.find((r: any) => r.user_id === winnerId);
    const loserRow = rows.find((r: any) => r.user_id === loserId);

    if (!winnerRow || !loserRow) {
      return NextResponse.json({ error: 'Missing ranking rows' }, { status: 404 });
    }

    // 2) Calculate Elo changes
    const { winnerChange, loserChange } = calculateEloChange(winnerRow.elo_rating, loserRow.elo_rating);

    const winnerNewElo = winnerRow.elo_rating + winnerChange;
    const rawLoserNewElo = loserRow.elo_rating + loserChange;
    const loserNewElo = Math.max(100, rawLoserNewElo);

    const winnerLeague = getLeagueFromElo(winnerNewElo);
    const loserLeague = getLeagueFromElo(loserNewElo);

    const now = new Date().toISOString();

    // 3) Update winner
    const winnerXpGain = 50 + winnerChange;
    const { error: updWinnerErr } = await supabaseAdmin
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

    if (updWinnerErr) throw updWinnerErr;

    // 4) Update loser
    const loserXpGain = 10;
    const { error: updLoserErr } = await supabaseAdmin
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

    if (updLoserErr) throw updLoserErr;

    const winnerChangeIsP1 = player1Id === winnerId;
    const eloChangeP1 = winnerChangeIsP1 ? winnerChange : loserChange;
    const eloChangeP2 = winnerChangeIsP1 ? loserChange : winnerChange;

    // 5) Insert duel match record with correct score mapping
    const duelRecord: any = {
      player1_id: player1Id,
      player2_id: player2Id,
      winner_id: winnerId,
      player1_score: p1Score,
      player2_score: p2Score,
      elo_change_p1: eloChangeP1,
      elo_change_p2: eloChangeP2,
      language: language || null,
      played_at: now,
    };

    const { error: insertDuelErr } = await supabaseAdmin.from('duel_matches').insert([duelRecord]);
    if (insertDuelErr) throw insertDuelErr;

    return NextResponse.json({
      winnerNewElo,
      loserNewElo,
      winnerChange,
      loserChange,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
