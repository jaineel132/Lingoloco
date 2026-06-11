import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processDuelResult } from '@/lib/elo';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabaseAdmin = createSupabaseAdminClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { player1Id, player2Id, player1Score, player2Score, language } = body;

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

    if (user.id !== player1Id && user.id !== player2Id) {
      return NextResponse.json({ error: 'You are not a participant in this match' }, { status: 403 });
    }

    if (!player1Id || !player2Id) {
      return NextResponse.json({ error: 'player1Id and player2Id required' }, { status: 400 });
    }

    const p1Score = Number(player1Score || 0);
    const p2Score = Number(player2Score || 0);

    if (p1Score === p2Score) {
      return NextResponse.json({ error: 'Scores must not be tied' }, { status: 400 });
    }

    const p1Won = p1Score > p2Score;
    const winnerId = p1Won ? player1Id : player2Id;
    const loserId = p1Won ? player2Id : player1Id;

    const result = await processDuelResult(supabaseAdmin, {
      winnerId, loserId, player1Id, player2Id, player1Score: p1Score, player2Score: p2Score, language,
    });

    return NextResponse.json({
      winnerNewElo: result.winnerNewElo,
      loserNewElo: result.loserNewElo,
      winnerChange: result.winnerChange,
      loserChange: result.loserChange,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
