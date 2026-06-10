import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const type = (url.searchParams.get('type') || 'global') as 'global' | 'friends';
    const language = url.searchParams.get('language') || undefined;

    const supabase = await createSupabaseServerClient();

    if (type === 'global') {
      const { data: rankings, error } = await supabase
        .from('user_rankings')
        .select('user_id, elo_rating, xp_this_week, league, wins')
        .order('xp_this_week', { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      const userIds = Array.from(new Set((rankings ?? []).map((row) => row.user_id).filter(Boolean)));
      const { data: profiles, error: profilesError } = userIds.length
        ? await supabase.from('profiles').select('id,name,image').in('id', userIds)
        : { data: [], error: null };

      if (profilesError) {
        throw profilesError;
      }

      const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

      return NextResponse.json(
        (rankings ?? []).map((row) => {
          const profile = profileById.get(row.user_id) || null;

          return {
            ...row,
            name: profile?.name ?? null,
            image: profile?.image ?? null,
            profiles: profile
              ? {
                  username: profile.name,
                  avatar_url: profile.image,
                }
              : null,
          };
        })
      );
    }

    // type === 'friends' — treat recent duel opponents as friends
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      return NextResponse.json([]);
    }

    const user = userData?.user ?? null;
    if (!user) return NextResponse.json([]);

    const { data: matches, error: matchesError } = await supabase
      .from('duel_matches')
      .select('player1_id, player2_id')
      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
      .limit(50);

    if (matchesError) {
      throw matchesError;
    }

    const opponentIds = Array.from(new Set(
      (matches ?? []).map((m) => m.player1_id === user.id ? m.player2_id : m.player1_id)
    )).filter(Boolean);

    if (opponentIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data: rankings, error: rankingsError } = await supabase
      .from('user_rankings')
      .select('user_id, elo_rating, xp_this_week, league, wins')
      .in('user_id', opponentIds)
      .order('xp_this_week', { ascending: false })
      .limit(100);

    if (rankingsError) {
      throw rankingsError;
    }

    const userIds = Array.from(new Set((rankings ?? []).map((row) => row.user_id).filter(Boolean)));
    const { data: profiles, error: profilesError } = userIds.length
      ? await supabase.from('profiles').select('id,name,image').in('id', userIds)
      : { data: [], error: null };

    if (profilesError) {
      throw profilesError;
    }

    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

    return NextResponse.json(
      (rankings ?? []).map((row) => {
        const profile = profileById.get(row.user_id) || null;
        return {
          ...row,
          name: profile?.name ?? null,
          image: profile?.image ?? null,
          profiles: profile
            ? { username: profile.name, avatar_url: profile.image }
            : null,
        };
      })
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

export const runtime = 'edge';
