import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const type = (url.searchParams.get('type') || 'global') as 'global' | 'friends';
    const language = url.searchParams.get('language') || undefined;

    const supabase = await createSupabaseServerClient();

    if (type === 'global') {
      const { data, error } = await supabase
        .from('user_rankings')
        .select(`user_id, elo_rating, xp_this_week, league, wins, profiles(username:name, avatar_url:image)`)
        .order('xp_this_week', { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      return NextResponse.json(data ?? []);
    }

    // type === 'friends' — TODO: filter by friends list. For now return empty array.
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      // If we can't determine user, return empty
      return NextResponse.json([]);
    }

    const user = userData?.user ?? null;
    if (!user) return NextResponse.json([]);

    // TODO: implement friends filtering by user's friends list
    return NextResponse.json([]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

export const runtime = 'edge';
