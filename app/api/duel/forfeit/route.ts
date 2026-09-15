import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const supabaseAdmin = createSupabaseAdminClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { roomId, playerId } = body;

    if (!roomId || !playerId) {
      return NextResponse.json({ error: 'roomId and playerId are required.' }, { status: 400 });
    }

    // Retrieve the current duel room state
    const { data: room, error: fetchError } = await supabaseAdmin
      .from('duel_rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch duel room.' }, { status: 500 });
    }

    if (!room) {
      return NextResponse.json({ error: 'Duel room not found.' }, { status: 404 });
    }

    const isPlayer1 = playerId === room.player1_id;
    const isPlayer2 = playerId === room.player2_id;

    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json({ error: 'Player does not belong to this duel room.' }, { status: 403 });
    }

    // The player who forfeits loses the match
    const { error: updateError } = await supabaseAdmin
      .from('duel_rooms')
      .update({ status: 'finished', winner_id: isPlayer1 ? room.player2_id : room.player1_id })
      .eq('id', roomId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to forfeit the duel.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
