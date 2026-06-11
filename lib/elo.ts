import { SupabaseClient } from '@supabase/supabase-js';

export const K_FACTOR = 32;

export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function calculateEloChange(
  winnerRating: number,
  loserRating: number
): { winnerChange: number; loserChange: number } {
  const expectedWinner = expectedScore(winnerRating, loserRating);
  const expectedLoser = expectedScore(loserRating, winnerRating);

  const winnerChange = Math.round(K_FACTOR * (1 - expectedWinner));
  const loserChange = Math.round(K_FACTOR * (0 - expectedLoser));

  return { winnerChange, loserChange };
}

export function getLeagueFromElo(elo: number): LeagueTier {
  if (elo >= 2000) return 'diamond';
  if (elo >= 1600) return 'platinum';
  if (elo >= 1300) return 'gold';
  if (elo >= 1100) return 'silver';
  return 'bronze';
}

export async function processDuelResult(
  supabaseAdmin: SupabaseClient,
  params: {
    winnerId: string;
    loserId: string;
    player1Id: string;
    player2Id: string;
    player1Score: number;
    player2Score: number;
    language?: string | null;
  }
) {
  const { winnerId, loserId, player1Id, player2Id, player1Score, player2Score, language } = params;

  const { data: rows, error: fetchError } = await supabaseAdmin
    .from('user_rankings')
    .select('*')
    .in('user_id', [winnerId, loserId]);

  if (fetchError) throw fetchError;
  if (!rows || rows.length < 2) {
    throw new Error('Could not find both user_rankings rows');
  }

  const winnerRow = rows.find((r: any) => r.user_id === winnerId);
  const loserRow = rows.find((r: any) => r.user_id === loserId);

  if (!winnerRow || !loserRow) {
    throw new Error('Missing ranking rows');
  }

  const { winnerChange, loserChange } = calculateEloChange(winnerRow.elo_rating, loserRow.elo_rating);

  const winnerNewElo = winnerRow.elo_rating + winnerChange;
  const rawLoserNewElo = loserRow.elo_rating + loserChange;
  const loserNewElo = Math.max(100, rawLoserNewElo);

  const winnerLeague = getLeagueFromElo(winnerNewElo);
  const loserLeague = getLeagueFromElo(loserNewElo);

  const now = new Date().toISOString();

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

  const p1Won = player1Id === winnerId;
  const eloChangeP1 = p1Won ? winnerChange : loserChange;
  const eloChangeP2 = p1Won ? loserChange : winnerChange;

  const { error: insertDuelErr } = await supabaseAdmin.from('duel_matches').insert([{
    player1_id: player1Id,
    player2_id: player2Id,
    winner_id: winnerId,
    player1_score: player1Score,
    player2_score: player2Score,
    elo_change_p1: eloChangeP1,
    elo_change_p2: eloChangeP2,
    language: language || null,
    played_at: now,
  }]);

  if (insertDuelErr) throw insertDuelErr;

  return { winnerNewElo, loserNewElo, winnerChange, loserChange, eloChangeP1, eloChangeP2 };
}
