import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabaseAdmin = createSupabaseAdminClient();

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
    const { roomId } = body;
    const playerId = user.id;

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required.' }, { status: 400 });
    }

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
